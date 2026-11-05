import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';

export type NightSummary = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts jobs by their last status that night (ok / retry / fail). Nights with no readable file are skipped.
function summarizeNight(runsDir: string, night: string): NightSummary | null {
  const digest = readNight(runsDir, night);
  if (!digest) return null;
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const row of digest.rows) counts[row.lastStatus]++;
  return { night, ...counts };
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir).flatMap((night) => {
    const s = summarizeNight(config.runsDir, night);
    return s ? [s] : [];
  });
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}
