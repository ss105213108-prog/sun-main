const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { items.forEach(item => values.add(item)); },
    remove(...items) { items.forEach(item => values.delete(item)); },
    contains(item) { return values.has(item); }
  };
}

function makeElement(id) {
  const listeners = {};
  const attributes = new Map();
  return {
    id,
    value: '',
    textContent: '',
    disabled: false,
    inert: false,
    focused: false,
    autocomplete: '',
    classList: makeClassList(),
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatch(type, event = {}) { return listeners[type]?.(event); },
    focus() { this.focused = true; },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name); }
  };
}

function createHarness(options = {}) {
  const ids = [
    'explorer-gate', 'explorer-gate-title', 'explorer-gate-subtitle',
    'explorer-login-form', 'explorer-account', 'explorer-password',
    'explorer-login-submit', 'explorer-guest-enter', 'explorer-forgot-password',
    'explorer-register', 'explorer-auth-status', 'main-menu-overlay', 'main-menu-new-game'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, makeElement(id)]));
  const timers = [];
  const windowListeners = {};
  const Game = {
    state: 'MENU',
    inCutscene: true,
    timer: { isRunning: true, lastTick: 12 }
  };
  const windowStub = {
    audio: { play() {} },
    addEventListener(type, listener) { windowListeners[type] = listener; },
    dispatchAuth(detail) { windowListeners['sunheart:auth-state']?.({ detail }); }
  };
  for (const name of [
    'authenticateExplorer', 'registerExplorer', 'openExplorerPasswordReset', 'getExplorerAuthSnapshot'
  ]) {
    if (options[name]) windowStub[name] = options[name];
  }
  const context = {
    Game,
    window: windowStub,
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: () => [elements['main-menu-overlay']]
    },
    setTimeout(handler) { timers.push(handler); return timers.length; }
  };
  vm.runInNewContext(fs.readFileSync('js/login-gate.js', 'utf8'), context);
  windowStub.setupExplorerGate();
  return {
    Game,
    window: windowStub,
    elements,
    runTimer() { timers.shift()?.(); }
  };
}

