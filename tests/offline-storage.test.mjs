import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'app section exists');
  return html.slice(first, last);
}
const source = [
  section('const store = {', 'function cached()'),
  section("const OUTBOX = 'bt:outbox';", 'const SPIN ='),
  section("const SAVE_FAILED = Symbol('save failed');", '/* ========================================================='),
].join('\n');

test('failed phone storage never claims an offline edit was saved', async () => {
  const notices = [];
  const state = { user: 'Fe Anne', data: { samples: [{ id: 'FA-001', notes: 'original' }] } };
  const app = runInNewContext(source + '\n({ save, SAVE_FAILED, store, outbox });', {
    localStorage: { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} },
    S: state, navigator: { onLine: false }, DEMO: false,
    updateSyncChip: () => {}, persist: () => {}, renderWhenIdle: () => {},
    toast: message => notices.push(message),
  });
  assert.equal(app.store.set('test', 'value'), false);
  const result = await app.save('updateSample', ['FA-001', 'notes', 'changed'],
    () => { state.data.samples[0].notes = 'changed'; });
  assert.equal(result, app.SAVE_FAILED);
  assert.equal(state.data.samples[0].notes, 'original');
  assert.equal(app.outbox().length, 0);
  assert.match(notices.join(' '), /Could not save on this phone/);
  assert.doesNotMatch(notices.join(' '), /Saved on this phone/);
});

test('a sign-in cannot appear successful when its token cannot be stored', () => {
  const state = { auth: { step: 'password' } };
  let signedIn = false;
  const app = runInNewContext(section('function finishSignIn(r)', 'function logout()') + '\n({ finishSignIn });', {
    store: { set: () => false, del: () => {} }, TOKEN_STORE: 'token', ACCT_STORE: 'account',
    S: state, signIn: () => { signedIn = true; },
  });
  assert.throws(() => app.finishSignIn({ token: 'token', user: 'Fe Anne' }), /Could not save sign-in/);
  assert.equal(signedIn, false);
  assert.equal(state.auth.step, 'password');
});
