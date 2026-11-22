import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('async function call(fn, ...args) {');
const end = html.indexOf('/* ---------- sample data', start);
assert.ok(start >= 0 && end > start);
const source = html.slice(start, end) + '\ncall;';

function makeCall(fetch, online = true, timer = setTimeout) {
  return runInNewContext(source, {
    DEMO: false, API_URL: 'https://script.google.com/macros/s/test/exec',
    TOKEN_STORE: 'bt:token', store: { get: () => '' }, navigator: { onLine: online },
    fetch, AbortController, setTimeout: timer, clearTimeout,
  });
}

test('a transport failure during sign-in never claims the password is wrong', async () => {
  const call = makeCall(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(call('authLogin', 'member@example.com', 'correct-password'), error =>
    error.network && /password was not rejected/.test(error.message) && !/setup error/.test(error.message));
});

test('a slow sign-in ends with a retryable message', async () => {
  const call = makeCall((_, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }), true, callback => { queueMicrotask(callback); return 1; });
  await assert.rejects(call('authLogin', 'member@example.com', 'correct-password'), error =>
    error.network && /took too long/.test(error.message) && /password was not rejected/.test(error.message));
});

test('an actual wrong password stays an authentication error', async () => {
  const call = makeCall(async () => ({ json: async () => ({ ok: false, error: 'Wrong password.' }) }));
  await assert.rejects(call('authLogin', 'member@example.com', 'wrong-password'), error =>
    error.message === 'Wrong password.' && !error.network);
});

test('connection abort and timeout are retried without a permanent upload alert', () => {
  const from = html.indexOf('function retryableUploadError(message) {');
  const to = html.indexOf('\n}', from);
  assert.ok(from >= 0 && to > from);
  const retryable = runInNewContext(html.slice(from, to + 2) + '\nretryableUploadError;');
  for (const message of ['Software caused connection abort', 'timeout', 'HTTP 503'])
    assert.equal(retryable(message), true, message);
  assert.equal(retryable('Google Drive access is not authorized.'), false);
});

test('first data load retries once after a dropped connection', async () => {
  const from = html.indexOf('let initialLoadRetries = 0;');
  const to = html.indexOf('function setOffline(', from);
  assert.ok(from >= 0 && to > from);
  const app = { innerHTML: '' };
  const state = { user: 'Fe Anne', data: null };
  let calls = 0;
  const load = runInNewContext(html.slice(from, to) + '\nload;', {
    S: state, flushOutbox: async () => {}, outbox: () => [],
    call: async () => {
      if (++calls === 1) { const error = new Error('connection lost'); error.network = true; throw error; }
      return { samples: [], settings: {}, photoAngles: [] };
    },
    cached: () => null, navigator: { onLine: true }, document: { getElementById: () => app },
    setTimeout: callback => { queueMicrotask(callback); return 1; },
    setOffline: () => {}, persist: () => {}, render: () => {}, renderWhenIdle: () => {},
    nativeUploadAvailable: () => false, window: {}, MAX_ANGLES: 5,
  });
  await load(false);
  assert.equal(calls, 2);
  assert.ok(state.data);
  assert.match(app.innerHTML, /Trying again/);
});
