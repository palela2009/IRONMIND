export type StoreOutcome = 'purchased' | 'cancelled' | 'failed';
export type ConfirmedOutcome = StoreOutcome | 'pending';

interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function recoverStorePurchase(storage: Storage, key: string, confirm: () => Promise<boolean>): Promise<boolean> {
  if (!(await storage.getItem(key))) return false;
  try {
    if (!(await confirm())) return false;
    await storage.removeItem(key);
    return true;
  } catch { return false; }
}

export async function completeStorePurchase(storage: Storage, key: string, productId: string, buy: () => Promise<StoreOutcome>, confirm: () => Promise<boolean>): Promise<ConfirmedOutcome> {
  await storage.setItem(key, JSON.stringify({ productId, startedAt: Date.now() }));
  const outcome = await buy();
  if (outcome !== 'purchased') {
    await storage.removeItem(key);
    return outcome;
  }
  return (await recoverStorePurchase(storage, key, confirm)) ? 'purchased' : 'pending';
}
