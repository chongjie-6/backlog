// A stand-in Steam library so the full personalization pipeline runs end-to-end
// before a real STEAM_API_KEY / login is wired up. Real appIDs + plausible
// playtimes that paint a clear taste: heavy RPG / Strategy / Action, light Puzzle.

import type { OwnedGame } from "./taste";

export const DEMO_STEAM_ID = "demo";

export const demoLibrary: OwnedGame[] = [
  { appid: 570, playtimeMinutes: 50000 }, // Dota 2 — Strategy/Action
  { appid: 292030, playtimeMinutes: 12000 }, // The Witcher 3 — RPG
  { appid: 289070, playtimeMinutes: 8000 }, // Civilization VI — Strategy
  { appid: 1086940, playtimeMinutes: 9000 }, // Baldur's Gate 3 — RPG
  { appid: 1145360, playtimeMinutes: 6000 }, // Hades — Action/RPG/Indie
  { appid: 413150, playtimeMinutes: 4000 }, // Stardew Valley — Indie/RPG/Sim
  { appid: 367520, playtimeMinutes: 3000 }, // Hollow Knight — Action/Adventure/Indie
  { appid: 105600, playtimeMinutes: 2500 }, // Terraria — Action/Adventure/RPG/Indie
  { appid: 730, playtimeMinutes: 1500 }, // CS2 — Action/FPS
  { appid: 271590, playtimeMinutes: 1000 }, // GTA V — Action/Adventure
  { appid: 1174180, playtimeMinutes: 800 }, // Red Dead Redemption 2 — Action/Adventure
  { appid: 322330, playtimeMinutes: 600 }, // Don't Starve Together — Survival/Indie
  { appid: 400, playtimeMinutes: 30 }, // Portal — Puzzle (barely played, low weight)
];
