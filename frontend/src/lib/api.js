export function resolveApiBase({ base = "", legacy = "", production = false } = {}) {
  const value = (base || legacy || (production ? "" : "http://127.0.0.1:8000")).trim().replace(/\/+$/, "");
  if (!value) throw new Error("Configure VITE_API_BASE_URL for the deployed backend.");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("Invalid backend URL.");
  if (production && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error("Production requires a public HTTPS backend URL.");
  return value;
}
export function apiUrl(path) {
  const env = import.meta.env || {};
  return resolveApiBase({ base: env.VITE_API_BASE_URL, legacy: env.VITE_API_URL, production: env.PROD }) + path;
}
