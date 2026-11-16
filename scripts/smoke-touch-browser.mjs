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

    assert.deepEqual(errors, []);
    console.log('Touch browser smoke passed: tapped fields stay open, dropdowns work, expense, task, and More forms save');
  } finally {
    await browser.close();
  }
} finally {
  const target = resolve(folder), base = resolve(tmpdir());
  if (target.startsWith(base + sep) && target.includes('tracker-touch-smoke-')) rmSync(target, { recursive: true, force: true });
}
