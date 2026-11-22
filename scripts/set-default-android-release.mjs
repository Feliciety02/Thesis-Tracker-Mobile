import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = process.argv[2] || packageJson.version;
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  throw new Error('Usage: npm run release:default [-- <version>]');
}

const packageLock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const gradle = await readFile(join(root, 'android/app/build.gradle'), 'utf8');
assert.equal(packageJson.version, version, 'package.json version must match the release');
assert.equal(packageLock.version, version, 'package-lock.json version must match the release');
assert.equal(packageLock.packages[''].version, version, 'package-lock.json root package must match the release');
assert.match(gradle, new RegExp(`versionName\\s+"${version.replaceAll('.', '\\.')}"`),
  'Android versionName must match the release');

const filename = `Banana-Thesis-Tracker-Android-${version}.apk`;
const latestApkUrl = 'https://raw.githubusercontent.com/Feliciety02/Thesis-Tracker-Mobile/main/Banana-Thesis-Tracker-Android.apk';
const releaseDir = join(root, 'docs', 'releases', version);
const apk = join(releaseDir, filename);
const digest = createHash('sha256').update(await readFile(apk)).digest('hex');
const checksum = (await readFile(join(releaseDir, 'SHA256SUMS.txt'), 'utf8')).trim();
assert.equal(checksum, `${digest}  ${filename}`, 'Release checksum must match the signed APK');

let readme = await readFile(join(root, 'README.md'), 'utf8');
function replaceOne(pattern, replacement) {
  assert.equal((readme.match(pattern) || []).length, 1, `Expected one README match for ${pattern}`);
  readme = readme.replace(pattern, replacement);
}
replaceOne(/<code>Android \d+\.\d+\.\d+<\/code>/g, `<code>Android ${version}</code>`);
replaceOne(/Signed Android \d+\.\d+\.\d+ APK/g, `Signed Android ${version} APK`);
replaceOne(/<a href="[^"]+"><img src="docs\/readme\/apk-button\.svg"/g,
  `<a href="${latestApkUrl}"><img src="docs/readme/apk-button.svg"`);
replaceOne(/\[Banana Thesis Tracker \d+\.\d+\.\d+ APK\]\([^)]+\)/g,
  `[Banana Thesis Tracker ${version} APK](${latestApkUrl})`);
replaceOne(/\[signed \d+\.\d+\.\d+ team APK\]\([^)]+\)/g,
  `[signed ${version} team APK](Banana-Thesis-Tracker-Android.apk)`);
replaceOne(/\[SHA-256 checksum\]\([^)]+\)/g,
  '[SHA-256 checksum](Banana-Thesis-Tracker-Android.apk.sha256)');

const latest = join(root, 'docs', 'releases', 'latest');
await mkdir(latest, { recursive: true });
await copyFile(apk, join(latest, 'Banana-Thesis-Tracker-Android.apk'));
await writeFile(join(latest, 'SHA256SUMS.txt'), `${digest}  Banana-Thesis-Tracker-Android.apk\n`);
await writeFile(join(latest, 'VERSION.txt'), `${version}\n`);
await writeFile(join(latest, 'README.md'),
  `# Latest Android release: ${version}\n\n` +
  `Download the [signed APK](Banana-Thesis-Tracker-Android.apk). ` +
  `Its [SHA-256 checksum](SHA256SUMS.txt) is \`${digest}\`.\n\n` +
  `Install over the existing team release to keep queued uploads and app data. ` +
  `The [versioned archive](../${version}/README.md) records this release.\n`);
await copyFile(apk, join(root, filename));
await writeFile(join(root, `${filename}.sha256`), `${digest}  ${filename}\n`);
await copyFile(apk, join(root, 'Banana-Thesis-Tracker-Android.apk'));
await writeFile(join(root, 'Banana-Thesis-Tracker-Android.apk.sha256'),
  `${digest}  Banana-Thesis-Tracker-Android.apk\n`);
await writeFile(join(root, 'README.md'), readme);

const copiedDigest = createHash('sha256').update(await readFile(join(latest, 'Banana-Thesis-Tracker-Android.apk'))).digest('hex');
assert.equal(copiedDigest, digest, 'Default APK copy does not match the versioned release');
for (const name of [filename, 'Banana-Thesis-Tracker-Android.apk']) {
  const rootDigest = createHash('sha256').update(await readFile(join(root, name))).digest('hex');
  assert.equal(rootDigest, digest, `${name} in project root does not match the versioned release`);
}
console.log(`Default Android APK set to ${version} (${digest})`);
