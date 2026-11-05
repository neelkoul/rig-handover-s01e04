import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Saves /digest/<night> as one self-contained HTML file (plan § 3, ADR 0001, ADR 0003).
// Builds the app in-process: no server, no port. The lane banner comes from LANE_MARKER.
export async function savePreview(night: string, outDir: string): Promise<string> {
  const res = await createApp(loadConfig()).request('/digest/' + night);
  if (res.status !== 200) throw new Error(`/digest/${night} answered ${res.status}`);
  const html = await res.text();
  for (const forbidden of ['<script', 'src=', '<link']) {
    if (html.includes(forbidden)) throw new Error(`page is not self-contained: contains "${forbidden}"`);
  }
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `digest-${night}.html`);
  writeFileSync(file, html);
  return file;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const night = process.argv[2];
  if (!night) {
    console.error('usage: pnpm preview <night>   e.g. pnpm preview 2026-10-28');
    process.exit(1);
  }
  try {
    console.log(await savePreview(night, 'var/preview'));
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
