/**
 * File storage (spec §1, §2.12). Uses Supabase Storage via the Supabase SDK,
 * authenticated with the project's SERVICE ROLE key — no S3 access keys needed.
 * When Supabase is not configured, falls back to local disk under ./.uploads so
 * document upload works in dev with zero cloud setup.
 *
 * To go live: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (see
 * README / HOSTING.md) and create the bucket named by SUPABASE_STORAGE_BUCKET.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "mako-governance";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

const supabase: SupabaseClient | null =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export function isStorageConfigured(): boolean {
  return supabase !== null;
}

/** Object key: keeps the original filename for readability. */
export function buildFileKey(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().getUTCFullYear()}/${randomUUID()}-${safe}`;
}

/** Store bytes. Returns nothing; the key is persisted on the attachment row. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (supabase) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, body, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return;
  }
  const full = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

/** Read bytes back (used by the local download route in dev fallback mode). */
export async function getObjectBytes(key: string): Promise<Buffer | null> {
  if (supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  try {
    return await readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}

/**
 * A URL the browser can use to download the object. With Supabase this is a
 * time-limited signed URL; in local-fallback mode it's an app route that
 * streams the file from disk.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, expiresInSeconds);
    if (error || !data) return `/api/files/${encodeURIComponent(key)}`;
    return data.signedUrl;
  }
  return `/api/files/${encodeURIComponent(key)}`;
}
