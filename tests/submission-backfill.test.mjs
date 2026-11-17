import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function sheetCandidates()');
const end = html.indexOf('\nfunction sheetHtml()', start);
assert.ok(start > 0 && end > start);

test('submission list can backfill a sample after its deadline', () => {
  const ctx = vm.createContext({ S: { data: { samples: [
    { id: 'RJ-001', date: '2026-11-15', submitted: '' },
    { id: 'CP-001', date: '2026-11-15', submitted: '2026-11-16' },
  ] } } });
  vm.runInContext(html.slice(start, end), ctx);
  assert.deepEqual(Array.from(ctx.sheetCandidates(), x => x.id), ['RJ-001']);
});
