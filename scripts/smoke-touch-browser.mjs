import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = mkdtempSync(join(tmpdir(), 'tracker-touch-smoke-'));
const errors = [];

try {
  writeFileSync(join(folder, 'index.html'), readFileSync(join(root, 'index.html')));
  writeFileSync(join(folder, 'config.js'), "window.TRACKER_API_URL = '';\n");
  const options = process.platform === 'win32' && (
    existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ||
    existsSync('C:/Program Files/Microsoft/Edge/Application/msedge.exe')
  ) ? { channel: 'msedge' } : {};
  const browser = await chromium.launch({ ...options, headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(pathToFileURL(join(folder, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.getElementById('install').hidden = true;
      S.data = Demo.getData(); signIn('Fe Anne'); S.view = 'supplies'; render();
    });

    await page.locator('[data-action="fabAdd"][data-v="exp"]').tap();
    await page.locator('#addSupply [name="item"]').fill('Touch smoke expense');
    await page.locator('#addSupply [name="category"]').tap();
    assert.equal(await page.locator('#addSupply [name="item"]').inputValue(), 'Touch smoke expense');
    await page.locator('#addSupply [name="category"]').selectOption({ label: 'Printing' });
    await page.locator('#addSupply [name="cost"]').tap();
    await page.locator('#addSupply [name="cost"]').fill('25');
    await page.locator('#addSupply button[type="submit"]').tap();
    await page.waitForFunction(() => S.data.supplies.some(item => item.item === 'Touch smoke expense'));
    assert.equal(await page.evaluate(() => S.addExpOpen), false);

    await page.locator('.exlist .exc').filter({ hasText: 'Touch smoke expense' }).locator('[data-action="toggleCard"]').last().tap();
    const edit = page.locator('.exlist [data-expense-edit]');
    await edit.locator('[data-field="item"]').tap();
    await edit.locator('[data-field="item"]').fill('Touch smoke expense edited');
    await edit.locator('[data-field="category"]').tap();
    assert.equal(await edit.locator('[data-field="item"]').inputValue(), 'Touch smoke expense edited');
    await edit.locator('[data-action="saveExpense"]').tap();
    await page.waitForFunction(() => S.data.supplies.some(item => item.item === 'Touch smoke expense edited'));

    await page.evaluate(() => { S.view = 'tasks'; S.addTaskOpen = true; render(); });
    await page.locator('#addForm [name="task"]').fill('Touch smoke task');
    await page.locator('#addForm [name="tab"]').tap();
    assert.equal(await page.locator('#addForm [name="task"]').inputValue(), 'Touch smoke task');
    await page.locator('#addForm [name="category"]').tap();
    await page.locator('#addForm button[type="submit"]').tap();
    await page.waitForFunction(() => S.data.members.some(member => member.tasks.some(task => task.task === 'Touch smoke task')));
    assert.equal(await page.evaluate(() => S.addTaskOpen), false);

    const status = page.locator('#taskList select.status').first();
    await status.tap();
    await status.selectOption('In Progress');
    assert.equal(await page.locator('#taskList select.status').first().inputValue(), 'In Progress');

    await page.evaluate(() => { S.view = 'more'; S.more = 'sources'; render(); });
    await page.locator('[data-action="addRec"][data-v="sources"]').tap();
    await page.locator('form.recform[data-kind="sources"] [name="name"]').fill('Touch smoke source');
    await page.locator('form.recform[data-kind="sources"] [name="type"]').tap();
    assert.equal(await page.locator('form.recform[data-kind="sources"] [name="name"]').inputValue(), 'Touch smoke source');
    await page.locator('form.recform[data-kind="sources"] button[type="submit"]').tap();
    await page.waitForFunction(() => S.data.records.sources.some(source => source.name === 'Touch smoke source'));

    await page.evaluate(() => {
      const yesterday = addDays(localDay(), -1);
      S.data.samples = ['FA-900', 'RJ-900', 'CP-900'].map(id => ({ id, row: 0, date: yesterday,
        site: 'Test farm', by: ownerOf(id), angles: [1, 2, 3, 4, 5], bagged: true,
        submitted: '', validated: '', notes: '' }));
      S.sampleFilter = null; S.view = 'samples'; render();
    });
    assert.equal(await page.locator('[data-change="smpWho"]').inputValue(), 'All');
    assert.equal(await page.locator('.smp').count(), 3);
    assert.equal(await page.getByText('Before the farm').count(), 0);
    assert.equal(await page.locator('[data-action="smpSent"]').count(), 0);
    const yesterday = await page.evaluate(() => addDays(localDay(), -1));
    await page.locator('[data-change="collectionPlan"]').fill(yesterday);
    await page.waitForFunction(() => collectionPlanDate() === addDays(localDay(), -1) && rcpcSubmissionTask().due === localDay());
    page.on('dialog', dialog => dialog.accept());
    await page.locator('[data-change="rcpcDone"]').tap();
    await page.waitForFunction(() => S.data.samples.every(sample => sample.submitted && stageOf(sample) === 'waiting'));
    await page.waitForFunction(() => collectionPlanDate() === '');
    assert.equal(await page.locator('[data-change="collectionPlan"]').inputValue(), '');

    await page.evaluate(() => {
      S.data.samples.forEach(sample => { sample.submitted = ''; });
      const task = rcpcSubmissionTask(); task.status = 'Not Started'; task.completed = '';
      S.view = 'samples'; render();
    });
    await page.locator('[data-change="collectionPlan"]').fill(yesterday);
    await page.waitForFunction(() => collectionPlanDate() === addDays(localDay(), -1));
    await page.evaluate(() => { S.view = 'tasks'; S.member = 'Fe Anne'; S.status = 'All'; render(); });
    const handoverTask = page.locator('#taskList .task').filter({ hasText: 'Submit fresh, labeled samples to DA RCPC Davao' });
    await handoverTask.locator('select.status').selectOption('Done');
    await page.waitForFunction(() => S.data.samples.every(sample => sample.submitted && stageOf(sample) === 'waiting'));
    await page.waitForFunction(() => collectionPlanDate() === '');
    await page.evaluate(() => {
      S.data.samples.push({ id: 'FA-901', row: 0, date: localDay(), site: 'Test farm', by: 'Fe Anne',
        angles: [1], bagged: false, submitted: '', validated: '', notes: '' });
      S.view = 'samples'; render();
    });
    await page.locator('[data-change="collectionPlan"]').fill(await page.evaluate(() => localDay()));
    await page.waitForFunction(() => {
      const task = rcpcSubmissionTask();
      return task.due === addDays(localDay(), 1) && task.status === 'Not Started';
    });
    assert.equal(await page.locator('[data-change="rcpcDone"]').count(), 0, 'today’s collection cannot be submitted early');
    await page.evaluate(() => {
      const task = rcpcSubmissionTask();
      task.status = 'Done'; task.due = localDay(); // older deployed server can return stale task state
      S.view = 'tasks'; S.member = 'Fe Anne'; S.status = 'All';
      render();
    });
    assert.equal(await page.locator('#taskList .task').filter({ hasText: 'Submit fresh, labeled samples to DA RCPC Davao' }).locator('select.status').inputValue(), 'Not Started');
    assert.equal(await page.locator('#taskList .task').filter({ hasText: 'Submit fresh, labeled samples to DA RCPC Davao' }).locator('[data-field="due"]').inputValue(), await page.evaluate(() => addDays(localDay(), 1)));

    await page.evaluate(() => {
      const captured = addDays(localDay(), -2);
      S.data.samples = ['RJ-900', 'CP-900'].map(id => ({ id, row: 0, date: captured,
        site: 'Test farm', by: ownerOf(id), angles: [1, 2, 3, 4, 5], bagged: true,
        submitted: '', validated: '', notes: '' }));
      S.view = 'overview'; render();
    });
    await page.locator('[data-action="showCheckDates"]').tap();
    assert.equal(await page.evaluate(() => S.view), 'samples');
    assert.equal(await page.locator('[data-action="smpStage"][data-v="unrecorded"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('[data-action="smpStage"][data-v="unrecorded"]').count(), 1);
    assert.equal(await page.locator('[data-action="smpStage"][data-v="invalid"]').count(), 0);
    await page.locator('[data-action="openSheet"]').tap();
    await page.locator('[data-change="sheetDate"]').fill(await page.evaluate(() => addDays(localDay(), -1)));
    assert.equal(await page.locator('[data-change="sheetSel"]:checked').count(), 2);
    await page.locator('[data-action="sheetSubmit"]').tap();
    await page.waitForFunction(() => S.data.samples.every(sample => sample.submitted && stageOf(sample) === 'waiting'));

    await page.evaluate(() => {
      S.queued = { 'RJ-900_01': { id: 'RJ-900', angle: 1 } };
      S.waiting = { 'RJ-900_01': Date.now() };
      S.uploading = { 'RJ-900_01': Date.now() };
      updateSyncChip();
    });
    assert.match(await page.locator('#syncChip').innerText(), /1/);

    assert.deepEqual(errors, []);
    console.log('Touch browser smoke passed: editors, hand-over backfill, and photo sync count');
  } finally {
    await browser.close();
  }
} finally {
  const target = resolve(folder), base = resolve(tmpdir());
  if (target.startsWith(base + sep) && target.includes('tracker-touch-smoke-')) rmSync(target, { recursive: true, force: true });
}
