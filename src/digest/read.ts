import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Digest, DigestRow, IsNight, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

export const isNight: IsNight = (night) => /^\d{4}-\d{2}-\d{2}$/.test(night);

function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.includes(o.status)) return null;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
    } else {
      row.owner = line.owner;
      row.runs++;
      if (line.status === 'retry') row.retries++;
      row.lastStatus = line.status;
      row.lastAt = line.at;
      if (line.error !== undefined) row.lastError = line.error;
    }
  }
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  const digest: Digest = { night, rows, badLines };
  return digest;
};
