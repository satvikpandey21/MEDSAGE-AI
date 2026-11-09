// Medical files use authenticated SDK operations; never derive a public URL.
export async function createOwnedSignedUrl(client, bucket, path) {
  if (!["prescriptions", "pharmacy-bills"].includes(bucket)) throw new Error("Unsupported medical bucket.");
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user?.id) throw new Error("Please sign in again to view this document.");
  if (typeof path !== "string" || !path.startsWith(`${auth.user.id}/`) || /[\\%]/.test(path)
    || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Document access denied.");
  }
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60);
  if (error || typeof data?.signedUrl !== "string" || !data.signedUrl) throw new Error("Unable to create a private document link.");
  return data.signedUrl;
}
