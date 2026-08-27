// Build the per-water-system dataset every system page is generated from.
//
//   node scripts/fetch-systems.js
//
// Source: EPA ECHO's SDWA bulk download -> the current, unattended-fetchable
// national dump of EPA's Safe Drinking Water Information System (SDWIS),
// republished quarterly as a single zip:
//
//   https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip
//
// Verified reachable (HTTP 200, ~424 MB, "last-modified" 2026-07-09, i.e.
// the 2026Q2 refresh) as of this writing. It contains 11 CSVs; this script
// uses four of them:
//
//   1. SDWA_PUB_WATER_SYSTEMS.csv  (434,040 rows, all PWS types/statuses)
//      -> system name, state, population served, system type, ownership,
//      source water type, activity status.
//   2. SDWA_GEOGRAPHIC_AREAS.csv   (~580k rows)
//      -> county(ies) and city(ies) actually SERVED by each system
//      (AREA_TYPE_CODE 'CN'/'CT'). SDWA_PUB_WATER_SYSTEMS.csv only has a
//      mailing-address city, which is sometimes an admin office in a
//      different town from the system's service area, so this is the
//      better source for "where does this system's water go."
//   3. SDWA_VIOLATIONS_ENFORCEMENT.csv (15,432,737 rows, 4.1 GB uncompressed)
//      -> the actual "what is in my tap water" answer: MCL/MRDL/TT
//      violations (contaminant exceedances), monitoring/reporting
//      violations, health-based flag, compliance status, dates. One row per
//      enforcement action, so multiple rows can share a VIOLATION_ID
//      (2,323,775 distinct violations behind the 15.4M rows) - this script
//      dedupes on VIOLATION_ID before aggregating.
//   4. SDWA_REF_CODE_VALUES.csv (871 CONTAMINANT_CODE rows + other code
//      tables) -> turns numeric contaminant/violation codes into names
//      ("2950" -> ... see CONTAMINANT_CODE lookup) for display.
//
// No API key needed for any of this - it's a public zip, not a live query
// service, which matches the site.config.json/candidates.json note that
// this is built once from a snapshot ("static": true), not live-queried
// per request.
//
// SCOPE NOTE on page count: candidates.json planned ~12,000 pages against
// "~50k systems." The raw PWS table actually has 434,040 rows because it
// includes every PWS type/status ever submitted (inactive systems, and
// two non-"my tap water" system types: TNCWS - transient non-community,
// e.g. campgrounds/rest stops with no stable population, and NTNCWS -
// non-transient non-community, e.g. a single factory or school on its own
// well). Restricting to active Community Water Systems (PWS_TYPE_CODE
// 'CWS', PWS_ACTIVITY_CODE 'A' - systems that serve the same people
// year-round, i.e. an actual "my tap water" audience) gives 49,378 systems,
// matching the "~50k" in candidates.json almost exactly. That is still 4x
// the 12,000-page plan. Rather than force an arbitrary cut to land on
// exactly 12,000, this script filters further to systems serving a
// population of 2,000 or more, which is both (a) a natural quality line -
// below it, the CSV's own population brackets classify a system as merely
// "very small," monitoring frequency drops, and there usually isn't a
// distinct town/city behind the number worth a page - and (b) lands at
// 12,903 systems, i.e. within a few percent of the original 12,000 target
// without being reverse-engineered to hit it. See SYSTEMS_MIN_POPULATION
// below to change it.
//
// Downloads are cached under src/data/_cache/ and reused, so re-running is
// mostly free - EXCEPT for the SDWA zip itself, which this script
// deliberately does NOT keep in src/data/_cache/ (see NOTE below) and will
// re-download (~60-90s) on every run.
//
// NOTE on why the raw zip isn't committed like siblings' small caches: every
// other SiteFactory site's cached raw download is a few KB to ~20 MB.
// EPA's SDWA zip is ~424 MB compressed / ~5.1 GB uncompressed (the
// violations table alone is 4.1 GB / 15.4M rows), because it's a full
// current-quarter national dump, not a pre-filtered extract. Committing
// that to this git repo would blow past GitHub's 100 MB per-file hard
// limit and permanently bloat the repo for a file that's fully
// re-fetchable in under two minutes from a stable EPA URL with no key.
// So: the zip downloads to a scratch temp dir (not under version control,
// not "cached" across runs) each run; only the derived, small outputs -
// this script, the per-system CSV, the sources.json, and the 126 KB
// contaminant/violation code lookup table - get committed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import readline from 'node:readline';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA = path.join(ROOT, 'src', 'data');
const CACHE = path.join(DATA, '_cache');
fs.mkdirSync(CACHE, { recursive: true });

