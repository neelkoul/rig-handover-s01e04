import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Route tests for GET /digest/:night (page) and GET /api/digest/:night (JSON), plan § 2d.
// Uses its own temp runs dir; runs/ is never read or written here.

let runsDir: string;

const NIGHT_GOOD = '2026-11-02';
const NIGHT_EMPTY = '2026-11-03';
const NIGHT_BAD = '2026-11-04';

const config = () => ({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir });

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-'));
  // Jobs written out of order on purpose: the routes must sort by job.
  writeFileSync(
    join(runsDir, `${NIGHT_GOOD}.jsonl`),
    [
      '{"at":"2026-11-02T01:00:00+01:00","job":"sync/lane","status":"ok","owner":"rook"}',
      '{"at":"2026-11-02T02:00:00+01:00","job":"digest/render","status":"ok","owner":null}',
      '{"at":"2026-11-02T03:00:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
      '{"at":"2026-11-02T03:05:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
      '{"at":"2026-11-02T04:00:00+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, `${NIGHT_EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${NIGHT_BAD}.jsonl`),
    [
      '{"at":"2026-11-04T01:00:00+01:00","job":"sync/lane","status":"ok","owner":"rook"}',
      'this is not json',
      '',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('page 200 for a night on disk', async () => {
    const res = await createApp(config()).request(`/digest/${NIGHT_GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain(`<h1>digest ${NIGHT_GOOD}</h1>`);
    expect(html).toContain('digest/render');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('notes/backup');
    expect(html).toContain('sync/lane');
  });

  it('page 404 for a night with no file', async () => {
    const res = await createApp(config()).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('no such night');
  });

  it('page renders nothing ran for an empty night', async () => {
    const res = await createApp(config()).request(`/digest/${NIGHT_EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('page counts a bad line', async () => {
    const res = await createApp(config()).request(`/digest/${NIGHT_BAD}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('bad lines: 1');
  });

  it('page 404 for a malformed night', async () => {
    const res = await createApp(config()).request('/digest/..%2F..');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('no such night');
  });
});

describe('digest JSON', () => {
  it('json 200 with rows sorted by job', async () => {
    const res = await createApp(config()).request(`/api/digest/${NIGHT_GOOD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      night: string;
      rows: { job: string; owner: string | null }[];
      badLines: number;
    };
    expect(body.night).toBe(NIGHT_GOOD);
    expect(body.badLines).toBe(0);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['digest/render', 'fixtures/refresh', 'notes/backup', 'sync/lane']);
    expect(body.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
  });

  it('json 404 for a night with no file', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('json empty night has no rows', async () => {
    const res = await createApp(config()).request(`/api/digest/${NIGHT_EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: NIGHT_EMPTY, rows: [], badLines: 0 });
  });

  it('json counts a bad line', async () => {
    const res = await createApp(config()).request(`/api/digest/${NIGHT_BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { badLines: number };
    expect(body.badLines).toBe(1);
  });
});

describe('digest page and JSON agree', () => {
  it('page and json list the same jobs in the same order', async () => {
    const app = createApp(config());
    const html = await (await app.request(`/digest/${NIGHT_GOOD}`)).text();
    const body = (await (await app.request(`/api/digest/${NIGHT_GOOD}`)).json()) as {
      rows: { job: string }[];
    };
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
