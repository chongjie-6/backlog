import type { CuratedDeal } from "@/lib/curatorTypes";

function ratingTone(percent: number): string {
  if (percent >= 80) return "text-emerald-400";
  if (percent >= 60) return "text-lime-400";
  if (percent >= 40) return "text-amber-400";
  return "text-rose-400";
}

/** A ranked recommendation: deal info + why it matches the user's taste. */
export default function MatchCard({ deal, rank }: { deal: CuratedDeal; rank: number }) {
  const matchPct = Math.round(deal.score * 100);
  const why = deal.matchedGenres.slice(0, 3);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 transition-colors hover:border-cyan-400/40 hover:bg-zinc-900">
      <a
        href={deal.dealUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-231/87 overflow-hidden bg-zinc-800"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={deal.thumb}
          alt={deal.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-md bg-zinc-950/80 px-2 py-0.5 text-xs font-semibold text-cyan-300">
          #{rank}
        </span>
        {deal.savings > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-cyan-500 px-2 py-0.5 text-sm font-bold text-zinc-950 shadow">
            -{deal.savings}%
          </span>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
          {deal.title}
        </h3>

        {/* Match strength */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-cyan-300">{matchPct}% match</span>
            {why.length > 0 && (
              <span className="truncate pl-2 text-zinc-500">
                {why.join(" · ")}
              </span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-cyan-500 to-emerald-400"
              style={{ width: `${matchPct}%` }}
            />
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {Number(deal.normalPrice) > Number(deal.salePrice) && (
              <span className="text-xs text-zinc-500 line-through">
                ${deal.normalPrice}
              </span>
            )}
            <span className="text-lg font-bold text-emerald-400">
              ${deal.salePrice}
            </span>
            {deal.isAllTimeLow ? (
              <span className="text-[11px] font-semibold text-amber-300">
                ★ All-time low
              </span>
            ) : (
              deal.historicalLow !== null && (
                <span className="text-[11px] text-zinc-500">
                  Low: ${deal.historicalLow.toFixed(2)}
                </span>
              )
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 text-xs">
            {deal.steamRatingPercent && deal.steamRatingText && (
              <span className={ratingTone(deal.steamRatingPercent)}>
                {deal.steamRatingPercent}% · {deal.steamRatingText}
              </span>
            )}
            {deal.metacritic && (
              <span className="text-zinc-400">Metacritic {deal.metacritic}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={deal.dealUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md bg-cyan-500 px-3 py-1.5 text-center text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            Get deal
          </a>
          {deal.steamUrl && (
            <a
              href={deal.steamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-white/15 px-3 py-1.5 text-center text-sm text-zinc-300 transition-colors hover:border-white/40 hover:text-white"
            >
              Steam
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
