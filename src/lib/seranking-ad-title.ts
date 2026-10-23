const TRAILING_URL = /\s*https?:\/\/\S+\s*$/;
const TRAILING_BREADCRUMB = /\s*›.*$/;

export function cleanAdTitle(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(TRAILING_URL, "").replace(TRAILING_BREADCRUMB, "").trim();
  return cleaned || raw;
}
