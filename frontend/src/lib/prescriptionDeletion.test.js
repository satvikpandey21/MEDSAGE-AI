import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteConfirmedPrescription } from './prescriptionDeletion.js';

function setup({ error = null, storageError = null, path = 'owner/file.png' } = {}) {
  const events = [];
  return { events, client: { async rpc(name, args) {
    events.push({ name, args }); return { error, data: error ? null : { id: 'p', file_path: path } };
  }, storage: { from(bucket) { return { async remove(paths) { events.push({ bucket, paths }); return { error: storageError }; } }; } } } };
}
const defaults = { id: 'p', userId: 'owner', confirmDelete: () => true };
test('cancel causes no RPC or Storage calls', async () => {
  const f = setup();
  assert.deepEqual(await deleteConfirmedPrescription({ ...defaults, client: f.client, confirmDelete: (warning) => {
    assert.match(warning, /verification.*schedules.*dose history/); return false;
  } }), { cancelled: true }); assert.equal(f.events.length, 0);
});
test('unauthorized/rolled-back RPC never reaches Storage', async () => {
  const f = setup({ error: new Error('Not owner') });
  await assert.rejects(deleteConfirmedPrescription({ ...defaults, client: f.client }), /Not owner/);
  assert.equal(f.events.length, 1);
});
test('confirmed RPC precedes authoritative-path Storage cleanup', async () => {
  const f = setup(); assert.deepEqual(await deleteConfirmedPrescription({ ...defaults, client: f.client }), { storageCleanupPending: false });
  assert.deepEqual(f.events, [{ name: 'delete_owned_prescription', args: { p_prescription_id: 'p', p_confirm: true } }, { bucket: 'prescriptions', paths: ['owner/file.png'] }]);
});
test('Storage failure is explicit after committed deletion; foreign paths never removed', async () => {
  for (const options of [{ storageError: new Error('offline') }, { path: 'other/file.png' }]) {
    const f = setup(options); assert.deepEqual(await deleteConfirmedPrescription({ ...defaults, client: f.client }), { storageCleanupPending: true });
    if (options.path) assert.equal(f.events.length, 1);
  }
});
