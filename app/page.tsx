import Link from "next/link";
import Curator from "./components/Curator";

export const metadata = {
  title: "Game Deal Curator — deals on games you'd actually like",
  description:
    "Personalized PC game deals inferred from your Steam library and playtime.",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10 text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-widest text-cyan-400">
          Game Deal Curator
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Deals on games{" "}
          <span className="bg-linear-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            you&apos;d actually like
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
          Connect your Steam library and we infer your taste from what you
          actually play, then rank today&apos;s discounts by how well they match —
          not just by who&apos;s on sale.
        </p>
      </header>

      <Curator />

      <div className="mt-12 text-center">
        <Link
          href="/deals"
          className="text-sm text-zinc-400 underline-offset-4 hover:text-cyan-300 hover:underline"
        >
          Or browse all Steam deals, unfiltered →
        </Link>
      </div>

      <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
        Price data via{" "}
        <a
          href="https://www.cheapshark.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-cyan-400"
        >
          CheapShark
        </a>
        ; genres via the Steam store. Not affiliated with Valve or Steam.
      </footer>
    </main>
  );
}
