import { cleanupDeletedDocument } from './deleteOwnedDocument.js';

export const prescriptionDeleteWarning = 'Permanently delete this prescription? Any linked bill-verification records, medication schedules (including stock), and dose history will also be permanently deleted. Pharmacy bills and unrelated prescriptions will be kept. This cannot be undone.';

export async function deleteConfirmedPrescription({ client, id, userId, confirmDelete }) {
  if (!confirmDelete(prescriptionDeleteWarning)) return { cancelled: true };
  const { data, error } = await client.rpc('delete_owned_prescription', {
    p_prescription_id: id, p_confirm: true,
  });
  if (error) throw error;
  if (!data || data.id !== id) throw new Error('The prescription was not deleted.');
  return cleanupDeletedDocument({ client, bucket: 'prescriptions', data, userId });
}
