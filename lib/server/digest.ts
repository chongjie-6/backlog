// Render a daily "deals you'd like" email from a curation result.
//
// Pure string building (no I/O) so it's easy to preview and test. Email clients
// are picky: inline styles, table-free simple layout, absolute links. Deal links
// use the CheapShark redirect (their terms require it).

import type { CuratedDeal } from "@/lib/curatorTypes";

export interface DigestInput {
  recipientName?: string;
  topGenres: { genre: string; weight: number }[];
  deals: CuratedDeal[];
  /** absolute URL to manage/unsubscribe */
  manageUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildDigest(input: DigestInput): RenderedEmail {
  const deals = input.deals.slice(0, 6);
  const top = deals[0];
  const subject = top
    ? `${deals.length} deals for you — ${top.title} -${top.savings}%`
    : "Your game deals digest";

  const genreLine = input.topGenres
    .slice(0, 4)
    .map((g) => g.genre)
    .join(", ");

  const hi = input.recipientName ? `Hi ${esc(input.recipientName)},` : "Hi,";

  const text = [
    `${subject}`,
    "",
    `${hi}`,
    `Today's top discounts matched to your taste (${genreLine}):`,
    "",
    ...deals.map(
      (d, i) =>
        `${i + 1}. ${d.title} — $${d.salePrice} (-${d.savings}%)${d.isAllTimeLow ? " [all-time low]" : ""} · ${Math.round(
          d.score * 100,
        )}% match${d.matchedGenres.length ? ` · ${d.matchedGenres.slice(0, 3).join("/")}` : ""}\n   ${d.dealUrl}`,
    ),
    "",
    input.manageUrl ? `Manage or unsubscribe: ${input.manageUrl}` : "",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#e4e4e7">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#fff;margin:0 0 4px">Game Deal Curator</h1>
    <p style="color:#a1a1aa;font-size:13px;margin:0 0 20px">
      ${hi} here are today's discounts matched to your taste${genreLine ? ` (<span style="color:#22d3ee">${esc(genreLine)}</span>)` : ""}.
    </p>
    ${deals.map(dealRow).join("")}
    <p style="color:#52525b;font-size:11px;margin-top:24px;border-top:1px solid #27272a;padding-top:12px">
      Prices via CheapShark; genres via the Steam store. Not affiliated with Valve.
      ${input.manageUrl ? `<br><a href="${esc(input.manageUrl)}" style="color:#71717a">Manage preferences or unsubscribe</a>` : ""}
    </p>
  </div>
</body></html>`;

  return { subject, html, text };
}

function dealRow(d: CuratedDeal, i: number): string {
  const matchPct = Math.round(d.score * 100);
  const why = d.matchedGenres.slice(0, 3).join(" · ");
  return `<a href="${esc(d.dealUrl)}" style="display:block;text-decoration:none;margin-bottom:12px">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:10px;padding:12px;display:flex;gap:12px">
      <img src="${esc(d.thumb)}" width="120" height="45" alt="" style="border-radius:6px;flex:0 0 auto;object-fit:cover" />
      <div style="flex:1">
        <div style="color:#fafafa;font-size:14px;font-weight:bold">${i + 1}. ${esc(d.title)}</div>
        <div style="color:#34d399;font-size:14px;font-weight:bold">$${esc(d.salePrice)}
          <span style="color:#71717a;font-weight:normal;text-decoration:line-through">$${esc(d.normalPrice)}</span>
          <span style="color:#22d3ee">-${d.savings}%</span>
          ${d.isAllTimeLow ? `<span style="color:#fcd34d;font-size:11px">★ all-time low</span>` : ""}
        </div>
        <div style="color:#22d3ee;font-size:12px">${matchPct}% match${why ? ` · <span style="color:#a1a1aa">${esc(why)}</span>` : ""}</div>
      </div>
    </div>
  </a>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
