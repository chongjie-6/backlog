// Async cache for rate-limited upstream data (genre enrichment especially).
//
// Two tiers:
//   - in-memory Map: dedupes within a process / request.
//   - on-disk JSON per namespace: survives dev restarts and verification runs.
//
// The disk tier is best-effort — on read-only/ephemeral serverless filesystems
// every fs call is swallowed and we fall back to memory only. In production the
// durable tier is Supabase (see ROADMAP); this keeps the dev loop fast and the
// public APIs un-hammered.
//
// Server-only: imports node:fs. Never import from a Client Component.

import { promises as fs } from "node:fs";
import path from "node:path";

const CACHE_DIR = path.join(process.cwd(), ".cache", "curator");

interface Entry<T> {
  value: T;
  /** epoch ms; Infinity for no expiry */
  expires: number;
}

/**
 * A namespaced key→value cache. Disk is loaded lazily on first access and
 * written back via `persist()` (call once after a batch) — individual `set`s
 * only touch memory, so a 500-item enrichment run is one file write, not 500.
 */
export class NamespaceCache<T> {
  private mem = new Map<string, Entry<T>>();
  private loaded = false;
  private dirty = false;

  constructor(
    private namespace: string,
    private ttlMs: number = Infinity,
  ) {}

  private get file() {
    return path.join(CACHE_DIR, `${this.namespace}.json`);
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const obj = JSON.parse(raw) as Record<string, Entry<T>>;
      for (const [k, v] of Object.entries(obj)) this.mem.set(k, v);
    } catch {
      // No file yet, or unreadable FS — memory-only is fine.
    }
  }

  async get(key: string): Promise<T | undefined> {
    await this.load();
    const entry = this.mem.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.mem.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Bulk lookup; returns hits keyed and the list of missing keys. */
  async getMany(keys: string[]): Promise<{ hits: Map<string, T>; misses: string[] }> {
    await this.load();
    const hits = new Map<string, T>();
    const misses: string[] = [];
    const now = Date.now();
    for (const key of keys) {
      const entry = this.mem.get(key);
      if (entry && entry.expires >= now) hits.set(key, entry.value);
      else misses.push(key);
    }
    return { hits, misses };
  }

  set(key: string, value: T) {
    this.mem.set(key, {
      value,
      expires: this.ttlMs === Infinity ? Infinity : Date.now() + this.ttlMs,
    });
    this.dirty = true;
  }

  /** Flush memory to disk. Best-effort; safe to call on serverless. */
  async persist() {
    if (!this.dirty) return;
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      const obj: Record<string, Entry<T>> = {};
      for (const [k, v] of this.mem.entries()) obj[k] = v;
      await fs.writeFile(this.file, JSON.stringify(obj), "utf8");
      this.dirty = false;
    } catch {
      // Read-only FS — durable caching is handled elsewhere (Supabase).
    }
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** Genres/tags change rarely; cache enrichment for a week. */
export const appDetailsCache = new NamespaceCache<
  import("./appdetails").AppMetadata | null
>("appdetails", 7 * DAY);
