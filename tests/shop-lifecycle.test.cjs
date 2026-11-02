const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename
);

test('the open shop keeps its mounted instance and scroll state through Home refreshes', async () => {
  const theme = require('../src/theme.ts');
  let mounted = 0, unmounted = 0, setScroll;
  let usage = { screenTime: [], tracked: ['YouTube'], limits: {}, week: [], trackedToday: 0, totalToday: 0, loading: false };
  const pro = { coins: 150, streakFreezes: 1 };
  const Shop = ({ visible }) => {
    const [scrollY, changeScroll] = React.useState(0);
    setScroll = changeScroll;
    React.useEffect(() => { mounted += 1; return () => { unmounted += 1; }; }, []);
    return React.createElement('shop', { visible, scrollY });
  };
  const renderSlot = (slot) => React.isValidElement(slot) ? slot : typeof slot === 'function' ? React.createElement(slot) : null;
  const FlatList = (props) => React.createElement('list', null, renderSlot(props.ListHeaderComponent), renderSlot(props.ListEmptyComponent), renderSlot(props.ListFooterComponent));
  const mocks = {
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', FlatList, Image: 'Image', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (styles) => styles }, NativeModules: {}, Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) } },
    '../hooks/useTabScrollReset': { useTabScrollReset() {} },
    '../context/ThemeContext': { useThemedStyles: (factory) => factory(theme.DEFAULT_PALETTE), useTheme: () => theme.DEFAULT_PALETTE },
    '../context/AuthContext': { useAuth: () => ({ fbUser: { displayName: 'Test User' } }) },
    '../context/ProContext': { usePro: () => pro },
    './ShopScreen': { ShopScreen: Shop },
    '../hooks/usePause': { usePause: () => ({ paused: false, remaining: '' }), resumeMonitoring() {} },
    '../hooks/useScreenTime': { useScreenTime: () => usage, todayKey: () => '2026-11-01', formatMinutes: (minutes) => `${minutes}m` },
    '../components/AppIcon': { AppIcon: 'AppIcon' },
  };
  const filename = path.resolve(__dirname, '../src/screens/HomeScreen.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => name.endsWith('.png') ? 1 : mocks[name] ?? require(name.startsWith('.') ? path.resolve(path.dirname(filename), name) : name);
  vm.runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename })(localRequire, module, module.exports);
  const props = { stats: { currentStreak: 0, level: 1, currentXP: 0, bestReactionTime: 0, totalChallenges: 0 }, history: [], dailyChallengeLimit: 5, challengeTimeZone: 'UTC', onNavigate() {} };
  let renderer;
  try {
    await act(async () => { renderer = create(React.createElement(module.exports.HomeScreen, props)); });
    await act(async () => { renderer.root.findAllByType('TouchableOpacity')[0].props.onPress(); });
    await act(async () => { setScroll(240); });
    assert.equal(renderer.root.findByType('shop').props.visible, true);
    for (let i = 0; i < 3; i++) {
      usage = { ...usage, totalToday: 40 + i, screenTime: [{ app: 'Messages', minutes: 40 + i }] };
      pro.coins += 10;
      await act(async () => { renderer.update(React.createElement(module.exports.HomeScreen, { ...props })); });
      assert.equal(renderer.root.findByType('shop').props.scrollY, 240);
    }
    assert.equal(mounted, 1);
    assert.equal(unmounted, 0);
  } finally { if (renderer) await act(async () => { renderer.unmount(); }); }
});
