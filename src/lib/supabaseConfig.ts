/** Validate public client configuration before constructing the native Auth client. */
export function publicSupabaseConfig(rawUrl?: string, publishableKey?: string, anonKey?: string) {
  const url = rawUrl?.trim();
  const key = publishableKey?.trim() || anonKey?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.hostname === 'your-project.supabase.co') return null;
  } catch { return null; }
  const publishable = /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key);
  const legacyAnon = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);
  if (!publishable && !legacyAnon) return null;
  return { url, key };
}
