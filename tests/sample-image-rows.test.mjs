import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/WebApp.gs', import.meta.url), 'utf8');
const blank = () => Array(16).fill('');

function fakeSheet() {
  const rows = Array.from({ length: 30 }, blank);
  const formulas = Array.from({ length: 30 }, blank);
  const sheet = {
    rows, formulas,
    getMaxRows: () => rows.length,
    getLastRow: () => Math.max(3, rows.findLastIndex(r => r.some(v => v !== '' && v !== false)) + 1),
    insertRowsBefore(row, count) {
      if (arguments.length !== 2 || !Number.isInteger(count)) throw new Error('insertRowsBefore requires a position and count');
      rows.splice(row - 1, 0, ...Array.from({ length: count }, blank));
      formulas.splice(row - 1, 0, ...Array.from({ length: count }, blank));
    },
    insertRowsAfter(row, count = 1) { rows.splice(row, 0, ...Array.from({ length: count }, blank)); formulas.splice(row, 0, ...Array.from({ length: count }, blank)); },
    deleteRows(row, count) { rows.splice(row - 1, count); formulas.splice(row - 1, count); },
    setRowHeight() {},
    getRange(row, col, height = 1, width = 1) {
      const range = {
        getValues: () => Array.from({ length: height }, (_, i) => rows[row - 1 + i].slice(col - 1, col - 1 + width)),
        getFormulas: () => Array.from({ length: height }, (_, i) => formulas[row - 1 + i].slice(col - 1, col - 1 + width)),
        getValue: () => rows[row - 1][col - 1],
        setValue(v) { rows[row - 1][col - 1] = v; return this; },
        setValues(values) { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) rows[row - 1 + i][col - 1 + j] = values[i][j]; return this; },
        setFormula(v) { formulas[row - 1][col - 1] = v; rows[row - 1][col - 1] = 'Open image'; return this; },
        setFormulaR1C1(v) { formulas[row - 1][col - 1] = v; return this; },
        clearContent() { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) { rows[row - 1 + i][col - 1 + j] = ''; formulas[row - 1 + i][col - 1 + j] = ''; } return this; },
        insertCheckboxes() { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) rows[row - 1 + i][col - 1 + j] = false; return this; },
      };
      for (const method of ['clearDataValidations', 'setNumberFormat', 'setBackground', 'setFontColor', 'setFontWeight', 'setHorizontalAlignment', 'setDataValidation']) range[method] = () => range;
      return range;
    },
  };
  return sheet;
}

function contextFor(sheet, taskSheet = null) {
  const ss = { getSheetByName: name => name === 'DA RCPC Samples' ? sheet : name === 'Fe Anne' ? taskSheet : null, getSpreadsheetTimeZone: () => 'Asia/Manila', getUrl: () => 'https://docs.google.com/spreadsheets/d/test' };
  const props = new Map();
  const ctx = vm.createContext({
    console,
    CFG: { title: 'Tracker', thesisTitle: 'Test', maxRows: 20, classes: ['Healthy'], expenseCategories: ['Sample collection', 'Printing', 'Transport', 'Other'], photoAngles: ['Whole leaf', 'Left side only', 'Top lesions', 'Right side only', 'Back in different light'],
      members: [{ tab: 'Fe Anne', prefix: 'FA', light: '#eee' }, { tab: 'Rho', prefix: 'RJ', light: '#eee' }] },
    RECORDS: { sources: { tab: 'Dataset Sources', fields: [['name', 'Name', 'text'], ['cordana', 'Cordana', 'num'], ['by', 'By', 'text']] } },
    SETTINGS: { leafGoal: 'number', classGoal: 'number', defenseDate: 'date', collectionDate: 'date' },
    LINKS: {},
    SpreadsheetApp: { getActive: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) || '', setProperty: (key, value) => props.set(key, value), deleteProperty: key => props.delete(key) }) },
  });
  vm.runInContext(source, ctx);
  ctx.sheet_ = name => ss.getSheetByName(name) || sheet;
  ctx.memberSheet_ = tab => ss.getSheetByName(tab) || sheet;
  ctx.withLock_ = fn => fn();
  ctx.listRule_ = () => ({});
  ctx.photoFilesFor_ = () => [];
  ctx.sampleFolder_ = () => null;
  ctx.readActivity_ = () => [];
  ctx.photoRootUrl_ = () => '';
  ctx.folderUrl_ = () => '';
  ctx.readRecords_ = () => ({});
  ctx.currentVersion_ = () => '0';
  ctx.fmtDate_ = value => value ? '2026-11-09' : '';
  return ctx;
}

