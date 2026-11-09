export const emptyVerificationDisplay = { activePrescriptionId: null, selection: {}, visible: {} };

export function verificationDisplayReducer(state, event) {
  if (event.type === 'open') return { ...state, activePrescriptionId: event.prescriptionId, visible: {} };
  if (event.type === 'select') return { ...state, activePrescriptionId: event.prescriptionId,
    selection: { ...state.selection, [event.prescriptionId]: event.id }, visible: {} };
  if (event.type === 'showPast') {
    const chosen = event.history.find((row) => row.id === state.selection[event.prescriptionId]
      && row.prescription_id === event.prescriptionId);
    return chosen ? { ...state, activePrescriptionId: event.prescriptionId,
      visible: { [event.prescriptionId]: chosen } } : { ...state, visible: {} };
  }
  if (event.type === 'completed' && state.activePrescriptionId === event.prescriptionId) {
    return { ...state, selection: { ...state.selection, [event.prescriptionId]: '' },
      visible: { [event.prescriptionId]: event.result } };
  }
  if (event.type === 'clear') return emptyVerificationDisplay;
  return state;
}
