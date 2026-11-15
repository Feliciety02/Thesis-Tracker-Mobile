import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = html.indexOf('function galleryRecoveryCandidates(');
const end = html.indexOf('\nlet uploadChain =', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);

test('Gallery recovery matches current samples and queues only missing angles after reinstall', async () => {
  const order = [];
  const sample = { id: 'FA-015', date: '2026-11-14', angles: [1] };
  const photos = [
    { id: 'FA-015', angle: 1, name: 'FA-015_01.jpg', at: 1794600000000 },
    { id: 'FA-015', angle: 4, name: 'FA-015_04.jpg', at: 1794600000000 },
    { id: 'FA-016', angle: 2, name: 'FA-016_02.jpg', at: 1794600000000 },
    { id: 'XX-001', angle: 3, name: 'XX-001_03.jpg', at: 1794600000000 },
  ];
  const S = { user: 'Fe Anne', data: { samples: [sample] }, galleryRecoveryFresh: true,
    view: 'overview', queued: {}, galleryRecovery: null };
  const ctx = vm.createContext({
    S, window: { ThesisBackgroundUpload: {
      scanNamedPhotos: async () => ({ access: 'full', photos }),
      status: async () => ({ pending: [] }),
      readNamedPhoto: async name => { order.push('read:' + name); return { b64: 'ZmFrZQ==' }; },
    } },
    navigator: { onLine: true }, nativeUploadAvailable: () => true,
    PhotoQ: {
      allStrict: async () => [],
      put: async key => { order.push('put:' + key); },
    },
    fname: (id, angle) => `${id}_${String(angle).padStart(2, '0')}.jpg`,
    ownerOf: id => id.startsWith('FA-') ? 'Fe Anne' : 'Other',
    jobKey: job => job.id + '_' + job.angle,
    shrinkPhoto: async () => ({ full: 'data:image/jpeg;base64,cXVldWVk' }),
    queuePhotoJob: async job => { order.push('enqueue:' + job.id + '_' + job.angle); },
    localDay: () => '2026-11-14', toast: () => {}, isTyping: () => false, render: () => {},
    atob, Blob, Uint8Array, Date, Set, Map,
  });
  vm.runInContext(source, ctx);
  await ctx.recoverGalleryPhotos(false);
  assert.deepEqual(order, ['read:FA-015_04.jpg', 'put:FA-015_4', 'enqueue:FA-015_4']);
  assert.equal(S.galleryRecovery.recovered, 1);
  assert.equal(S.galleryRecovery.unmatched, 1);
  assert.equal(S.galleryRecovery.unmatchedPhotos[0].id, 'FA-016');
  assert.equal(S.galleryRecovery.errors.length, 0);
});

test('Gallery recovery preserves photos when access is denied', async () => {
  const S = { user: 'Fe Anne', data: { samples: [] }, galleryRecoveryFresh: true,
    view: 'overview', queued: {}, galleryRecovery: null };
  const ctx = vm.createContext({
    S, window: { ThesisBackgroundUpload: { scanNamedPhotos: async () => ({ access: 'denied', photos: [] }) } },
    navigator: { onLine: true }, nativeUploadAvailable: () => true,
    isTyping: () => false, render: () => {}, toast: () => {},
  });
  vm.runInContext(source, ctx);
  await ctx.recoverGalleryPhotos(false);
  assert.equal(S.galleryRecovery.access, 'denied');
  assert.equal(S.galleryRecovery.recovered, 0);
});
