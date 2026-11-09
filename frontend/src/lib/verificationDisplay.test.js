import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyVerificationDisplay as empty, verificationDisplayReducer as reduce } from './verificationDisplay.js';
const row = { id: 'v1', prescription_id: 'p1', status: 'matched' };
test('refresh and opening saved analysis reveal no verification', () => {
  assert.deepEqual(empty.visible, {});
  assert.deepEqual(reduce(empty, { type: 'open', prescriptionId: 'p1' }).visible, {});
});
test('selection alone hides result; explicit click reveals only scoped selection', () => {
  let state = reduce(empty, { type: 'select', prescriptionId: 'p1', id: 'v1' });
  assert.deepEqual(state.visible, {});
  state = reduce(state, { type: 'showPast', prescriptionId: 'p1', history: [row] });
  assert.deepEqual(state.visible, { p1: row });
  assert.deepEqual(reduce(state, { type: 'select', prescriptionId: 'p1', id: 'v2' }).visible, {});
  assert.deepEqual(reduce(state, { type: 'open', prescriptionId: 'p2' }).visible, {});
  assert.deepEqual(reduce(state, { type: 'showPast', prescriptionId: 'p2', history: [row] }).visible, {});
});
test('new verification appears immediately; late result cannot reveal another prescription', () => {
  const opened = reduce(empty, { type: 'open', prescriptionId: 'p1' });
  assert.deepEqual(reduce(opened, { type: 'completed', prescriptionId: 'p1', result: row }).visible, { p1: row });
  const switched = reduce(opened, { type: 'open', prescriptionId: 'p2' });
  assert.deepEqual(reduce(switched, { type: 'completed', prescriptionId: 'p1', result: row }).visible, {});
});
