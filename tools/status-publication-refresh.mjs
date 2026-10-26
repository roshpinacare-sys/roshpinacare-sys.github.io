#!/usr/bin/env node
/**
 * status-publication-refresh — G76-f (owner directive §5): Oct-26 truth refresh
 * of the front-door status publication.
 *
 * WHY: the static pages cite dated measurements ("generatedAt 2026-10-25T15:22Z",
 * chain head #79, clock 2026-10-25 16:09Z, build 2026-10-25T16:14Z). Those were
 * true when measured; a live status publication must be re-measured and re-stamped,
 * never hand-waved. This tool MEASURES every claim from its public source and
 * rewrites ONLY the claims it can re-measure. Anything unreachable stays as-is
 * (it carries its own honest date) and is recorded as a null-with-reason in the
 * receipt. Nothing is fabricated.
 *
 * MEASURED SOURCES (public, keyless-first; GH_TOKEN optional for rate headroom):
 *   - Domain/status.json            (raw main) → org status citation
 *   - GridWatch fleet-health.json   (raw main) → giant.html census citation
 *   - agent9-clock runs             (Actions API) → self-chaining clock line
 *   - sovereign-runner-kit/AGENT-COORDINATION.md (raw + commits API) → chain head
 *   - local git rev-parse           → build version stamp
 *
 * Zero dependencies. Run: node tools/status-publication-refresh.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/roshpinacare-sys';
const API = 'https://api.github.com/repos/roshpinacare-sys';
const H = {};
if (process.env.GH_TOKEN && process.env.GH_TOKEN.length > 20) H.Authorization = `token ${process.env.GH_TOKEN}`;
else if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.length > 20) H.Authorization = `token ${process.env.GITHUB_TOKEN}`;

const PAGES = ['index.html', 'index-en.html', 'giant.html', 'roast.html', 'standard.html'];
const measuredAt = new Date().toISOString();
const stampZ = `${measuredAt.slice(0, 16)}Z`; // YYYY-MM-DDTHH:MMZ — same shape as the old build stamp
const today = measuredAt.slice(0, 10);

const hhmm = (iso) => (iso ? iso.slice(11, 16) : '—');

async function rawText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'status-publication-refresh', ...H } });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

const M = {}; // measurements
const claims = []; // per-claim provenance log

function record(claim, files, before, after, source, measuredAtTs, reason) {
  claims.push({ claim, files, changed: before !== after, before: before !== after ? before : undefined, after: before !== after ? after : undefined, source: source ?? null, measuredAt: measuredAtTs ?? measuredAt, reason: reason ?? null });
}

// ---- 1. Domain/status.json (published truth the page cites) ----
let status = null;
try {
  status = JSON.parse(await rawText(`${RAW}/Domain/main/status.json`));
  M.statusJson = { generatedAt: status.generatedAt, summary: status.summary, reposPublic: status.pulse?.reposPublic ?? null, source: `${RAW}/Domain/main/status.json` };
} catch (e) {
  M.statusJson = { reason: String(e.message || e).slice(0, 120) };
}

// ---- 2. GridWatch fleet-health.json (giant census citation) ----
let gw = null;
try {
  gw = JSON.parse(await rawText(`${RAW}/GridWatch/main/state/fleet-health.json`));
  M.gridWatch = { generatedAt: gw.generatedAt ?? null, source: `${RAW}/GridWatch/main/state/fleet-health.json` };
} catch (e) {
  M.gridWatch = { reason: String(e.message || e).slice(0, 120) };
}

// ---- 3. agent9-clock runs (self-chaining clock) ----
let clock = null;
try {
  const r = await fetch(`${API}/agent9-clock/actions/runs?per_page=100`, { headers: { 'User-Agent': 'status-publication-refresh', ...H } });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const todayRuns = (d.workflow_runs || []).filter((x) => (x.created_at || '').startsWith(today));
  const succ = todayRuns.filter((x) => x.conclusion === 'success' && x.name === 'agent9-clock');
  const revivals = todayRuns.filter((x) => x.name === 'chain-revival');
  const revSucc = revivals.filter((x) => x.conclusion === 'success');
  clock = {
    beatsToday: succ.length,
    revivalsToday: revSucc.length,
    revivalRunsToday: revivals.length,
    lastRevivalAt: revSucc[0]?.created_at ?? null,
    lastBeatAt: succ[0]?.created_at ?? null,
    source: `${API}/agent9-clock/actions/runs (runs created ${today} UTC)`,
  };
  M.agent9Clock = clock;
} catch (e) {
  M.agent9Clock = { reason: String(e.message || e).slice(0, 120) };
}

// ---- 4. CONTINUED chain head ----
let chain = null;
try {
  const md = await rawText(`${RAW}/sovereign-runner-kit/main/AGENT-COORDINATION.md`);
  const heads = [...md.matchAll(/CONTINUED #(\d+)/g)].map((m) => parseInt(m[1], 10));
  const head = heads.length ? Math.max(...heads) : null;
  const c = await fetch(`${API}/sovereign-runner-kit/commits?path=AGENT-COORDINATION.md&per_page=1`, { headers: { 'User-Agent': 'status-publication-refresh', ...H } });
  const cj = c.status === 200 ? await c.json() : [];
  chain = {
    head,
    headCommitAt: Array.isArray(cj) && cj[0] ? cj[0].commit.committer.date : null,
    source: `${RAW}/sovereign-runner-kit/main/AGENT-COORDINATION.md + commits API?path=AGENT-COORDINATION.md`,
  };
  M.continuedChain = chain;
} catch (e) {
  M.continuedChain = { reason: String(e.message || e).slice(0, 120) };
}

// ---- 5. build version (local HEAD) ----
let headSha = null;
try { headSha = execSync('git rev-parse --short=8 HEAD', { cwd: ROOT }).toString().trim(); } catch {}
M.buildVersion = { head: headSha, source: 'git rev-parse --short=8 HEAD (this repo)', measuredAt };

// ---- 6. PATCH the pages (only re-measurable claims) ----
function patch(file, fn) {
  const p = join(ROOT, file);
  if (!existsSync(p)) return null;
  const before = readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) writeFileSync(p, after);
  return after !== before;
}

// 6a. build stamps (meta + comment + footer) across the build batch
const stampPatches = [];
for (const f of PAGES) {
  const changed = patch(f, (t) =>
    t
      .replace(/(<meta name="saos-build" content=")([^"]+)(")/, `$1${stampZ}$3`)
      .replace(/(<!-- SAOS-BUILD )([^ ]+)( -->)/, `$1${stampZ}$3`)
      .replace(/(נבנה: )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/, `$1${stampZ}`)
      .replace(/(built: )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/, `$1${stampZ}`)
      .replace(/גרסה ([a-f0-9]{6,10}) · נבנה (\d{4}-\d{2}-\d{2})/, headSha ? `גרסה ${headSha} · נבנה ${today}` : `גרסה $1 · נבנה ${today}`)
  );
  stampPatches.push({ file: f, changed: !!changed });
}

// 6b. org status citation (index he + en)
if (status && status.generatedAt && status.pulse) {
  const n = status.pulse.reposPublic;
  const ts = status.generatedAt.slice(0, 16) + 'Z';
  const heChanged = patch('index.html', (t) =>
    t.replace(/(<b class="mono">)(\d+)( ריפואיטוריז ציבוריים<\/b>)/, `$1${n}$3`)
     .replace(/(Domain\/status\.json, generatedAt )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/, `$1${ts}`)
  );
  const enChanged = patch('index-en.html', (t) =>
    t.replace(/(<b class="mono">)(\d+)( public repositories<\/b>)/, `$1${n}$3`)
     .replace(/(Domain\/status\.json, generatedAt )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/, `$1${ts}`)
  );
  record('org status citation (reposPublic + status.json generatedAt)', 'index.html + index-en.html', heChanged || enChanged ? 'count 40 / stamp 2026-10-25T15:22Z' : 'unchanged', `count ${n} / stamp ${ts}`, M.statusJson.source, status.generatedAt, (heChanged || enChanged) ? null : 'already at measured value or pattern not found — left untouched');
} else {
  record('org status citation (reposPublic + status.json generatedAt)', 'index.html + index-en.html', null, null, null, null, `status.json unreachable: ${M.statusJson.reason || 'unknown'} — dated Oct-25 claim left untouched (carries its own honest date)`);
}

// 6c. CONTINUED chain head
if (chain && chain.head) {
  const headAt = chain.headCommitAt || null;
  const heChanged = patch('index.html', (t) =>
    t.replace(/עומד על (\d+) החלטות \(ראש-השרשרת #(\d+) נמדד (\d{4}-\d{2}-\d{2}), קומיט ([^)]+)\) של sovereign-runner-kit/,
      headAt ? `עומד על ${chain.head} החלטות (ראש-השרשרת #${chain.head} נמדד ${measuredAt.slice(0, 10)}, קומיט ${headAt}) של sovereign-runner-kit` : t)
      .replace(/(<b class="mono">CONTINUED #)(\d+)(<\/b>)/, `$1${chain.head}$3`)
  );
  const enChanged = patch('index-en.html', (t) =>
    t.replace(/stands at (\d+) decisions \(chain head #(\d+) measured (\d{4}-\d{2}-\d{2}), commit ([^)]+)\) of sovereign-runner-kit/,
      headAt ? `stands at ${chain.head} decisions (chain head #${chain.head} measured ${measuredAt.slice(0, 10)}, commit ${headAt}) of sovereign-runner-kit` : t)
      .replace(/(<b class="mono">CONTINUED #)(\d+)(<\/b>)/, `$1${chain.head}$3`)
  );
  record('CONTINUED chain head', 'index.html + index-en.html', (heChanged || enChanged) ? 'head #79 / commit 2026-10-24T20:31Z' : 'unchanged', `head #${chain.head} / commit ${headAt ?? '—'}`, chain.source, chain.headCommitAt, (heChanged || enChanged) ? null : 'already at measured value or pattern not found — left untouched');
} else {
  record('CONTINUED chain head', 'index.html + index-en.html', null, null, null, null, `chain unreachable: ${M.continuedChain.reason || 'unknown'} — dated claim left untouched`);
}

// 6d. self-chaining clock line
if (clock && typeof clock.beatsToday === 'number') {
  const lastRev = clock.lastRevivalAt ? hhmm(clock.lastRevivalAt) + 'Z' : '—';
  const measStamp = `${measuredAt.slice(0, 16).replace('T', ' ')}Z`;
  const heChanged = patch('index.html', (t) =>
    t.replace(/(<b class="mono">)(\d+) פעימות-מוצלחות היום · (\d+) מחלצים היום \(אחרון ([^)]+)\)(<\/b>) — נמדד (\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z)/,
      `$1${clock.beatsToday} פעימות-מוצלחות היום · ${clock.revivalsToday} מחלצים היום (אחרון ${lastRev})$5 — נמדד ${measStamp}`)
  );
  const enChanged = patch('index-en.html', (t) =>
    t.replace(/(<b class="mono">)(\d+) successful beats today · (\d+) revivals today \(last ([^)]+)\)(<\/b>) — measured (\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z)/,
      `$1${clock.beatsToday} successful beats today · ${clock.revivalsToday} revivals today (last ${lastRev})$5 — measured ${measStamp}`)
  );
  record('self-chaining clock line', 'index.html + index-en.html', (heChanged || enChanged) ? '72 beats · 3 revivals, measured 2026-10-25 16:09Z' : 'unchanged', `${clock.beatsToday} beats · ${clock.revivalsToday} revivals (last ${lastRev}), measured ${measStamp}`, clock.source, measuredAt, (heChanged || enChanged) ? null : 'already at measured value or pattern not found — left untouched');
} else {
  record('self-chaining clock line', 'index.html + index-en.html', null, null, null, null, `agent9-clock runs unreachable: ${M.agent9Clock.reason || 'unknown'} — dated claim left untouched`);
}

// 6e. giant.html GridWatch census citation
if (M.gridWatch && M.gridWatch.generatedAt) {
  const ts = String(M.gridWatch.generatedAt).slice(0, 16) + 'Z';
  const beforeMatch = (readFileSync(join(ROOT, 'giant.html'), 'utf8').match(/GridWatch (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/) || [])[1] || null;
  const changed = patch('giant.html', (t) => t.replace(/(GridWatch )(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z)/, `$1${ts}`));
  record('GridWatch census citation', 'giant.html', beforeMatch, ts, M.gridWatch.source, M.gridWatch.generatedAt, changed ? null : (beforeMatch === ts ? 'already at measured value (idempotent re-run)' : 'pattern not found — left untouched'));
} else {
  record('GridWatch census citation', 'giant.html', null, null, null, null, `fleet-health.json unreachable: ${M.gridWatch.reason || 'unknown'} — dated claim left untouched`);
}

// 6f. sitemap lastmod — only the five touched root pages (nothing-erased law)
const sitemapChanged = patch('sitemap.xml', (t) =>
  t.replace(/(<url><loc>https:\/\/roshpinacare-sys\.github\.io\/<\/loc><lastmod>)(\d{4}-\d{2}-\d{2})(<\/lastmod>)/, `$1${today}$3`)
   .replace(/(<url><loc>https:\/\/roshpinacare-sys\.github\.io\/(giant|roast|index-en|standard)\.html<\/loc><lastmod>)(\d{4}-\d{2}-\d{2})(<\/lastmod>)/g, `$1${today}$4`)
);
stampPatches.push({ file: 'sitemap.xml (touched root pages only)', changed: !!sitemapChanged });

// ---- 7. RECEIPT ----
const receipt = {
  schema: 'saos/status-publication-refresh/1',
  at: measuredAt,
  task: 'G76-f — Oct-26 status publication refresh (owner directive §5)',
  measurements: M,
  claims,
  buildStamps: { stamp: stampZ, version: headSha, pages: stampPatches },
  law: 'only re-measured claims were rewritten; everything unreachable keeps its dated honest value and is logged here with a reason',
};
writeFileSync(join(ROOT, 'receipts', `status-truth-refresh-${today}.json`), JSON.stringify(receipt, null, 2));

console.log(JSON.stringify({
  state: 'ok',
  at: measuredAt,
  claimsChanged: claims.filter((c) => c.changed).length,
  claimsUntouched: claims.filter((c) => !c.changed).length,
  measurements: {
    statusJson: M.statusJson.generatedAt ?? null,
    gridWatch: M.gridWatch.generatedAt ?? null,
    agent9Clock: clock ? `${clock.beatsToday} beats / ${clock.revivalsToday} revivals` : null,
    continuedChain: chain ? `#${chain.head}` : null,
    buildVersion: headSha,
  },
}));
