import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { isNight, readNight } from './read.js';

/** GET /api/digest/:night: the same Digest the page reads, as JSON (plan § 2b, ADR 0001). */
export function digestApiRoutes(config: RigConfig): Hono {
  const api = new Hono();

  api.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const digest = isNight(night) ? readNight(config.runsDir, night) : null;
    if (digest === null) return c.json({ error: 'no such night' }, 404);
    return c.json(digest);
  });

  return api;
}