test('five image rows stay beneath their parent without overwriting the next sample', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  sh.rows[4][0] = 'RJ-001';
  const app = contextFor(sh);
  app.ensureSampleImageRows_(sh, 'FA-001');
  assert.equal(sh.rows[9][0], 'RJ-001');
  assert.deepEqual(sh.rows.slice(4, 9).map(r => r[6]), ['FA-001_01.jpg', 'FA-001_02.jpg', 'FA-001_03.jpg', 'FA-001_04.jpg', 'FA-001_05.jpg']);
  const length = sh.rows.length;
  app.ensureSampleImageRows_(sh, 'FA-001');
  assert.equal(sh.rows.length, length);
  sh.rows[10][7] = false; sh.rows[10][8] = false;
  assert.equal(app.createSample('FA-002', '').id, 'FA-002');
  assert.equal(sh.rows[10][0], 'FA-002');
  assert.equal(sh.rows[11][6], 'FA-002_01.jpg');
  assert.equal(sh.rows[10][2], '', 'a reserved label is not a captured leaf');
});

test('the app reads parent samples and their individual image links without counting image rows as samples', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  const app = contextFor(sh);
  const ScriptDate = vm.runInContext('Date', app);
  sh.rows[3][2] = new ScriptDate('2026-11-09T01:00:00Z');
  app.ensureSampleImageRows_(sh, 'FA-001');
  sh.rows[4][2] = new ScriptDate('2026-11-09T01:05:00Z');
  sh.rows[4][13] = 'Open image';
  sh.formulas[4][13] = '=HYPERLINK("https://drive.google.com/file/d/photo1/view","Open image")';
  const data = app.getData();
  assert.equal(data.samples.length, 1);
  assert.equal(data.samples[0].images.length, 5);
  assert.equal(data.samples[0].images[0].name, 'FA-001_01.jpg');
  assert.equal(data.samples[0].images[0].url, 'https://drive.google.com/file/d/photo1/view');
  assert.equal(data.samples[0].images[0].capturedAt, Date.parse('2026-11-09T01:05:00Z'));
});

test('deleting a sample removes its five image rows and keeps the next sample', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  sh.rows[4][0] = 'RJ-001';
  const app = contextFor(sh);
  app.ensureSampleImageRows_(sh, 'FA-001');
  app.deleteSample('FA-001');
  assert.equal(sh.rows[3][0], '');
  assert.equal(sh.rows[4][0], 'RJ-001');
  assert.equal(sh.rows.some(r => String(r[6]).startsWith('FA-001_')), false);
});

test('a failed sample delete keeps its Drive photos', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  const app = contextFor(sh);
  app.ensureSampleImageRows_(sh, 'FA-001');
  const file = { trashed: false, setTrashed(value) { this.trashed = value; } };
  app.photoFilesFor_ = () => [file];
  sh.deleteRows = () => { throw new Error('Sheet unavailable'); };
  assert.throws(() => app.deleteSample('FA-001'), /Sheet unavailable/);
  assert.equal(file.trashed, false);
});

test('deleting one image updates its child row and parent count without touching another view', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  const app = contextFor(sh);
  const ScriptDate = vm.runInContext('Date', app);
  app.ensureSampleImageRows_(sh, 'FA-001');
  sh.rows[3][14] = '1 2'; sh.rows[3][5] = 2; sh.rows[3][2] = new ScriptDate('2026-11-09T01:00:00Z');
  for (const angle of [1, 2]) {
    sh.rows[3 + angle][2] = new ScriptDate('2026-11-09T01:05:00Z');
    sh.rows[3 + angle][13] = 'Open image';
    sh.formulas[3 + angle][13] = `=HYPERLINK("https://drive.google.com/file/d/${angle}/view","Open image")`;
  }
  const files = [1, 2].map(angle => ({ angle, trashed: false, getName: () => `FA-001_0${angle}.jpg`, setTrashed(value) { this.trashed = value; } }));
  app.photoFilesFor_ = () => files.filter(f => !f.trashed);
  const patch = app.deletePhoto('FA-001', 1);
  assert.equal(files[0].trashed, true);
  assert.equal(files[1].trashed, false);
  assert.equal(sh.rows[3][5], 1);
  assert.equal(sh.rows[4][2], '');
  assert.equal(sh.rows[4][13], '');
  assert.equal(sh.rows[5][13], 'Open image');
  assert.deepEqual(Array.from(patch.angles), [2]);
  assert.equal(patch.images[1].url, 'https://drive.google.com/file/d/2/view');
});

