// Plan morning-digest § 1 (issue #1). The contract every part of § 2 builds against:
// the page and the JSON both read one Digest from readNight, so they cannot disagree (ADR 0001).

export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of runs/<night>.jsonl. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One row per job for the night. */
export type DigestRow = {
  job: string;
  /** null is kept; views show it as "—". */
  owner: string | null;
  /** Lines seen for this job, any status. */
  runs: number;
  /** Lines with status "retry". */
  retries: number;
  lastStatus: RunStatus;
  /** Error of the last line that had one, or null. */
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Digest = {
  night: string;
  /** Sorted by job (plain string order). The page and the JSON keep this order. */
  rows: DigestRow[];
  /** Lines that did not parse as a RunLine. Counted, never thrown. */
  badLines: number;
};

/**
 * Reads runs/<night>.jsonl.
 * - Returns null when there is no file for that night (routes answer 404).
 * - An empty file gives { rows: [], badLines: 0 } ("nothing ran").
 * - Never throws on a bad line.
 * Callers check isNight(night) first; readNight must not be called with anything else.
 */
export type ReadNight = (runsDir: string, night: string) => Digest | null;

/** True only for YYYY-MM-DD. Anything else is 404 before the disk is touched. */
export type IsNight = (night: string) => boolean;

/** Short name for owner === null in views. */
export const NO_OWNER = '—';
