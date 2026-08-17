import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Buckets that are private and therefore require signed URLs. */
const PRIVATE_BUCKETS = ["employee-photos", "time-clock-photos", "payroll-exports"];

const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour

const cache = new Map<string, { url: string; expiresAt: number }>();

/** Extract { bucket, path } from a Supabase storage object URL. */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/**
 * Resolve a stored photo URL into something the browser can load.
 * Private buckets get a short-lived signed URL; anything else is returned as-is.
 */
export async function resolveStorageUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed || !PRIVATE_BUCKETS.includes(parsed.bucket)) return url;

  const key = `${parsed.bucket}/${parsed.path}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;

  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + (SIGNED_TTL_SECONDS - 60) * 1000 });
  return data.signedUrl;
}

/** React hook returning a displayable URL for a stored (possibly private) file. */
export function useSignedUrl(url: string | null | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    resolveStorageUrl(url).then((value) => {
      if (active) setResolved(value);
    });
    return () => {
      active = false;
    };
  }, [url]);

  return resolved;
}
