import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('async function saveExpenseChanges(');
const end = html.indexOf('\nfunction vSupplies()', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);

function setup(call, online = true) {
  const writes = [], notices = [];
  const item = { row: 9, item: 'Old item', qty: 1, cost: 10, bought: false };
  const S = { data: { supplies: [item] }, open: { exp_9: true }, user: 'Fe Anne' };
  const ctx = vm.createContext({
    S, DEMO: false, navigator: { onLine: online }, call,
    outbox: () => writes, setOutbox: next => writes.splice(0, writes.length, ...next),
    persist: () => {}, render: () => {}, toast: message => notices.push(message),
    setTimeout: () => {}, checkLive: () => {}, load: () => {},
  });
  vm.runInContext(source, ctx);
  return { ctx, S, writes, notices };
}

test('expense editor falls back to the deployed single-field API', async () => {
  const calls = [];
  const app = setup(async (fn, ...args) => {
    calls.push([fn, ...args]);
    if (fn === 'updateSupplyDetails') throw new Error('Unknown action: updateSupplyDetails');
    return true;
  });
  assert.equal(await app.ctx.saveExpenseChanges(9, { item: 'New item', qty: 2, cost: 10, bought: true }), true);
  assert.deepEqual(calls.map(c => c[0]), ['updateSupplyDetails', 'updateSupply', 'updateSupply', 'updateSupply']);
  assert.equal(app.S.data.supplies[0].item, 'New item');
  assert.equal(app.S.open.exp_9, false);
});

test('offline expense edits enter the existing ordered outbox', async () => {
  const app = setup(() => { throw new Error('Server called offline'); }, false);
  assert.equal(await app.ctx.saveExpenseChanges(9, { item: 'New item', qty: 2 }), true);
  assert.deepEqual(app.writes.map(job => [job.fn, job.args[2]]), [
    ['updateSupply', 'New item'], ['updateSupply', 2],
  ]);
  assert.equal(app.S.data.supplies[0].qty, 2);
});
