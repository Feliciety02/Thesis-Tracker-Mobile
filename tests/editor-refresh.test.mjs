import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return html.slice(a, b);
}
const source = section('function load(quiet)', 'function setOffline(') + '\n' +
  section('function isTyping()', 'function persist()');

function setup(fetchData) {
  let editorOpen = true;
  let renders = 0;
  const S = { data: { samples: [] }, view: 'supplies', galleryRecoveryChecked: true };
  const fresh = { samples: [], supplies: [{ row: 9, item: 'Paper' }], photoAngles: [] };
  const document = {
    activeElement: { tagName: 'BODY', matches: () => false },
    querySelector: () => editorOpen ? {} : null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const context = vm.createContext({
    S, document, window: {},
    flushOutbox: async () => {}, outbox: () => [], call: fetchData || (async () => fresh),
    setOffline: () => {}, persist: () => {}, render: () => { renders++; },
    renderCam: () => {}, nativeUploadAvailable: () => false,
    setTimeout: () => {}, cached: () => null, lock: () => {}, esc: x => x,
  });
  vm.runInContext(source, context);
  return { S, context, fresh, setEditorOpen: value => { editorOpen = value; }, get renders() { return renders; } };
}

test('a background refresh waits to apply data until the expense editor closes', async () => {
  const app = setup();
  const before = app.S.data;
  await app.context.load(true);
  assert.equal(app.S.data, before);
  assert.equal(app.renders, 0);
  assert.equal(app.S.refreshPending, true);
  app.setEditorOpen(false);
  await app.context.resumeBackgroundUpdate();
  assert.equal(app.S.data, app.fresh);
  assert.equal(app.renders, 1);
});

test('a response started before a local save cannot replace the new data', async () => {
  let resolveFetch;
  const app = setup(() => new Promise(resolve => { resolveFetch = resolve; }));
  app.setEditorOpen(false);
  const before = app.S.data;
  const loading = app.context.load(true);
  await Promise.resolve();
  app.S.localWriteSeq = 1;
  resolveFetch(app.fresh);
  await loading;
  assert.equal(app.S.data, before);
  assert.equal(app.S.refreshPending, true);
  assert.equal(app.renders, 0);
});

test('a selected dropdown blocks an automatic redraw', () => {
  const app = setup();
  app.setEditorOpen(false);
  app.context.document.activeElement = { tagName: 'SELECT', matches: selector => selector.includes('select') };
  app.context.renderWhenIdle();
  assert.equal(app.renders, 0);
  assert.equal(app.S.needsRender, true);
});