test('a failed image delete restores the Drive photo', () => {
  const sh = fakeSheet();
  sh.rows[3][0] = 'FA-001';
  const app = contextFor(sh);
  app.ensureSampleImageRows_(sh, 'FA-001');
  const file = { trashed: false, getName: () => 'FA-001_01.jpg', setTrashed(value) { this.trashed = value; } };
  app.photoFilesFor_ = () => file.trashed ? [] : [file];
  app.withLock_ = () => { throw new Error('Sheet unavailable'); };
  assert.throws(() => app.deletePhoto('FA-001', 1), /Sheet unavailable/);
  assert.equal(file.trashed, false);
});

test('expense edits save together and preserve subtotal and receipt cells', () => {
  const sh = fakeSheet();
  sh.rows[2][0] = 'Old item';
  sh.rows[2][4] = '₱70.00';
  sh.formulas[2][4] = '=C3*D3';
  sh.rows[2][10] = 'Receipt';
  sh.formulas[2][10] = '=HYPERLINK("https://drive.google.com/file/d/receipt/view","Receipt")';
  sh.rows[11][3] = 'TOTAL';
  const app = contextFor(sh);
  assert.equal(app.updateSupplyDetails(3, { item: 'New item', purpose: 'Field trip', qty: 2,
    cost: 35, assigned: 'Fe Anne', bought: true, notes: 'Saved', category: 'Transport', date: '' }), true);
  assert.equal(sh.rows[2][0], 'New item');
  assert.equal(sh.rows[2][5], 'Fe Anne');
  assert.equal(sh.rows[2][6], true);
  assert.equal(sh.formulas[2][4], '=C3*D3');
  assert.match(sh.formulas[2][10], /receipt\/view/);
  assert.throws(() => app.updateSupplyDetails(3, { item: '', qty: 1, cost: 2 }), /Item name/);
  assert.throws(() => app.updateSupplyDetails(3, { item: 'No', qty: -1, cost: 2 }), /cannot be negative/);
});

test('expense create, edit, and delete keep formulas and reject bad input before writing', () => {
  const sh = fakeSheet();
  sh.rows[2][4] = 'subtotal';
  sh.formulas[2][4] = '=C3*D3';
  sh.rows[11][3] = 'TOTAL';
  const app = contextFor(sh);
  assert.throws(() => app.addSupply({ item: 'Bad', qty: -2, category: 'Printing' }), /cannot be negative/);
  assert.equal(sh.rows[2][0], '');
  assert.throws(() => app.addSupply({ item: 'Bad', qty: 1, category: 'Printing', date: '2026-02-30' }), /date does not exist/);
  assert.equal(sh.rows[2][0], '');
  const created = app.addSupply({ item: 'Markers', qty: 2, cost: 25, assigned: 'Fe Anne', category: 'Printing', date: '2026-11-15', bought: false });
  assert.equal(created.row, 3);
  assert.equal(sh.rows[2][0], 'Markers');
  assert.equal(sh.rows[2][2], 2);
  assert.equal(sh.rows[2][3], 25);
  assert.equal(sh.formulas[2][4], '=C3*D3');
  assert.throws(() => app.updateSupplyDetails(3, { item: 'Changed', qty: 1, cost: 2,
    assigned: 'Unknown', category: 'Printing', date: '2026-11-15' }), /valid buyer/);
  assert.equal(sh.rows[2][0], 'Markers', 'failed edit did not change earlier columns');
  assert.equal(app.updateSupply(3, 'cost', 30), true);
  assert.equal(sh.rows[2][3], 30);
  assert.equal(app.deleteSupply(3), true);
  assert.equal(sh.rows[2][0], '');
  assert.equal(sh.formulas[2][4], '=C3*D3');
  assert.throws(() => app.updateSupply(3, 'item', 'Stale write'), /no longer exists/);
});

