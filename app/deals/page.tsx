import Link from "next/link";
import { Suspense } from "react";
import { getSteamDeals, type Deal } from "@/lib/cheapshark";
import DealCard from "../components/DealCard";
import DealsControls from "../components/DealsControls";

export const metadata = {
  title: "All Steam Deals",
  description: "Browse every current Steam discount.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = first(sp.q);
  const sort = first(sp.sort) ?? "Savings";
  const maxPrice = first(sp.maxPrice);
  const minSavings = Number(first(sp.minSavings) ?? "0");

  let deals: Deal[] = [];
  let error: string | null = null;
  try {
    deals = await getSteamDeals({ q, sort, maxPrice });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load deals";
  }

  const visible =
    minSavings > 0
      ? deals.filter((d) => Number(d.savings) >= minSavings)
      : deals;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Personalized picks
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          All <span className="text-cyan-400">Steam</span> deals
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Every current discount, unfiltered. For picks matched to your taste,
          head to the home page.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
        <Suspense fallback={<div className="h-10" />}>
          <DealsControls />
        </Suspense>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300">
          Couldn’t load deals right now ({error}). Try again in a moment.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-12 text-center text-zinc-400">
          No deals match your filters. Try widening the price or discount range.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            Showing {visible.length} deal{visible.length === 1 ? "" : "s"}
            {q ? ` for “${q}”` : ""}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((deal) => (
              <DealCard key={deal.dealID} deal={deal} />
            ))}
          </div>
        </>
      )}

      <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
        Price data from{" "}
        <a
          href="https://www.cheapshark.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-cyan-400"
        >
          CheapShark
        </a>
        . Not affiliated with Valve or Steam.
      </footer>
    </main>
  );
}
