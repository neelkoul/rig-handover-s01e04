import { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { isNight, readNight } from './read.js';
import { NO_OWNER } from './types.js';

// Plan morning-digest § 2a (issue #3). The page reads the same Digest as the JSON will (ADR 0001):
// rows in readNight's order, no client JS.
export function digestPageRoutes(config: RigConfig): Hono {
  const routes = new Hono();

  routes.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!isNight(night)) return c.text('no such night', 404);
    const digest = readNight(config.runsDir, night);
    if (digest === null) return c.text('no such night', 404);
    const { rows, badLines } = digest;

    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <h1>digest {night}</h1>
        {rows.length === 0 ? (
          <p class="mute">nothing ran</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>job</th>
                <th>owner</th>
                <th>runs</th>
                <th>retries</th>
                <th>last</th>
                <th>last error</th>
                <th>first</th>
                <th>last at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr class={r.retries >= 3 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                  <td>{r.job}</td>
                  <td>{r.owner ?? NO_OWNER}</td>
                  <td>{r.runs}</td>
                  <td>{r.retries}</td>
                  <td>{r.lastStatus}</td>
                  <td>{r.lastError ?? ''}</td>
                  <td>{r.firstAt}</td>
                  <td>{r.lastAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {badLines > 0 ? <p class="mute">bad lines: {badLines}</p> : null}
      </Layout>,
    );
  });

  return routes;
}
