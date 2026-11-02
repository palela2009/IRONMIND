const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
};
const { INITIAL_STATS, projectProgress, mergeHistory } = require('../src/utils/progressState.ts');
const { permanentRejection, rejectChallenge, retryRejected } = require('../src/utils/progressQueue.ts');
const { completeStorePurchase, recoverStorePurchase } = require('../src/utils/purchaseRecovery.ts');
const { totalUsageMinutes, trackedUsageMinutes } = require('../src/utils/screenTime.ts');
const event = (id, success = true) => ({ id: String(id), targetApp: 'YouTube', elapsedTime: success ? 2 : 20, wasSuccessful: success, timestamp: Date.UTC(2026, 9, 31, 12, 0, id) });

test('saved offline results rebuild progress after restarting', () => {
  const saved = JSON.parse(JSON.stringify({ stats: INITIAL_STATS, history: [], pending: [event(1), event(2)], streakFreezes: 0 }));
  const view = projectProgress(saved, 5);
  assert.equal(view.stats.currentStreak, 2);
  assert.equal(view.stats.currentXP, 100);
  assert.equal(view.history.length, 2);
  assert.deepEqual(saved.stats, INITIAL_STATS);
});

test('server acknowledgement and remaining offline events do not double count', () => {
  const view = projectProgress({ stats: { ...INITIAL_STATS, totalChallenges: 1, currentXP: 50, currentStreak: 1, longestStreak: 1, successCount: 1 }, history: [event(1)], pending: [event(2)], streakFreezes: 0 }, 5);
  assert.equal(view.stats.totalChallenges, 2);
  assert.equal(view.stats.currentXP, 100);
  assert.equal(mergeHistory([event(1)], [{ ...event(1), id: 'server-id' }]).length, 1);
});

test('offline freeze is only projected once and remaining losses break streak', () => {
  const view = projectProgress({ stats: { ...INITIAL_STATS, currentStreak: 4 }, history: [], pending: [event(1, false), event(2, false)], streakFreezes: 1 }, 5);
  assert.equal(view.streakFreezes, 0);
  assert.equal(view.stats.currentStreak, 0);
  assert.equal(view.stats.lostStreak, 4);
  assert.equal(view.stats.reclaimableEventId, '2');
});

test('daily result limit survives offline batches spanning two days', () => {
  const yesterday = { ...event(4), timestamp: Date.UTC(2026, 9, 30, 12) };
  const view = projectProgress({ stats: INITIAL_STATS, history: [], pending: [yesterday, event(1), event(2), event(3), event(4)], streakFreezes: 0 }, 3);
  assert.equal(view.stats.totalChallenges, 4);
  assert.equal(view.history.find((item) => item.timestamp === event(4).timestamp).counted, false);
});

test('a rejected upload remains recoverable without blocking the following result', () => {
  const bad = event(1), valid = event(2);
  const saved = rejectChallenge({ stats: INITIAL_STATS, history: [], pending: [bad, valid], streakFreezes: 0 }, bad, 'Invalid timestamp');
  const restored = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(restored.pending, [valid]);
  assert.equal(restored.rejected[0].item.id, bad.id);
  assert.equal(projectProgress(restored, 5).stats.totalChallenges, 1);
  const retried = retryRejected(restored);
  assert.deepEqual(retried.pending.map((item) => item.id), [bad.id, valid.id]);
  assert.equal(retried.rejected.length, 0);
  assert.equal(permanentRejection(400), true);
  assert.equal(permanentRejection(422), true);
  for (const status of [401, 409, 429, 500, 503]) assert.equal(permanentRejection(status), false);
});

test('offline projection uses the same account-local midnight as the backend', () => {
  const before = Date.parse('2026-10-31T23:30:00+04:00');
  const after = Date.parse('2026-11-01T00:30:00+04:00');
  const history = [0, 1, 2].map((i) => ({ ...event(i), timestamp: before + i * 1000 }));
  const view = projectProgress({ stats: INITIAL_STATS, timeZone: 'Asia/Tbilisi', history, pending: [{ ...event(9), timestamp: after }], streakFreezes: 0 }, 3);
  assert.equal(view.stats.totalChallenges, 1);
  assert.equal(view.history.find((item) => item.timestamp === after).counted, true);
});

const storage = () => {
  const values = new Map();
  return { getItem: async (key) => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async (key) => { values.delete(key); } };
};

test('charged purchase stays pending across restart and confirms without buying again', async () => {
  const saved = storage();
  let buys = 0;
  const outcome = await completeStorePurchase(saved, 'purchase:a', 'pro', async () => { buys += 1; return 'purchased'; }, async () => { throw new Error('Server offline'); });
  assert.equal(outcome, 'pending');
  assert.ok(await saved.getItem('purchase:a'));
  assert.equal(await recoverStorePurchase(saved, 'purchase:b', async () => true), false);
  assert.equal(await recoverStorePurchase(saved, 'purchase:a', async () => false), false);
  assert.equal(await recoverStorePurchase(saved, 'purchase:a', async () => true), true);
  assert.equal(await saved.getItem('purchase:a'), null);
  assert.equal(buys, 1);
});

test('only verified purchases report success and cancellation clears recovery state', async () => {
  const saved = storage();
  assert.equal(await completeStorePurchase(saved, 'key', 'pro', async () => 'purchased', async () => true), 'purchased');
  assert.equal(await saved.getItem('key'), null);
  let confirms = 0;
  assert.equal(await completeStorePurchase(saved, 'key', 'pro', async () => 'cancelled', async () => { confirms += 1; return true; }), 'cancelled');
  assert.equal(await saved.getItem('key'), null);
  assert.equal(confirms, 0);
});

test('process interruption during a store operation leaves a recovery record', async () => {
  const saved = storage();
  await assert.rejects(() => completeStorePurchase(saved, 'key', 'pro', async () => { throw new Error('Interrupted'); }, async () => false));
  assert.ok(await saved.getItem('key'));
  assert.equal(await recoverStorePurchase(saved, 'key', async () => true), true);
});

test('overall screen time includes untracked apps and apps beyond the first ten', () => {
  const apps = Array.from({ length: 15 }, (_, i) => ({ app: `App ${i}`, minutes: i + 1 }));
  apps.push({ app: 'YouTube', minutes: 0 });
  assert.equal(totalUsageMinutes(apps), 120);
  assert.equal(trackedUsageMinutes(apps, ['YouTube', 'Instagram', 'TikTok']), 0);
  assert.equal(trackedUsageMinutes(apps, ['App 14']), 15);
  assert.equal(totalUsageMinutes([{ app: 'Invalid', minutes: NaN }, { app: 'Invalid', minutes: -5 }, { app: 'Small', minutes: 0.25 }]), 0.25);
});