test('a queued receipt cannot attach to a different expense that reused the row', () => {
  const sh = fakeSheet();
  sh.rows[2][0] = 'New expense';
  sh.rows[11][3] = 'TOTAL';
  const app = contextFor(sh);
  assert.throws(() => app.uploadReceipt(3, 'A'.repeat(120), 'Old expense', '2026-11-15'), /expense changed/);
  assert.equal(sh.rows[2][10], '');
});

test('stale expense edits and deletes cannot touch a reused row', () => {
  const sh = fakeSheet();
  sh.rows[2][0] = 'New expense';
  sh.rows[11][3] = 'TOTAL';
  const app = contextFor(sh);
  assert.throws(() => app.updateSupply(3, 'cost', 99, 'Old expense'), /expense changed/);
  assert.throws(() => app.updateSupplyDetails(3, { item: 'Changed', qty: 1, cost: 99 }, 'Old expense'), /expense changed/);
  assert.throws(() => app.deleteSupply(3, 'Old expense'), /expense changed/);
  assert.equal(sh.rows[2][0], 'New expense');
  assert.equal(sh.rows[2][3], '');
});

test('repeating a create request after a lost response does not add another row', () => {
  const props = new Map();
  const remembered = { getProperty: key => props.get(key) || '', setProperty: (key, value) => props.set(key, value), deleteProperty: key => props.delete(key) };
  const sh = fakeSheet();
  sh.rows[11][3] = 'TOTAL';
  const app = contextFor(sh);
  app.PropertiesService = { getScriptProperties: () => remembered };
  const expense = { item: 'Markers', qty: 2, cost: 25, category: 'Printing', date: '2026-11-15' };
  const first = app.addSupply(expense, 'expense-request-001');
  const retry = app.addSupply(expense, 'expense-request-001');
  assert.equal(first.row, retry.row);
  assert.equal(sh.rows.filter(r => r[0] === 'Markers').length, 1);
  const task = app.addTask('Fe Anne', { task: 'Collect leaves' }, 'task-request-001');
  assert.equal(app.addTask('Fe Anne', { task: 'Collect leaves' }, 'task-request-001').row, task.row);
  assert.equal(sh.rows.filter(r => r[1] === 'Collect leaves').length, 1);
  const record = app.addRecord('sources', { name: 'Dataset' }, 'record-request-001');
  assert.equal(app.addRecord('sources', { name: 'Dataset' }, 'record-request-001').row, record.row);
  assert.equal(sh.rows.filter(r => r[0] === 'Dataset').length, 1);
});

test('task and record writes reject stale rows instead of silently changing empty slots', () => {
  const sh = fakeSheet();
  const app = contextFor(sh);
  const task = app.addTask('Fe Anne', { task: 'Collect leaves', due: '2026-11-15' });
  assert.equal(task.row, 4);
  assert.equal(app.updateTask('Fe Anne', 4, 'task', 'Collect healthy leaves'), true);
  assert.equal(sh.rows[3][1], 'Collect healthy leaves');
  assert.equal(app.deleteTask('Fe Anne', 4), true);
  assert.throws(() => app.updateTask('Fe Anne', 4, 'task', 'Stale edit'), /no longer exists/);

  const record = app.addRecord('sources', { name: 'Dataset', cordana: 10 });
  assert.equal(record.row, 3);
  assert.throws(() => app.updateRecord('sources', 3, 'cordana', 'bad'), /valid number/);
  assert.equal(sh.rows[2][1], 10);
  assert.equal(app.updateRecord('sources', 3, 'cordana', 20).cordana, 20);
  assert.equal(app.deleteRecord('sources', 3), true);
  assert.throws(() => app.updateRecord('sources', 3, 'name', 'Stale edit'), /no longer exists/);
});

