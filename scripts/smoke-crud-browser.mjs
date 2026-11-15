import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const edge = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!edge) throw new Error('Microsoft Edge is required for this local browser smoke test');

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''));
const folder = mkdtempSync(join(tmpdir(), 'tracker-crud-smoke-'));
const testScript = `<script>
(async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 250));
  try {
    S.data = Demo.getData();
    signIn('Fe Anne');
    S.view = 'supplies'; S.addExpOpen = true; render();
    const form = document.getElementById('addSupply');
    form.item.value = 'Browser smoke markers';
    form.qty.value = '2'; form.cost.value = '25';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    let expense = S.data.supplies.find(x => x.item === 'Browser smoke markers');
    if (!expense) throw new Error('Add expense failed');
    S.open['exp_' + expense.row] = true; render();
    let card = document.querySelector('[data-expense-edit="' + expense.row + '"]');
    if (!card) throw new Error('Expense edit form did not open');
    card.querySelector('[data-field="item"]').value = 'Browser smoke edited';
    card.querySelector('[data-action="saveExpense"]').click();
    await wait();
    expense = S.data.supplies.find(x => x.row === expense.row);
    if (!expense || expense.item !== 'Browser smoke edited') throw new Error('Edit expense failed');
    window.confirm = () => true;
    S.open['exp_' + expense.row] = true; render();
    card = document.querySelector('[data-expense-edit="' + expense.row + '"]');
    card.querySelector('[data-action="delSupply"]').click();
    await wait();
    if (S.data.supplies.some(x => x.row === expense.row)) throw new Error('Delete expense failed');
    S.view = 'tasks'; S.addTaskOpen = true; render();
    const taskForm = document.getElementById('addForm');
    taskForm.task.value = 'Browser smoke task';
    taskForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    const taskOwner = S.data.members.find(m => m.tasks.some(t => t.task === 'Browser smoke task'));
    if (!taskOwner) throw new Error('Add task failed');
    const task = taskOwner.tasks.find(t => t.task === 'Browser smoke task');
    S.editTask = taskOwner.tab + '_' + task.row; render();
    const taskEdit = document.querySelector('[data-change="task"][data-row="' + task.row + '"][data-field="task"]');
    if (!taskEdit) throw new Error('Task edit form did not open');
    taskEdit.value = 'Browser smoke task edited';
    taskEdit.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    if (task.task !== 'Browser smoke task edited') throw new Error('Edit task failed');
    S.editTask = taskOwner.tab + '_' + task.row; render();
    document.querySelector('[data-action="delTask"][data-row="' + task.row + '"]').click();
    await wait();
    if (taskOwner.tasks.some(t => t.row === task.row)) throw new Error('Delete task failed');
    S.view = 'more'; S.more = 'sources'; S.addRec = 'sources'; render();
    const recordForm = document.querySelector('form.recform[data-kind="sources"]');
    recordForm.elements.namedItem('name').value = 'Browser smoke source';
    recordForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await wait();
    const record = S.data.records.sources.find(x => x.name === 'Browser smoke source');
    if (!record) throw new Error('Add record failed');
    S.open['sources_' + record.row] = true; render();
    const edit = document.querySelector('[data-change="rec"][data-kind="sources"][data-row="' + record.row + '"][data-field="name"]');
    edit.value = 'Browser smoke source edited';
    edit.dispatchEvent(new Event('change', { bubbles: true }));
    await wait();
    if (record.name !== 'Browser smoke source edited') throw new Error('Edit record failed');
    S.open['sources_' + record.row] = true; render();
    document.querySelector('[data-action="recDel"][data-kind="sources"][data-row="' + record.row + '"]').click();
    await wait();
    if (S.data.records.sources.some(x => x.row === record.row)) throw new Error('Delete record failed');
    const sample = S.data.samples.find(x => ownerOf(x.id) === S.user);
    if (!sample) throw new Error('No sample available for deletion failure check');
    const phoneQueue = new Map();
    PhotoQ.put = async (key, job) => { phoneQueue.set(key, job); };
    PhotoQ.get = async key => phoneQueue.get(key);
    PhotoQ.all = async () => [...phoneQueue.values()];
    PhotoQ.delStrict = async key => { phoneQueue.delete(key); };
    const sampleJob = { id: sample.id, angle: 1, owner: S.user, b64: 'A'.repeat(120), at: Date.now() };
    await PhotoQ.put(sample.id + '_1', sampleJob);
    const expenseToKeep = S.data.supplies.find(x => x.row > 0);
    if (!expenseToKeep) throw new Error('No expense available for deletion failure check');
    const receiptJob = { kind: 'receipt', key: receiptKey(expenseToKeep.row), row: expenseToKeep.row,
      owner: S.user, b64: 'A'.repeat(120), at: Date.now() };
    await PhotoQ.put(receiptJob.key, receiptJob);
    const realCall = call;
    call = async (fn, ...args) => {
      if (fn === 'deleteSample' || fn === 'deleteSupply') throw new Error('Server rejected deletion');
      if (fn === 'uploadPhoto' || fn === 'uploadReceipt') {
        const error = new Error('Offline'); error.network = true; throw error;
      }
      return realCall(fn, ...args);
    };
    const clickDelete = (action, attrs) => {
      const button = document.createElement('button'); button.dataset.action = action;
      Object.assign(button.dataset, attrs); document.body.append(button); button.click(); button.remove();
    };
    clickDelete('delSample', { id: sample.id });
    await wait(); await wait();
    if (!await PhotoQ.get(sample.id + '_1')) throw new Error('Failed sample delete lost queued photo');
    clickDelete('delSupply', { row: String(expenseToKeep.row) });
    await wait(); await wait();
    if (!await PhotoQ.get(receiptJob.key)) throw new Error('Failed expense delete lost queued receipt');
    S.user = 'Rho';
    await queueUpload({ id: 'FA-998', angle: 1, owner: 'Fe Anne', b64: 'A'.repeat(120), at: Date.now() });
    if (S.waiting['FA-998_1'] || S.uploading['FA-998_1']) throw new Error('Other user photo was scheduled');
    S.user = 'Fe Anne';
    call = realCall;
    document.body.dataset.smoke = 'PASS';
  } catch (e) { document.body.dataset.smoke = 'FAIL: ' + (e.message || e); }
})();
</script>`;

try {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  writeFileSync(join(folder, 'index.html'), html.replace('</body>', testScript + '\n</body>'));
  writeFileSync(join(folder, 'config.js'), "window.TRACKER_API_URL = '';\n");
  const result = spawnSync(edge, [
    '--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--virtual-time-budget=7000', '--user-data-dir=' + join(folder, 'profile'),
    '--dump-dom', pathToFileURL(join(folder, 'index.html')).href,
  ], { encoding: 'utf8', timeout: 20000, maxBuffer: 5_000_000, windowsHide: true });
  if (result.error) throw result.error;
  const match = result.stdout.match(/<body[^>]*data-smoke="([^"]+)"/);
  assert.ok(match, 'browser did not finish the CRUD smoke flow: ' + result.stdout.slice(-600));
  assert.equal(match[1], 'PASS');
  console.log('Browser CRUD smoke passed: create/edit/delete and rejected deletes preserve queued photos');
} finally {
  const target = resolve(folder), base = resolve(tmpdir());
  if (target.startsWith(base + sep) && target.includes('tracker-crud-smoke-')) rmSync(target, { recursive: true, force: true });
}
