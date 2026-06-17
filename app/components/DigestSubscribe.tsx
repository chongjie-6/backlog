"use client";

import { useState } from "react";
import type { Preferences } from "@/lib/curatorTypes";

type State = "idle" | "saving" | "done" | "error";

/** Sign up for the daily email digest. Sends the current preferences along so
 *  the digest is curated the same way as the on-screen results. */
export default function DigestSubscribe({ prefs }: { prefs: Preferences }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      const res = await fetch("/api/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), prefs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't subscribe");
      setState("done");
      setMessage(`Daily picks will go to ${json.email}.`);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Couldn't subscribe");
    }
  }

  async function unsubscribe() {
    setState("saving");
    try {
      const res = await fetch("/api/digest/subscribe", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't unsubscribe");
      setState("idle");
      setEmail("");
      setMessage(json.removed ? "Unsubscribed and saved data deleted." : "No subscription found.");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Couldn't unsubscribe");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-200">Daily digest</p>
          <p className="text-xs text-zinc-500">
            Get your top matches emailed once a day, using these preferences.
          </p>
        </div>
        {state === "done" ? (
          <button
            onClick={unsubscribe}
            className="self-start text-xs text-zinc-500 hover:text-rose-300"
          >
            Unsubscribe &amp; delete data
          </button>
        ) : (
          <form onSubmit={subscribe} className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="rounded-md border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={state === "saving"}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-cyan-400 disabled:opacity-50"
            >
              {state === "saving" ? "…" : "Email me"}
            </button>
          </form>
        )}
      </div>
      {message && (
        <p
          className={
            "mt-2 text-xs " + (state === "error" ? "text-rose-300" : "text-emerald-300")
          }
        >
          {message}
        </p>
      )}
    </div>
  );
}