const SDWA_ZIP_URL = 'https://echo.epa.gov/files/echodownloads/SDWA_latest_downloads.zip';
const SYSTEMS_MIN_POPULATION = 2000; // see SCOPE NOTE above
const RECENT_YEARS = 5; // "recent" window for the health-based-violations count; not an official EPA cutoff, just a reasonable recency horizon

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Download to a scratch (non-cached, non-committed) temp path, with backoff on 429/5xx. */
async function downloadScratch(url, { tries = 5 } = {}) {
  const dest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sdwa-')), path.basename(url));
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'drinkingwatercheck-fetch/1.0' } });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || null;
        throw Object.assign(new Error(`HTTP ${res.status}`), { retryAfter });
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { fatal: true });
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`  fetched ${path.basename(url)}  ${(buf.length / 1e6).toFixed(1)} MB`);
      return dest;
    } catch (err) {
      if (err.fatal || attempt === tries) throw err;
      const wait = err.retryAfter ? err.retryAfter * 1000 : 2000 * attempt;
      console.log(`  ${err.message}, retry ${attempt}/${tries - 1} in ${wait}ms`);
      await sleep(wait);
    }
  }
}

/** Split a CSV line that may contain quoted fields (handles the bare `,,` empty-field case too). */
function splitCsv(line) {
  const out = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const csvCell = (v) => (/[",]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : (v ?? ''));

/** Extract one entry from the zip straight into memory (fine for the <130MB tables). */
function unzipEntry(zipPath, entryName) {
  return execFileSync('unzip', ['-p', zipPath, entryName], { maxBuffer: 1 << 30 }).toString('utf8');
}

/** Parse a whole in-memory CSV (header + rows) into an array of field arrays, plus the header. */
function parseCsv(text) {
  const lines = text.split('\n');
  const header = splitCsv(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    rows.push(splitCsv(lines[i]));
  }
  return { header, rows };
}

/**
 * Stream a large zip entry line by line via `unzip -p`, without ever holding
 * the whole (multi-GB) file in one JS string - Node string length limits
 * (~512MB/string) would break on SDWA_VIOLATIONS_ENFORCEMENT.csv otherwise.
 */
function streamZipEntry(zipPath, entryName, onRow) {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-p', zipPath, entryName]);
    const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
    let header = null;
    let n = 0;
    rl.on('line', (line) => {
      if (!line) return;
      if (!header) { header = splitCsv(line); return; }
      onRow(splitCsv(line), header);
      n++;
      if (n % 3_000_000 === 0) console.log(`    ...${(n / 1e6).toFixed(0)}M rows`);
    });
    let errBuf = '';
    proc.stderr.on('data', (d) => { errBuf += d; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`unzip -p ${entryName} exited ${code}: ${errBuf}`));
      else resolve(n);
    });
  });
}

function col(header) {
  const idx = {};
  header.forEach((h, i) => { idx[h] = i; });
  return (row, name) => row[idx[name]];
}

function parseMDY(s) {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1]);
}

