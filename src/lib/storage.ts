/**
 * File storage (spec §1, §2.12). S3-compatible via the AWS SDK — works with
 * AWS S3 and self-hosted MinIO (set S3_ENDPOINT for MinIO). When S3 is not
 * configured, falls back to local disk under ./.uploads so document upload
 * works in dev with zero cloud setup.
 *
 * To go live: set S3_ENDPOINT (MinIO only), S3_REGION, S3_BUCKET,
 * S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env (see README).
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const BUCKET = process.env.S3_BUCKET || "mako-governance";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

const s3 =
  process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? new S3Client({
        region: process.env.S3_REGION || "us-east-1",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: !!process.env.S3_ENDPOINT, // required for MinIO
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      })
    : null;

export function isStorageConfigured(): boolean {
  return s3 !== null;
}

/** Deterministic-ish object key: keeps the original name for readability. */
export function buildFileKey(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${new Date().getUTCFullYear()}/${randomUUID()}-${safe}`;
}

/** Store bytes. Returns the key to persist on the attachment row. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }
  // Local fallback
  const full = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

/** Read bytes back (used by the local download route in dev). */
export async function getObjectBytes(key: string): Promise<Buffer | null> {
  if (s3) {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key })
    );
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  }
  try {
    return await readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}

/**
 * A URL the browser can use to download the object. With S3 this is a
 * time-limited presigned URL; in local-fallback mode it's an app route that
 * streams the file from disk.
 */
export async function getDownloadUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  if (s3) {
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }
  return `/api/files/${encodeURIComponent(key)}`;
}
