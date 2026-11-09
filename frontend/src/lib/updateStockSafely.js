// Compare-and-set prevents stale tabs/refills from overwriting newer stock.
export async function updateStockSafely(client, medicine, patientId, changes) {
  let query = client.from("medication_schedules").update(changes)
    .eq("id", medicine.id).eq("patient_id", patientId);
  for (const field of ["stock_quantity", "low_stock_threshold"]) {
    query = medicine[field] == null ? query.is(field, null) : query.eq(field, medicine[field]);
  }
  if (medicine.caretaker_edit_version != null) query = query.eq("caretaker_edit_version", medicine.caretaker_edit_version);
  const { data, error } = await query.select("id").single();
  if (error || !data) throw new Error("Stock changed or access was denied. Reload before saving again.");
  return data;
}
