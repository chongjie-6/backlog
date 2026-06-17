// Digest subscriber store. Uses Supabase when the service role is configured
// (the durable production path — a file won't survive serverless); otherwise a
// local JSON file for dev/self-host. Same interface either way.
//
// We persist the minimum: SteamID, email, and the preferences needed to curate
// — and support deletion (unsubscribe) for privacy.
//
// Server-only.

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { type Preferences, DEFAULT_PREFERENCES } from "@/lib/curatorTypes";
import { supabaseAdmin } from "./supabaseAdmin";

const FILE = path.join(process.cwd(), ".cache", "curator", "subscribers.json");
const TABLE = "digest_subscribers";

export interface Subscriber {
  steamId: string;
  email: string;
  prefs: Preferences;
  /** for private profiles: curate from these instead of the library */
  manualGenres?: string[];
  createdAt: number;
}

interface UpsertInput {
  steamId: string;
  email: string;
  prefs?: Preferences;
  manualGenres?: string[];
}

// --- public API (delegates to the active backend) -------------------------

export async function listSubscribers(): Promise<Subscriber[]> {
  const db = supabaseAdmin();
  return db ? supa.list(db) : file.list();
}

export async function upsertSubscriber(input: UpsertInput): Promise<Subscriber> {
  const db = supabaseAdmin();
  return db ? supa.upsert(db, input) : file.upsert(input);
}

export async function removeSubscriber(steamId: string): Promise<boolean> {
  const db = supabaseAdmin();
  return db ? supa.remove(db, steamId) : file.remove(steamId);
}

// --- file backend ---------------------------------------------------------

type Store = Record<string, Subscriber>;

const file = {
  async read(): Promise<Store> {
    try {
      return JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
    } catch {
      return {};
    }
  },
  async write(store: Store): Promise<void> {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store, null, 2), "utf8");
  },
  async list(): Promise<Subscriber[]> {
    return Object.values(await file.read());
  },
  async upsert(input: UpsertInput): Promise<Subscriber> {
    const store = await file.read();
    const existing = store[input.steamId];
    const record = merge(input, existing);
    store[input.steamId] = record;
    await file.write(store);
    return record;
  },
  async remove(steamId: string): Promise<boolean> {
    const store = await file.read();
    if (!store[steamId]) return false;
    delete store[steamId];
    await file.write(store);
    return true;
  },
};

// --- supabase backend -----------------------------------------------------

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

interface Row {
  steam_id: string;
  email: string;
  prefs: Preferences;
  manual_genres: string[] | null;
  created_at: string;
}

function rowToSubscriber(r: Row): Subscriber {
  return {
    steamId: r.steam_id,
    email: r.email,
    prefs: { ...DEFAULT_PREFERENCES, ...r.prefs },
    manualGenres: r.manual_genres ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  };
}

const supa = {
  async list(db: Db): Promise<Subscriber[]> {
    const { data, error } = await db.from(TABLE).select("*");
    if (error) throw new Error(error.message);
    return (data as Row[]).map(rowToSubscriber);
  },
  async upsert(db: Db, input: UpsertInput): Promise<Subscriber> {
    const record = merge(input);
    const { error } = await db.from(TABLE).upsert(
      {
        steam_id: record.steamId,
        email: record.email,
        prefs: record.prefs,
        manual_genres: record.manualGenres ?? null,
      },
      { onConflict: "steam_id" },
    );
    if (error) throw new Error(error.message);
    return record;
  },
  async remove(db: Db, steamId: string): Promise<boolean> {
    const { error, count } = await db
      .from(TABLE)
      .delete({ count: "exact" })
      .eq("steam_id", steamId);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  },
};

function merge(input: UpsertInput, existing?: Subscriber): Subscriber {
  return {
    steamId: input.steamId,
    email: input.email,
    prefs: input.prefs ?? existing?.prefs ?? DEFAULT_PREFERENCES,
    manualGenres: input.manualGenres ?? existing?.manualGenres,
    createdAt: existing?.createdAt ?? Date.now(),
  };
}

// --- unsubscribe tokens (pure) --------------------------------------------

/** Stable unsubscribe token so email links don't expose mutable state. */
export function unsubscribeToken(steamId: string): string {
  const secret = process.env.CURATOR_SECRET ?? "dev-insecure-secret-change-me";
  return crypto.createHmac("sha256", secret).update(`unsub:${steamId}`).digest("base64url");
}

export function verifyUnsubscribeToken(steamId: string, token: string): boolean {
  const expected = unsubscribeToken(steamId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
