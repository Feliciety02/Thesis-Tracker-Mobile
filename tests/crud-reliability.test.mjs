import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const saveStart = html.indexOf("const SAVE_FAILED = Symbol('save failed');");
const saveEnd = html.indexOf('\n/* =========================================================', saveStart);
const flushStart = html.indexOf('function flushOutbox(');
assert.ok(saveStart > 0 && saveEnd > saveStart && flushStart > 0);

test('a rejected create keeps its form and data for retry', async () => {
  let renders = 0, reloads = 0;
  const ctx = vm.createContext({
    DEMO: false, navigator: { onLine: true }, S: {},
    outbox: () => [], call: async () => { throw new Error('Server rejected the expense'); },
    persist: () => {}, render: () => { renders++; }, isTyping: () => false,
    toast: () => {}, load: () => { reloads++; }, setTimeout: () => {},
  });
  vm.runInContext(html.slice(saveStart, saveEnd), ctx);
  const result = await ctx.save('addSupply', [{ item: 'Markers' }], null, () => ({ tempId: 'tmp1' }));
  assert.equal(typeof result, 'symbol');
  assert.equal(renders, 0, 'the create flow does not redraw the form before confirmation');
  assert.equal(reloads, 0, 'a rejected create does not replace the form');
});

test('outbox preserves a rejected write and blocks a different signed-in user', async () => {
  const writes = [{ fn: 'addSupply', args: [{ item: 'Markers' }], user: 'Fe Anne', at: 1 }];
  let calls = 0;
  const ctx = vm.createContext({
    flushing: null, DEMO: false, navigator: { onLine: true }, S: { user: 'Fe Anne', data: {} },
    outbox: () => writes.map(x => ({ ...x })),
    setOutbox: next => { writes.splice(0, writes.length, ...next); },
    updateSyncChip: () => {}, call: async () => { calls++; throw new Error('Category rejected'); },
    toast: () => {}, persist: () => {},
  });
  vm.runInContext(html.slice(flushStart, saveStart), ctx);
  await ctx.flushOutbox();
  assert.equal(calls, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].error, 'Category rejected');
  await ctx.flushOutbox();
  assert.equal(calls, 1, 'automatic retries pause until the user asks to retry');
  ctx.S.user = 'Rho';
  await ctx.flushOutbox(true);
  assert.equal(calls, 1, 'another account cannot send the original user’s change');
  assert.match(writes[0].error, /Sign in as Fe Anne/);
});
