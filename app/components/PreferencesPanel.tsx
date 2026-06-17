"use client";

import { useState } from "react";
import type { Preferences } from "@/lib/curatorTypes";

const GENRES = [
  "Action", "Adventure", "RPG", "Strategy", "Simulation", "Indie",
  "Casual", "Sports", "Racing", "Massively Multiplayer", "Free To Play",
];

const PRICE_OPTIONS = [
  { value: "", label: "Any" },
  { value: "5", label: "≤ $5" },
  { value: "10", label: "≤ $10" },
  { value: "20", label: "≤ $20" },
  { value: "40", label: "≤ $40" },
];

const DISCOUNT_OPTIONS = [0, 25, 50, 75, 90];
const MATCH_OPTIONS = [0, 0.4, 0.6, 0.75];

/**
 * Tune curation. Edits are local until "Apply" so a slow re-curate only runs
 * once, not on every keystroke.
 */
export default function PreferencesPanel({
  value,
  onApply,
}: {
  value: Preferences;
  onApply: (p: Preferences) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Preferences>(value);

  const toggle = (key: "exclude" | "prefer", g: string) =>
    setDraft((d) => {
      const has = d[key].includes(g);
      const next = has ? d[key].filter((x) => x !== g) : [...d[key], g];
      // A genre can't be both excluded and preferred.
      const other = key === "exclude" ? "prefer" : "exclude";
      return { ...d, [key]: next, [other]: d[other].filter((x) => x !== g) };
    });

  const activeCount =
    (value.maxPrice ? 1 : 0) +
    (value.minDiscount > 0 ? 1 : 0) +
    (value.minScore > 0 ? 1 : 0) +
    value.exclude.length +
    value.prefer.length;

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-zinc-900/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold text-zinc-200">
          Preferences
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs text-cyan-200">
              {activeCount} active
            </span>
          )}
        </span>
        <span className="text-zinc-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/10 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price ceiling">
              <select
                value={draft.maxPrice}
                onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
                className="w-full rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              >
                {PRICE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Minimum discount">
              <select
                value={draft.minDiscount}
                onChange={(e) => setDraft({ ...draft, minDiscount: Number(e.target.value) })}
                className="w-full rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              >
                {DISCOUNT_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d === 0 ? "Any" : `${d}%+`}</option>
                ))}
              </select>
            </Field>
            <Field label="Minimum match">
              <select
                value={draft.minScore}
                onChange={(e) => setDraft({ ...draft, minScore: Number(e.target.value) })}
                className="w-full rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              >
                {MATCH_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m === 0 ? "Any" : `${Math.round(m * 100)}%+`}</option>
                ))}
              </select>
            </Field>
          </div>

          <GenreRow
            label="Prefer"
            hint="nudged up"
            selected={draft.prefer}
            tone="prefer"
            onToggle={(g) => toggle("prefer", g)}
          />
          <GenreRow
            label="Exclude"
            hint="hidden"
            selected={draft.exclude}
            tone="exclude"
            onToggle={(g) => toggle("exclude", g)}
          />

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => onApply(draft)}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-400"
            >
              Apply
            </button>
            <button
              onClick={() => {
                const cleared: Preferences = {
                  maxPrice: "", minDiscount: 0, minScore: 0, exclude: [], prefer: [],
                };
                setDraft(cleared);
                onApply(cleared);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function GenreRow({
  label, hint, selected, tone, onToggle,
}: {
  label: string;
  hint: string;
  selected: string[];
  tone: "prefer" | "exclude";
  onToggle: (g: string) => void;
}) {
  const onClasses =
    tone === "prefer"
      ? "border-cyan-400 bg-cyan-400/20 text-cyan-100"
      : "border-rose-400 bg-rose-400/20 text-rose-100";
  return (
    <div>
      <span className="mb-2 block text-xs font-medium text-zinc-400">
        {label} genres <span className="text-zinc-600">({hint})</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {GENRES.map((g) => {
          const on = selected.includes(g);
          return (
            <button
              key={g}
              onClick={() => onToggle(g)}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (on ? onClasses : "border-white/15 text-zinc-300 hover:border-white/40")
              }
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
