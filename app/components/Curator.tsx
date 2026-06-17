"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CurateResponse,
  type Preferences,
  DEFAULT_PREFERENCES,
  preferencesToParams,
} from "@/lib/curatorTypes";
import MatchCard from "./MatchCard";
import PreferencesPanel from "./PreferencesPanel";
import DigestSubscribe from "./DigestSubscribe";

const PREFS_KEY = "curator_prefs";

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
  } catch {
    // ignore malformed storage
  }
  return DEFAULT_PREFERENCES;
}

type Status = "idle" | "loading" | "loaded" | "error";

interface Me {
  connected: boolean;
  steamConfigured: boolean;
  steamId?: string;
  player?: { name: string; avatar: string; profileUrl: string } | null;
}

type Source = { kind: "demo" } | { kind: "steam" } | { kind: "genres"; genres: string[] };

interface Progress {
  total: number;
  done: number;
  cached: number;
  fetched: number;
}

// The store's coarse genre set — enough for a manual fallback profile.
const PICKABLE_GENRES = [
  "Action", "Adventure", "RPG", "Strategy", "Simulation", "Indie",
  "Casual", "Sports", "Racing", "Massively Multiplayer", "Free To Play",
];

function curateQuery(source: Source, prefs: Preferences): string {
  const base = new URLSearchParams();
  if (source.kind === "demo") base.set("demo", "1");
  if (source.kind === "genres") base.set("genres", source.genres.join(","));
  return [base.toString(), preferencesToParams(prefs)].filter(Boolean).join("&");
}

