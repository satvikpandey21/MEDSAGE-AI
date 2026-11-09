// Database guards must approve deletion before any irreversible object removal.
// Failed Storage cleanup leaves an orphan object rather than a broken live record.
export async function deleteOwnedDocument({ client, table, bucket, id, userId }) {
  const { data, error } = await client.from(table).delete().eq("id", id)
    .eq("patient_id", userId).select("id,file_path").single();
  if (error) throw error;
  if (!data || data.id !== id) throw new Error("The document was not deleted.");
  const path = data.file_path;
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || /[\\%]/.test(path)
      || path.split("/").some((p) => !p || p === "." || p === "..")) {
    return { storageCleanupPending: true };
  }
  try {
    const result = await client.storage.from(bucket).remove([path]);
    return { storageCleanupPending: Boolean(result.error) };
  } catch {
    return { storageCleanupPending: true };
  }
}
