import { type Deal, dealRedirectUrl, steamStoreUrl } from "@/lib/cheapshark";

function ratingTone(percent: number): string {
  if (percent >= 80) return "text-emerald-400";
  if (percent >= 60) return "text-lime-400";
  if (percent >= 40) return "text-amber-400";
  return "text-rose-400";
}

export default function DealCard({ deal }: { deal: Deal }) {
  const savings = Math.round(Number(deal.savings));
  const ratingPercent = Number(deal.steamRatingPercent);
  const ratingCount = Number(deal.steamRatingCount);
  const metacritic = Number(deal.metacriticScore);
  const steamUrl = steamStoreUrl(deal.steamAppID);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 transition-colors hover:border-cyan-400/40 hover:bg-zinc-900">
      <a
        href={dealRedirectUrl(deal.dealID)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-231/87 overflow-hidden bg-zinc-800"
      >
        {/* Thumbs come from Steam's CDN; a plain img avoids remote-image config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={deal.thumb}
          alt={deal.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {savings > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-cyan-500 px-2 py-0.5 text-sm font-bold text-zinc-950 shadow">
            -{savings}%
          </span>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
          {deal.title}
        </h3>

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
          </div>

          <div className="flex flex-col items-end gap-1 text-xs">
            {ratingCount > 0 && (
              <span className={ratingTone(ratingPercent)}>
                {ratingPercent}% · {deal.steamRatingText}
              </span>
            )}
            {metacritic > 0 && (
              <span className="text-zinc-400">Metacritic {metacritic}</span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href={dealRedirectUrl(deal.dealID)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-md bg-cyan-500 px-3 py-1.5 text-center text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            Get deal
          </a>
          {steamUrl && (
            <a
              href={steamUrl}
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
