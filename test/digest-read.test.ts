import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isNight, readNight } from '../src/digest/read.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'digest-'));

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const d = readNight('runs', '2026-10-28')!;
    expect(d.rows.length).toBe(5);
    expect(d.badLines).toBe(1);
    const jobs = d.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    const by = (j: string) => d.rows.find((r) => r.job === j)!;
    expect(by('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok' });
    expect(by('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(by('digest/render').owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight(tmp(), '2026-01-01')).toBeNull();
  });

  it('empty file renders nothing ran: rows [] badLines 0', () => {
    const dir = tmp();
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('keeps owner null, skips blank lines, counts invalid shapes as bad', () => {
    const dir = tmp();
    const body = [
      '{"at":"a","job":"x","status":"ok","owner":null}',
      '',
      '{"at":"b","job":"x","status":"weird","owner":"o"}',
      '{"job":"x","status":"ok"}',
      '[]',
      'null',
      '',
    ].join('\n');
    writeFileSync(join(dir, '2026-01-03.jsonl'), body);
    const d = readNight(dir, '2026-01-03')!;
    expect(d.badLines).toBe(4);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0]!.owner).toBeNull();
    expect(d.rows[0]!.lastError).toBeNull();
  });
});

describe('isNight', () => {
  it('isNight rejects ../.. and 2026-1-1', () => {
    expect(isNight('../..')).toBe(false);
    expect(isNight('2026-1-1')).toBe(false);
    expect(isNight('2026-10-28')).toBe(true);
  });
});