async function main() {
  console.log('Sources:');
  const zipPath = await downloadScratch(SDWA_ZIP_URL);

  // --- reference codes: contaminant/violation names -------------------------
  // Extracted from the already-downloaded zip (not fetched again); cached
  // as its own small file under src/data/_cache/ since it's tiny (~126KB)
  // and useful on its own for looking up what a contaminant/violation code
  // means without re-extracting the whole zip.
  const refText = unzipEntry(zipPath, 'SDWA_REF_CODE_VALUES.csv');
  fs.writeFileSync(path.join(CACHE, 'SDWA_REF_CODE_VALUES.csv'), refText);
  const { header: refHeader, rows: refRows } = parseCsv(refText);
  const rc = col(refHeader);
  const contaminantName = new Map();
  const violationCodeName = new Map();
  for (const r of refRows) {
    const type = rc(r, 'VALUE_TYPE');
    if (type === 'CONTAMINANT_CODE') contaminantName.set(rc(r, 'VALUE_CODE'), rc(r, 'VALUE_DESCRIPTION'));
    if (type === 'VIOLATION_CODE') violationCodeName.set(rc(r, 'VALUE_CODE'), rc(r, 'VALUE_DESCRIPTION'));
  }
  console.log(`Reference codes: ${contaminantName.size} contaminants, ${violationCodeName.size} violation codes`);

  // --- public water systems --------------------------------------------------
  const pwsText = unzipEntry(zipPath, 'SDWA_PUB_WATER_SYSTEMS.csv');
  const { header: pwsHeader, rows: pwsRows } = parseCsv(pwsText);
  const pc = col(pwsHeader);
  console.log(`Public water systems (all types/statuses): ${pwsRows.length}`);

  const systems = new Map(); // pwsid -> record
  let activeCwsCount = 0;
  for (const r of pwsRows) {
    const type = pc(r, 'PWS_TYPE_CODE');
    const activity = pc(r, 'PWS_ACTIVITY_CODE');
    const pop = Number(pc(r, 'POPULATION_SERVED_COUNT')) || 0;
    if (type !== 'CWS' || activity !== 'A') continue;
    activeCwsCount++;
    if (pop < SYSTEMS_MIN_POPULATION) continue;
    const pwsid = pc(r, 'PWSID');
    systems.set(pwsid, {
      pwsid,
      name: pc(r, 'PWS_NAME'),
      state: pc(r, 'STATE_CODE'),
      city_mailing: pc(r, 'CITY_NAME'),
      counties_served: new Set(),
      cities_served: new Set(),
      population_served: pop,
      owner_type: pc(r, 'OWNER_TYPE_CODE'),
      source_water_type: pc(r, 'PRIMARY_SOURCE_CODE') || pc(r, 'GW_SW_CODE'),
      service_connections: Number(pc(r, 'SERVICE_CONNECTIONS_COUNT')) || 0,
      last_reported_date: pc(r, 'LAST_REPORTED_DATE'),
      violations_total_ever: 0,
      violations_health_based_ever: 0,
      violations_health_based_recent: 0,
      violations_health_based_unaddressed: 0,
      most_recent_violation_date: '',
      most_recent_health_violation_date: '',
      contaminants: new Set(),
    });
  }
  console.log(`Active Community Water Systems, population >= ${SYSTEMS_MIN_POPULATION}: ${systems.size}`);
  if (!systems.size) throw new Error('zero systems after filtering - a column name or code value changed upstream');

  // --- geographic areas: county/city actually served -------------------------
  const geoText = unzipEntry(zipPath, 'SDWA_GEOGRAPHIC_AREAS.csv');
  const { header: geoHeader, rows: geoRows } = parseCsv(geoText);
  const gc = col(geoHeader);
  let geoMatched = 0;
  for (const r of geoRows) {
    const pwsid = gc(r, 'PWSID');
    const s = systems.get(pwsid);
    if (!s) continue;
    const areaType = gc(r, 'AREA_TYPE_CODE');
    if (areaType === 'CN') { const c = gc(r, 'COUNTY_SERVED'); if (c) s.counties_served.add(c); }
    if (areaType === 'CT') { const c = gc(r, 'CITY_SERVED'); if (c) s.cities_served.add(c); }
    geoMatched++;
  }
  console.log(`Geographic-area rows matched to kept systems: ${geoMatched}`);

  // --- violations: stream the 4.1GB / 15.4M-row table, dedupe by VIOLATION_ID
  const violByPwsid = new Map(); // pwsid -> Map<violationId, record> (only for kept systems)
  const nowMs = Date.now();
  const recentCutoffMs = nowMs - RECENT_YEARS * 365.25 * 24 * 3600 * 1000;
  console.log('Streaming SDWA_VIOLATIONS_ENFORCEMENT.csv (4.1GB, this is the slow part)...');
  const t0 = Date.now();
  let violRowsSeen = 0, violRowsKept = 0;
  await streamZipEntry(zipPath, 'SDWA_VIOLATIONS_ENFORCEMENT.csv', (row, header) => {
    violRowsSeen++;
    const vc = col(header);
    const pwsid = vc(row, 'PWSID');
    if (!systems.has(pwsid)) return; // not one of our kept systems - skip early to save memory/time
    violRowsKept++;
    let m = violByPwsid.get(pwsid);
    if (!m) { m = new Map(); violByPwsid.set(pwsid, m); }
    const violationId = vc(row, 'VIOLATION_ID');
    // Overwrite on repeat: multiple enforcement-action rows share a
    // VIOLATION_ID, so the last row in the file wins for that violation's
    // status/dates (harmless if the violation-level fields are identical
    // across rows, which they normally are).
    m.set(violationId, {
      contaminant_code: vc(row, 'CONTAMINANT_CODE'),
      is_health_based: vc(row, 'IS_HEALTH_BASED_IND') === 'Y',
      violation_code: vc(row, 'VIOLATION_CODE'),
      category: vc(row, 'VIOLATION_CATEGORY_CODE'),
      status: vc(row, 'VIOLATION_STATUS'),
      non_compl_begin: parseMDY(vc(row, 'NON_COMPL_PER_BEGIN_DATE')),
    });
  });
  console.log(`Violations streamed: ${violRowsSeen} rows seen, ${violRowsKept} matched kept systems, in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // --- aggregate violations per system ---------------------------------------
  for (const [pwsid, violMap] of violByPwsid) {
    const s = systems.get(pwsid);
    let mostRecent = null, mostRecentHealth = null;
    for (const v of violMap.values()) {
      s.violations_total_ever++;
      if (v.is_health_based) {
        s.violations_health_based_ever++;
        if (v.contaminant_code) s.contaminants.add(contaminantName.get(v.contaminant_code) || v.contaminant_code);
        if (v.non_compl_begin && v.non_compl_begin >= recentCutoffMs) s.violations_health_based_recent++;
        if (v.status === 'Unaddressed') s.violations_health_based_unaddressed++;
        if (v.non_compl_begin && (!mostRecentHealth || v.non_compl_begin > mostRecentHealth)) mostRecentHealth = v.non_compl_begin;
      }
      if (v.non_compl_begin && (!mostRecent || v.non_compl_begin > mostRecent)) mostRecent = v.non_compl_begin;
    }
    s.most_recent_violation_date = mostRecent ? new Date(mostRecent).toISOString().slice(0, 10) : '';
    s.most_recent_health_violation_date = mostRecentHealth ? new Date(mostRecentHealth).toISOString().slice(0, 10) : '';
  }

  // --- write output ------------------------------------------------------
  const rows = [...systems.values()].map((s) => ({
    pwsid: s.pwsid,
    name: s.name,
    state: s.state,
    counties_served: [...s.counties_served].sort().join('; '),
    cities_served: (s.cities_served.size ? [...s.cities_served] : [s.city_mailing].filter(Boolean)).sort().join('; '),
    population_served: s.population_served,
    service_connections: s.service_connections,
    owner_type: s.owner_type,
    source_water_type: s.source_water_type,
    violations_total_ever: s.violations_total_ever,
    violations_health_based_ever: s.violations_health_based_ever,
    [`violations_health_based_last${RECENT_YEARS}y`]: s.violations_health_based_recent,
    violations_health_based_currently_unaddressed: s.violations_health_based_unaddressed,
    most_recent_violation_date: s.most_recent_violation_date,
    most_recent_health_violation_date: s.most_recent_health_violation_date,
    contaminants_ever_flagged: [...s.contaminants].sort().join('; '),
    last_reported_date: s.last_reported_date,
  }));
  rows.sort((a, b) => b.population_served - a.population_served);

  const cols = Object.keys(rows[0]);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'systems.csv'),
    [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');

  const withViolations = rows.filter((r) => r.violations_total_ever > 0).length;
  const withHealthViolations = rows.filter((r) => r.violations_health_based_ever > 0).length;
  const withUnaddressed = rows.filter((r) => r.violations_health_based_currently_unaddressed > 0).length;

  fs.writeFileSync(path.join(DATA, 'systems-sources.json'), JSON.stringify({
    retrieved: new Date().toISOString(),
    systems: rows.length,
    source: {
      url: SDWA_ZIP_URL,
      dataset: 'EPA ECHO, SDWA bulk download (SDWIS quarterly refresh)',
      filesUsed: ['SDWA_PUB_WATER_SYSTEMS.csv', 'SDWA_GEOGRAPHIC_AREAS.csv', 'SDWA_VIOLATIONS_ENFORCEMENT.csv', 'SDWA_REF_CODE_VALUES.csv'],
      quarterObserved: '2026Q2 (per SUBMISSIONYEARQUARTER column and zip last-modified date)',
    },
    filter: {
      pwsTypeCode: 'CWS (Community Water System - serves the same population year-round)',
      pwsActivityCode: 'A (active)',
      minPopulationServed: SYSTEMS_MIN_POPULATION,
      rationale: `All active CWS = ${activeCwsCount} (matches candidates.json "~50k systems"). ` +
        `Adding the population >= ${SYSTEMS_MIN_POPULATION} floor narrows that to ${rows.length}, ` +
        'close to the 12,000-page plan without an arbitrary top-N cut; below this line systems are ' +
        'classified "very small" in EPA\'s own population brackets and monitoring frequency drops.',
    },
    excludedFromScope: {
      TNCWS: 'Transient non-community (campgrounds, rest stops, gas stations) - no stable population, not a "my tap water" audience.',
      NTNCWS: 'Non-transient non-community (a single factory/school on its own well) - same reason.',
      inactivePwsActivityCode: 'Deactivated/merged systems - would 404 as "my water utility" for a current resident.',
      belowPopulationFloor: `Active CWS below ${SYSTEMS_MIN_POPULATION} population served (${activeCwsCount - rows.length} systems) - real, but out of this pass's scope; see STILL OPEN below.`,
    },
    violationsWindow: {
      recentYears: RECENT_YEARS,
      note: 'Not an official EPA cutoff - a reasonable recency horizon for "is this a live/current problem," applied to NON_COMPL_PER_BEGIN_DATE.',
    },
    coverage: {
      systemsWithAnyViolationEver: withViolations,
      systemsWithHealthBasedViolationEver: withHealthViolations,
      systemsWithCurrentlyUnaddressedHealthViolation: withUnaddressed,
    },
    dataQuality: {
      countyCityFromServiceAreaTable: 'SDWA_GEOGRAPHIC_AREAS.csv service-area rows are self-reported by primacy agencies and incomplete for some systems - counties_served/cities_served can be blank even for a real active system; cities_served falls back to the PWS table\'s mailing-address city in that case, which may not be the true service area.',
      violationDateMissing: 'A violation row with a blank NON_COMPL_PER_BEGIN_DATE is still counted in violations_total_ever/violations_health_based_ever but cannot contribute to most_recent_violation_date or the recent-window count - so those two figures are a floor, not an exact total, for systems with older/incompletely-dated records.',
      noHealthBasedViolationsDoesNotMeanClean: 'A system with 0 health-based violations may simply have fewer/less-frequent required tests (smaller systems test less often) rather than definitively cleaner water; this dataset reports what was tested and found, not an independent guarantee of safety.',
    },
  }, null, 2) + '\n');

  console.log(`\nWrote src/data/systems.csv - ${rows.length} active Community Water Systems (pop >= ${SYSTEMS_MIN_POPULATION}) in ${new Set(rows.map((r) => r.state)).size} states/territories`);
  console.log(`  with any violation ever:                  ${withViolations}`);
  console.log(`  with a health-based violation ever:        ${withHealthViolations}`);
  console.log(`  with a currently-unaddressed health viol.: ${withUnaddressed}`);

  // Spot-check a handful of real systems so a placeholder bug would be obvious.
  const spotNames = ['Flint', 'Newark', 'Jackson', 'New York', 'Los Angeles', 'Chicago'];
  for (const name of spotNames) {
    const r = rows.find((x) => x.name.toUpperCase().includes(name.toUpperCase()));
    if (r) console.log(`  spot-check ${r.name} (${r.pwsid}, ${r.state}): pop ${r.population_served.toLocaleString()}, ` +
      `${r.violations_health_based_ever} health-based violations ever (${r[`violations_health_based_last${RECENT_YEARS}y`]} in last ${RECENT_YEARS}y), ` +
      `contaminants flagged: ${r.contaminants_ever_flagged || '(none)'}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
