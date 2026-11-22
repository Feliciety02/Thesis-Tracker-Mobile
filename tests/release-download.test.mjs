import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));

test('README button downloads the maintained latest APK directly', async () => {
  const readme = (await read('README.md')).toString();
  const match = readme.match(/<a href="([^"]+)"><img src="docs\/readme\/apk-button\.svg"/);
  assert.ok(match, 'README download button exists');
  const url = new URL(match[1]);
  assert.equal(url.hostname, 'raw.githubusercontent.com');
  assert.equal(url.pathname, '/Feliciety02/Thesis-Tracker-Mobile/main/Banana-Thesis-Tracker-Android.apk');
  assert.match(readme, /\[Banana Thesis Tracker \d+\.\d+\.\d+ APK\]\(https:\/\/raw\.githubusercontent\.com\/Feliciety02\/Thesis-Tracker-Mobile\/main\/Banana-Thesis-Tracker-Android\.apk\)/);
});

test('default and archive APKs match the advertised checksum', async () => {
  const version = JSON.parse((await read('package.json')).toString()).version;
  const filename = `Banana-Thesis-Tracker-Android-${version}.apk`;
  const digest = createHash('sha256').update(await read(`docs/releases/${version}/${filename}`)).digest('hex');
  for (const path of ['Banana-Thesis-Tracker-Android.apk', 'docs/releases/latest/Banana-Thesis-Tracker-Android.apk'])
    assert.equal(createHash('sha256').update(await read(path)).digest('hex'), digest, path);
  assert.equal((await read('docs/releases/latest/VERSION.txt')).toString().trim(), version);
  assert.equal((await read('Banana-Thesis-Tracker-Android.apk.sha256')).toString().trim(), `${digest}  Banana-Thesis-Tracker-Android.apk`);
});