(async () => {
  const guest = createHarness();
  assert.strictEqual(guest.Game.state, 'AUTH_GATE');
  assert.strictEqual(guest.Game.timer.isRunning, false, '入口畫面不可啟動倒數');
  assert.strictEqual(guest.elements['main-menu-overlay'].inert, true, '通過入口前主選單不可操作');
  assert.strictEqual(guest.elements['explorer-account'].focused, true);

  guest.elements['explorer-guest-enter'].dispatch('click');
  assert.strictEqual(guest.Game.isGuest, true);
  assert.strictEqual(guest.Game.state, 'MENU');
  assert.strictEqual(guest.elements['explorer-gate'].classList.contains('is-leaving'), true);
  guest.runTimer();
  assert.strictEqual(guest.elements['explorer-gate'].classList.contains('hidden'), true);
  assert.strictEqual(guest.elements['main-menu-overlay'].inert, false);
  assert.strictEqual(guest.elements['main-menu-new-game'].focused, true);

  const offline = createHarness();
  offline.elements['explorer-account'].value = 'aaron@example.com';
  offline.elements['explorer-password'].value = 'secret1';
  await offline.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  assert.match(offline.elements['explorer-auth-status'].textContent, /認證服務尚未連線/);
  assert.strictEqual(offline.Game.state, 'AUTH_GATE', '沒有後端時不得偽造登入成功');

  const member = createHarness({
    authenticateExplorer: async ({ account, password }) => ({
      ok: account === 'aaron@example.com' && password === 'secret1',
      user: { id: 'explorer-1' }
    })
  });
  member.elements['explorer-account'].value = 'aaron@example.com';
  member.elements['explorer-password'].value = 'secret1';
  await member.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  assert.strictEqual(member.Game.isGuest, false);
  assert.strictEqual(member.Game.authUser.id, 'explorer-1');
  assert.strictEqual(member.Game.state, 'MENU');

  const registration = createHarness({
    registerExplorer: async () => ({
      ok: true,
      confirmationRequired: true,
      message: '如果此電子信箱可以建立帳號，驗證信將寄到你的信箱。'
    })
  });
  registration.elements['explorer-register'].dispatch('click');
  assert.strictEqual(registration.elements['explorer-gate-title'].textContent, '建立探勘紀錄');
  assert.strictEqual(registration.elements['explorer-password'].autocomplete, 'new-password');
  registration.elements['explorer-account'].value = 'new@example.com';
  registration.elements['explorer-password'].value = 'secret1';
  await registration.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  assert.match(registration.elements['explorer-auth-status'].textContent, /如果此電子信箱/);
  assert.strictEqual(registration.elements['explorer-login-submit'].textContent, '載入探勘紀錄');
  assert.strictEqual(registration.elements['explorer-password'].value, '');
  assert.strictEqual(registration.Game.state, 'AUTH_GATE');

  let resolveLogin;
  let loginCalls = 0;
  const locked = createHarness({
    authenticateExplorer: () => {
      loginCalls += 1;
      return new Promise(resolve => { resolveLogin = resolve; });
    }
  });
  locked.elements['explorer-account'].value = 'user@example.com';
  locked.elements['explorer-password'].value = 'secret1';
  const firstSubmit = locked.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  const secondSubmit = locked.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  assert.strictEqual(loginCalls, 1, 'loading lock must prevent duplicate auth requests');
  resolveLogin({ ok: false, message: '登入失敗' });
  await Promise.all([firstSubmit, secondSubmit]);
  assert.strictEqual(locked.elements['explorer-login-submit'].disabled, false);

  const restoredUser = { id: 'restored-user' };
  const restored = createHarness({
    getExplorerAuthSnapshot: () => ({
      initializing: false,
      session: { user: restoredUser },
      lastEvent: 'INITIAL_SESSION'
    })
  });
  assert.strictEqual(restored.Game.isGuest, false);
  assert.strictEqual(restored.Game.authUser, restoredUser);
  restored.runTimer();
  assert.strictEqual(restored.elements['explorer-gate'].classList.contains('hidden'), true);

  restored.window.dispatchAuth({ initializing: false, session: null, lastEvent: 'SIGNED_OUT' });
  assert.strictEqual(restored.Game.state, 'AUTH_GATE');
  assert.strictEqual(restored.Game.authUser, null);
  assert.strictEqual(restored.elements['explorer-gate'].classList.contains('hidden'), false);
  assert.match(restored.elements['explorer-auth-status'].textContent, /安全登出/);

  const reset = createHarness({
    openExplorerPasswordReset: async () => ({
      ok: true,
      message: '如果此電子信箱已註冊，密碼重設信將寄到你的信箱。'
    })
  });
  reset.elements['explorer-account'].value = 'user@example.com';
  await reset.elements['explorer-forgot-password'].dispatch('click');
  assert.match(reset.elements['explorer-auth-status'].textContent, /如果此電子信箱/);

  const invalid = createHarness({ authenticateExplorer: async () => ({ ok: true }) });
  invalid.elements['explorer-account'].value = 'not-an-email';
  invalid.elements['explorer-password'].value = 'secret1';
  await invalid.elements['explorer-login-form'].dispatch('submit', { preventDefault() {} });
  assert.match(invalid.elements['explorer-auth-status'].textContent, /格式不正確/);

  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('css/style.css', 'utf8');
  const puzzle = fs.readFileSync('js/puzzle.js', 'utf8');
  assert.match(html, /id="explorer-gate"/);
  assert.match(html, /探勘者登錄/);
  assert.match(html, /以訪客身分進入/);
  assert.match(html, /type="module" src="\/js\/backend-bootstrap\.js"/);
  assert.match(css, /\.explorer-login-tablet/);
  assert.match(puzzle, /window\.setupExplorerGate\?\.\(\)/);

  console.log('login, register, session, logout, reset, and guest gate regression tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