test('RCPC task follows the collection date and completing it submits every due team sample', () => {
  const samples = fakeSheet(), tasks = fakeSheet();
  const app = contextFor(samples, tasks);
  const ScriptDate = vm.runInContext('Date', app);
  const yesterday = new ScriptDate(); yesterday.setHours(12, 0, 0, 0); yesterday.setDate(yesterday.getDate() - 1);
  const today = new ScriptDate(); today.setHours(12, 0, 0, 0);
  const iso = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  app.fmtDate_ = iso;
  vm.runInContext("CURRENT_USER = 'Fe Anne'", app);
  samples.rows[3][0] = 'FA-001'; samples.rows[3][2] = yesterday;
  samples.rows[9][0] = 'RJ-001'; samples.rows[9][2] = yesterday;
  samples.rows[15][0] = 'FA-002'; // reserved label has no collected leaf
  samples.rows[21][0] = 'CP-001'; samples.rows[21][2] = today; // a different collection batch
  tasks.rows[3][0] = 'F-11'; tasks.rows[3][1] = 'Submit fresh, labeled samples to DA RCPC Davao'; tasks.rows[3][4] = 'Not Started';

  app.setSetting('collectionDate', iso(yesterday));
  app.autoLinks_();
  assert.equal(iso(tasks.rows[3][5]), iso(today), 'yesterday’s collection is due today');
  vm.runInContext("CURRENT_USER = 'Rho'", app);
  assert.throws(() => app.updateTask('Fe Anne', 4, 'status', 'Done'), /Fe Anne handles/);
  assert.throws(() => app.setSetting('collectionDate', iso(today)), /Fe Anne sets/);
  assert.equal(samples.rows[3][9], '');
  vm.runInContext("CURRENT_USER = 'Fe Anne'", app);
  app.updateTask('Fe Anne', 4, 'status', 'Done');
  assert.ok(samples.rows[3][9] instanceof ScriptDate);
  assert.ok(samples.rows[9][9] instanceof ScriptDate);
  assert.equal(samples.rows[15][9], '', 'an empty reserved label must not be submitted');
  assert.equal(samples.rows[21][9], '', 'another collection date must stay pending');
  assert.equal(app.readSettings_().collectionDate, '', 'completed planning date must be blank');
  app.autoLinks_();
  assert.equal(tasks.rows[3][4], 'Done');

  samples.rows[15][2] = today;
  app.setSetting('collectionDate', iso(today));
  app.autoLinks_();
  const tomorrow = new ScriptDate(today); tomorrow.setDate(tomorrow.getDate() + 1);
  assert.equal(iso(tasks.rows[3][5]), iso(tomorrow));
  assert.equal(tasks.rows[3][4], 'Not Started', 'a new collection reopens the next hand-over');
  assert.throws(() => app.updateTask('Fe Anne', 4, 'status', 'Done'), /day after collection/);
  assert.equal(samples.rows[21][9], '', 'the new batch cannot be submitted on collection day');
  app.setSetting('collectionDate', '');
  app.autoLinks_();
  assert.equal(tasks.rows[3][5], '', 'clearing an active plan removes its task due date');
});

test('batch submission accepts other members’ collected leaves without creating missing samples', () => {
  const sheet = fakeSheet(), app = contextFor(sheet);
  const ScriptDate = vm.runInContext('Date', app);
  const today = new ScriptDate(), yesterday = new ScriptDate(today); yesterday.setDate(yesterday.getDate() - 1);
  const iso = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  app.fmtDate_ = iso;
  sheet.rows[3][0] = 'FA-001'; sheet.rows[3][2] = yesterday;
  sheet.rows[9][0] = 'RJ-001'; sheet.rows[9][2] = yesterday;
  vm.runInContext("CURRENT_USER = 'Fe Anne'", app);
  assert.throws(() => app.submitSamples(['FA-001', 'CP-999'], iso(today)), /not found/);
  assert.equal(sheet.rows[3][9], '', 'invalid batches must not partly save');
  assert.throws(() => app.submitSamples(['FA-001'], iso(yesterday)), /day after collection/);
  app.submitSamples(['FA-001', 'RJ-001'], iso(today));
  assert.ok(sheet.rows[3][9] instanceof ScriptDate);
  assert.ok(sheet.rows[9][9] instanceof ScriptDate);
  vm.runInContext("CURRENT_USER = 'Rho'", app);
  assert.throws(() => app.submitSamples(['FA-001'], iso(today)), /Fe Anne handles/);
});
