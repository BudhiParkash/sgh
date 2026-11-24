import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}

const CACHE_CONTROL = "public, max-age=31536000, immutable"; // keys are content-addressed (uuid folders)

/** AWS S3 (or S3-compatible). Uses the EC2 instance role in production — no static keys. */
class S3Storage implements Storage {
  private client = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: Boolean(env.S3_ENDPOINT) });
  constructor(private bucket: string) {}
  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE_CONTROL }));
  }
  async deleteMany(keys: string[]) {
    for (let i = 0; i < keys.length; i += 1000) {
      await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }));
    }
  }
}

/**
 * Local filesystem storage, used whenever S3_BUCKET is unset: development/tests, or a single server that keeps
 * uploads on disk (set LOCAL_MEDIA_DIR to an absolute path outside the code folder, serve it at /media/ in Nginx,
 * and back it up). Public URLs are `${SITE_URL}/media/<key>`.
 */
export const LOCAL_MEDIA_DIR = resolve(process.env.LOCAL_MEDIA_DIR ?? "var/media");
class LocalStorage implements Storage {
  async put(key: string, body: Buffer) {
    const path = join(LOCAL_MEDIA_DIR, key);
    if (!path.startsWith(LOCAL_MEDIA_DIR)) throw new Error("Invalid key");
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  async deleteMany(keys: string[]) {
    await Promise.all(keys.map((k) => rm(join(LOCAL_MEDIA_DIR, k), { force: true })));
  }
}

export const storage: Storage = env.S3_BUCKET ? new S3Storage(env.S3_BUCKET) : new LocalStorage();

/** Public URL for a stored key (CDN host in production). Resolved at read time so the CDN can change without migrations. */
export function mediaUrl(key: string): string {
  const base = (env.MEDIA_PUBLIC_BASE_URL ?? `${env.SITE_URL}/media`).replace(/\/$/, "");
  return `${base}/${key}`;
}