export default function Curator() {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<CurateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needGenres, setNeedGenres] = useState(false);
  const [stageLabel, setStageLabel] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [prefs, setPrefsState] = useState<Preferences>(loadPrefs);
  const prefsRef = useRef<Preferences>(prefs);
  const lastSource = useRef<Source | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Plain-JSON fallback if the SSE connection can't be established.
  const runJson = useCallback(async (source: Source) => {
    try {
      const qs = curateQuery(source, prefsRef.current);
      const res = await fetch(qs ? `/api/curate?${qs}` : "/api/curate");
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "private_profile") {
          setNeedGenres(true);
          setStatus("idle");
          return;
        }
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }
      setData(json as CurateResponse);
      setStatus("loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }, []);

  const run = useCallback(
    (source: Source) => {
      lastSource.current = source;
      setStatus("loading");
      setError(null);
      setNeedGenres(false);
      setProgress(null);
      setStageLabel("Finding live deals…");

      esRef.current?.close();
      const qs = curateQuery(source, prefsRef.current);
      const es = new EventSource(`/api/curate/stream${qs ? `?${qs}` : ""}`);
      esRef.current = es;
      let done = false;

      es.addEventListener("stage", (e) => {
        const { stage } = JSON.parse((e as MessageEvent).data);
        if (stage === "pricing") setStageLabel("Checking price history…");
      });
      es.addEventListener("progress", (e) => {
        const p = JSON.parse((e as MessageEvent).data) as Progress;
        setProgress(p);
        setStageLabel("Enriching genres & ranking deals…");
      });
      es.addEventListener("result", (e) => {
        done = true;
        setData(JSON.parse((e as MessageEvent).data) as CurateResponse);
        setStatus("loaded");
        es.close();
      });
      es.addEventListener("failed", (e) => {
        done = true;
        const d = JSON.parse((e as MessageEvent).data);
        es.close();
        if (d.code === "private_profile") {
          setNeedGenres(true);
          setStatus("idle");
        } else {
          setError(d.error ?? "Curation failed");
          setStatus("error");
        }
      });
      // Native connection error (not our "failed" event): fall back to JSON.
      es.onerror = () => {
        if (done) return;
        done = true;
        es.close();
        runJson(source);
      };
    },
    [runJson],
  );

  const applyPrefs = useCallback(
    (next: Preferences) => {
      prefsRef.current = next;
      setPrefsState(next);
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // storage disabled — prefs just won't persist across reloads
      }
      if (lastSource.current) run(lastSource.current);
    },
    [run],
  );

  // Discover connection state and auto-curate. (Prefs load via useState init.)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((m: Me) => {
        if (cancelled) return;
        setMe(m);
        if (m.connected && m.steamConfigured) run({ kind: "steam" });
      })
      .catch(() => setMe({ connected: false, steamConfigured: false }));
    return () => {
      cancelled = true;
      esRef.current?.close();
    };
  }, [run]);

  const connected = me?.connected ?? false;

  return (
    <div>
      {connected ? (
        <>
          <ConnectedBar me={me!} onRefresh={() => run({ kind: "steam" })} />
          <DigestSubscribe prefs={prefs} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/api/auth/steam/login"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1b2838] px-6 py-3 font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-[#2a475e]"
          >
            <SteamMark />
            Connect with Steam
          </a>
          <button
            onClick={() => run({ kind: "demo" })}
            disabled={status === "loading"}
            className="rounded-lg border border-cyan-400/40 px-6 py-3 font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:opacity-50"
          >
            {status === "loading" ? "Curating…" : "Try with a demo library"}
          </button>
        </div>
      )}

      {!connected && (
        <p className="mt-3 text-center text-xs text-zinc-500">
          Connecting reads your owned games & playtime to infer taste. The demo
          uses a sample RPG/strategy library.
        </p>
      )}

      {me && me.connected && !me.steamConfigured && (
        <p className="mt-3 text-center text-xs text-amber-400">
          You&apos;re signed in, but the server has no STEAM_API_KEY set, so your
          library can&apos;t be read yet. Try the demo or pick genres below.
        </p>
      )}

      {needGenres && <GenrePicker onSubmit={(g) => run({ kind: "genres", genres: g })} />}

      {status === "loading" && (
        <div className="mt-10 rounded-xl border border-white/10 bg-zinc-900/40 p-8 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-zinc-300" aria-live="polite">
            {stageLabel || "Curating…"}
          </p>
          {progress && progress.total > 0 && (
            <div className="mx-auto mt-4 max-w-sm">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-400 transition-[width] duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-600">
                {progress.done}/{progress.total} titles
                {progress.fetched > 0 ? ` · ${progress.fetched} fetched` : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {status === "error" && (
        <div className="mt-10 rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300">
          {error}
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={() => run(connected ? { kind: "steam" } : { kind: "demo" })}
              className="rounded-md border border-rose-400/40 px-4 py-1.5 text-sm hover:bg-rose-400/10"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {(status === "loaded" || (status === "loading" && data)) && (
        <div className="mt-10">
          <PreferencesPanel value={prefs} onApply={applyPrefs} />
          {data && <Results data={data} />}
        </div>
      )}
    </div>
  );
}

function ConnectedBar({ me, onRefresh }: { me: Me; onRefresh: () => void }) {
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-3">
        {me.player?.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.player.avatar} alt="" className="h-10 w-10 rounded" />
        )}
        <div className="text-left">
          <p className="text-sm font-semibold text-white">
            {me.player?.name ?? "Steam account connected"}
          </p>
          <p className="text-xs text-zinc-500">Picks are personalized to your library.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:border-white/40 hover:text-white"
        >
          Refresh
        </button>
        <a
          href="/api/auth/steam/logout"
          className="rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:text-rose-300"
        >
          Disconnect
        </a>
      </div>
    </div>
  );
}

function GenrePicker({ onSubmit }: { onSubmit: (genres: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (g: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
      <p className="text-sm text-amber-200">
        Your Steam library is private, so we can&apos;t infer taste automatically.
        Pick a few genres you enjoy and we&apos;ll curate from those instead.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {PICKABLE_GENRES.map((g) => {
          const on = selected.has(g);
          return (
            <button
              key={g}
              onClick={() => toggle(g)}
              className={
                "rounded-full border px-3 py-1 text-sm transition-colors " +
                (on
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-100"
                  : "border-white/15 text-zinc-300 hover:border-white/40")
              }
            >
              {g}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onSubmit([...selected])}
        disabled={selected.size === 0}
        className="mt-4 rounded-lg bg-cyan-500 px-5 py-2 font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-40"
      >
        Curate from these genres
      </button>
    </div>
  );
}

function Results({ data }: { data: CurateResponse }) {
  const { profile, meta, results } = data;
  return (
    <div>
      <div className="mb-6 rounded-xl border border-white/10 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Your taste profile
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.topGenres.slice(0, 8).map((g) => (
            <span
              key={g.genre}
              className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200"
              title={`${(g.weight * 100).toFixed(0)}% of taste`}
            >
              {g.genre}
              <span className="ml-1.5 text-cyan-400/60">{(g.weight * 100).toFixed(0)}%</span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {meta.usedFallback
            ? "Built from genres you selected."
            : `Inferred from ${profile.gamesAnalyzed} games, weighted by playtime.`}{" "}
          Ranked {meta.returned} of {meta.dealsConsidered} live deals; games you
          own were excluded.
        </p>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-12 text-center text-zinc-400">
          No matching deals right now. Check back as new sales go live.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((deal, i) => (
            <MatchCard key={deal.steamAppID ?? deal.title} deal={deal} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SteamMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.6 0 .4 4.9 0 11.1l6.4 2.6c.5-.4 1.2-.6 1.9-.6h.2l2.9-4.2v-.1c0-2.5 2-4.5 4.5-4.5s4.6 2 4.6 4.6-2 4.6-4.6 4.6h-.1l-4.1 2.9v.2c0 1.9-1.6 3.5-3.5 3.5-1.7 0-3.1-1.2-3.4-2.8L.9 19.3C2.4 22.1 7 24 12 24c6.6 0 12-5.4 12-12S18.6 0 12 0zM7.5 18.2l-1.4-.6c.3.5.7.9 1.3 1.2 1.3.5 2.8-.1 3.3-1.4.3-.6.2-1.3 0-1.9s-.7-1.1-1.3-1.3c-.6-.2-1.2-.2-1.7 0l1.5.6c1 .4 1.4 1.5 1 2.4s-1.5 1.4-2.4 1zm9.7-6.7c-1.7 0-3-1.4-3-3s1.4-3 3-3 3.1 1.3 3.1 3-1.4 3-3.1 3zm0-5.2c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2-1-2.2-2.2-2.2z" />
    </svg>
  );
}
