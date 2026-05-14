import { createClient } from "@supabase/supabase-js";

/**
 * Separate Supabase project: central library DB (borrowings / penalties).
 * Credentials must be prefixed with VITE_ so they are available in the browser.
 */
let _library: ReturnType<typeof createClient> | undefined;

export function getLibraryRemoteClient() {
  if (_library) return _library;
  const url = import.meta.env.VITE_LIBRARY_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_LIBRARY_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    throw new Error(
      "Library integration: set VITE_LIBRARY_SUPABASE_URL and VITE_LIBRARY_SUPABASE_ANON_KEY.",
    );
  }
  _library = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _library;
}

export function isLibraryRemoteConfigured(): boolean {
  const url = import.meta.env.VITE_LIBRARY_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_LIBRARY_SUPABASE_ANON_KEY as string | undefined;
  return Boolean(url?.trim() && key?.trim());
}
