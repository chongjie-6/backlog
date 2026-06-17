"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { SORT_OPTIONS } from "@/lib/cheapshark";

const MAX_PRICE_OPTIONS = [
  { value: "", label: "Any price" },
  { value: "5", label: "Under $5" },
  { value: "10", label: "Under $10" },
  { value: "20", label: "Under $20" },
  { value: "40", label: "Under $40" },
];

const MIN_SAVINGS_OPTIONS = [
  { value: "", label: "Any discount" },
  { value: "25", label: "25%+ off" },
  { value: "50", label: "50%+ off" },
  { value: "75", label: "75%+ off" },
  { value: "90", label: "90%+ off" },
];

const selectClass =
  "rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-cyan-400 focus:outline-none";

export default function DealsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Keep the input in sync when the URL `q` changes (e.g. back/forward) using
  // the "adjust state during render" pattern rather than an effect.
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  function applyParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyParams({ q: query.trim() });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <div className="flex flex-1 gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Steam games…"
          className="w-full rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
        >
          Search
        </button>
      </div>

      <select
        aria-label="Sort by"
        value={searchParams.get("sort") ?? "Savings"}
        onChange={(e) => applyParams({ sort: e.target.value })}
        className={selectClass}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Maximum price"
        value={searchParams.get("maxPrice") ?? ""}
        onChange={(e) => applyParams({ maxPrice: e.target.value })}
        className={selectClass}
      >
        {MAX_PRICE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Minimum discount"
        value={searchParams.get("minSavings") ?? ""}
        onChange={(e) => applyParams({ minSavings: e.target.value })}
        className={selectClass}
      >
        {MIN_SAVINGS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {isPending && (
        <span className="text-xs text-cyan-400" aria-live="polite">
          Updating…
        </span>
      )}
    </form>
  );
}
