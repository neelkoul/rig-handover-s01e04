import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { savePreview } from '../scripts/preview.js';

describe('savePreview', () => {
  const original = process.env.LANE_MARKER;
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-preview-'));
  });
  afterEach(() => {
    if (original === undefined) delete process.env.LANE_MARKER;
    else process.env.LANE_MARKER = original;
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves one self-contained HTML file with the marker', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const file = await savePreview('2026-10-28', dir);
    const html = readFileSync(file, 'utf8');
    expect(file).toBe(join(dir, 'digest-2026-10-28.html'));
    expect(html).toContain('TEST-MARKER');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('src=');
    expect(html).not.toContain('<link');
  });

  it('saves the clean copy with LANE_MARKER unset', async () => {
    process.env.LANE_MARKER = '';
    const html = readFileSync(await savePreview('2026-10-28', dir), 'utf8');
    expect(html).toContain('no marker set');
    expect(html).not.toContain('TEST-MARKER');
  });

  it('rejects a night that does not exist', async () => {
    await expect(savePreview('1999-01-01', dir)).rejects.toThrow(/\d{3}/);
  });
});
