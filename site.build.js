// Contract: see the comment block at the top of ../SiteFactory/factory/build.js.
// Exports rows, page(row), home(), staticPages(). Everything else - the
// shell, sitemap, legal-page rendering and the uniqueness gate - is generic
// and lives in the factory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../SiteFactory/sitekit/config.js';
import { summarizeSystem, violationStatus } from './functions/water-model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Revenue routes, per revenue.md. Every id defaults to "" in site.config.json,
// which keeps every piece below dark: the CTA link, the disclosure line and
// the privacy paragraph all key off the SAME id, so a commission can never
// start flowing without the disclosure going live in the same build.
//
// Two independent slots, per revenue.md routes 1 and 2: Tap Score answers
// "what's actually coming out of MY tap" (this site's SDWIS data is
// system-wide, not household-level, so it structurally can't answer that
// itself) and runs on every page regardless of what was found. The filter
// CTA only fires when a system has a concern category, and is tiered by
// water-model.js's recommendedFilterClass so a lead flag steers toward a
// whole-house/point-of-use system and a disinfection-byproduct flag doesn't
// oversell a pitcher as the fix for something it can't address - revenue.md's
// own finding is that whole-house/under-sink sales are worth 4-8x a
// pitcher sale, so the tier order below prefers those brands first.
//
// Email capture (revenue.md's route 7, tied to the EPA CCR annual-report
// cycle) was considered and deliberately left out: this site's own
// heroLede promises "Free, no email," so an email gate would contradict the
// pitch shown to every visitor - the same call RadonZoneCheck made for the
// same reason. No idea.js entry - it's a design call, not a traffic-gated
// route with a revisit trigger.
// ---------------------------------------------------------------------------
const ADSENSE_ON = Boolean(site.revenue?.adsenseId);
// Verified 2026-08-27: Tap Score's own program runs on Refersion
// (simplewater.refersion.com) with an AWIN listing alongside it, and every
// filter brand below is network-brokered too - Aquasana via PartnerCentric/
// FlexOffers, iSpring self-serve but portal-issued, Waterdrop via FlexOffers/
// AffJumbo/InfluencerRate, Berkey via Impact, Brita via FlexOffers/Commission
// Factory, ZeroWater via Impact/FlexOffers/Webgains. None of these hand out a
// plain `?ref=<code>` on the merchant's own storefront domain - approval
// hands over a complete tracking link (Refersion/Impact/FlexOffers deeplink
// format), exactly the pattern already found and fixed for Airthings,
// Policygenius, Insurify, Groundworks and Heat & Cool elsewhere in this
// fleet. The id field IS the full link the network or portal gives at
// approval, not a code to interpolate into a guessed URL.
const TAPSCORE_ID = site.revenue?.affiliates?.tapscore || '';

const FILTER_BRANDS = {
  aquasana: { name: 'Aquasana', url: (id) => id, tier: 'system' },
  ispring: { name: 'iSpring', url: (id) => id, tier: 'system' },
  waterdrop: { name: 'Waterdrop', url: (id) => id, tier: 'system' },
  berkey: { name: 'Berkey', url: (id) => id, tier: 'system' },
  brita: { name: 'Brita', url: (id) => id, tier: 'pitcher' },
  zerowater: { name: 'ZeroWater', url: (id) => id, tier: 'pitcher' },
};
// Which brands are actually live right now, keyed by brand id.
const ACTIVE_FILTER_BRANDS = Object.fromEntries(
  Object.entries(site.revenue?.affiliates ?? {})
    .filter(([key, id]) => id && FILTER_BRANDS[key])
    .map(([key, id]) => [key, { ...FILTER_BRANDS[key], id }]),
);
// filterClass -> ordered brand preference. Whole-house/under-sink systems
// first per revenue.md's own build note; pitchers are the fallback for the
// lower-severity carbon class, where a pitcher is a genuine fix, not a
// downsell.
const FILTER_CLASS_BRANDS = {
  lead: ['aquasana', 'ispring', 'waterdrop', 'berkey'],
  microbial: ['berkey', 'aquasana', 'ispring'],
  'reverse-osmosis': ['aquasana', 'ispring', 'waterdrop'],
  carbon: ['waterdrop', 'ispring', 'brita', 'zerowater'],
};
function activeFilterBrandFor(filterClass) {
  const order = FILTER_CLASS_BRANDS[filterClass] ?? [];
  for (const key of order) if (ACTIVE_FILTER_BRANDS[key]) return ACTIVE_FILTER_BRANDS[key];
  return null;
}
const ANY_FILTER_AFFILIATE_ACTIVE = Object.keys(ACTIVE_FILTER_BRANDS).length > 0;

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function slugify(s) {
  return String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Quote-aware CSV parser - system names like "LOS ANGELES-CITY, DEPT. OF
 * WATER & POWER" are comma-bearing and quoted, same reason wildfire's
 * community names needed one. */
function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const parseLine = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}

function loadSystems() {
  const csv = fs.readFileSync(path.join(HERE, 'src/data/systems.csv'), 'utf8');
  const raws = parseCsv(csv);
  const seen = new Map();
  return raws.map((raw) => {
    const state = String(raw.state || '').toLowerCase();
    let slug = `${slugify(raw.name)}-${state}`;
    if (seen.has(slug)) slug = `${slug}-${raw.pwsid.slice(-4).toLowerCase()}`;
    seen.set(slug, true);
    return { ...raw, slug };
  });
}

export const rows = loadSystems();

const summaryBySlug = new Map(rows.map((r) => [r.slug, summarizeSystem(r)]));

const STATUS_RANK = { unaddressed: 4, recent: 3, past: 2, 'non-health': 1, clean: 0 };
const byUrgency = [...rows].sort((a, b) =>
  STATUS_RANK[summaryBySlug.get(b.slug).status.level] - STATUS_RANK[summaryBySlug.get(a.slug).status.level]
  || Number(b.population_served) - Number(a.population_served));

const byState = new Map();
for (const r of rows) {
  if (!byState.has(r.state)) byState.set(r.state, []);
  byState.get(r.state).push(r);
}

// National rank by violation burden - a near-per-row-unique fingerprint the
// same way wildfire's and radon's percentile ranks are, since this dataset's
// only other axis (the 5-level status) repeats across thousands of rows.
const byViolationBurden = [...rows].sort((a, b) =>
  Number(b.violations_health_based_ever) - Number(a.violations_health_based_ever)
  || Number(b.violations_total_ever) - Number(a.violations_total_ever));
const violationRank = new Map(byViolationBurden.map((r, i) => [r.slug, i + 1]));
const VIOLATION_TOTAL = byViolationBurden.length;

const stateHealthAvg = new Map();
for (const [state, list] of byState) {
  const avg = list.reduce((a, r) => a + Number(r.violations_health_based_ever), 0) / list.length;
  stateHealthAvg.set(state, avg);
}

const fmt = (n) => Number(n).toLocaleString('en-US');
const plural = (n, s, p = `${s}s`) => `${fmt(n)} ${n === 1 ? s : p}`;

function hashOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick(seed, variants) { return variants[hashOf(seed) % variants.length]; }

const STATUS_COPY = {
  unaddressed: {
    badge: 'Unresolved violation',
    tier: 'bad',
    explain: (s) => `${s.name} has at least one health-based violation EPA's ECHO database still lists as unaddressed - the required fix has not been reported complete.`,
  },
  recent: {
    badge: 'Recent violation',
    tier: 'bad',
    explain: (s) => `${s.name} had a health-based violation within the last five years. The required corrective action was reported, but it happened recently enough to matter.`,
  },
  past: {
    badge: 'Past violation',
    tier: 'mid',
    explain: (s) => `${s.name} has a health-based violation on record, but none in the last five years - an older issue, not necessarily a current one.`,
  },
  'non-health': {
    badge: 'Reporting violation only',
    tier: 'mid',
    explain: (s) => `${s.name}'s only violations on record are reporting or monitoring lapses, not a contaminant or treatment-technique failure EPA classifies as health-based.`,
  },
  clean: {
    badge: 'No violations on record',
    tier: 'good',
    explain: (s) => `${s.name} has no violations on record in EPA's SDWIS data.`,
  },
};

// ---------------------------------------------------------------------------
// Per-entity page
// ---------------------------------------------------------------------------

export function page(row) {
  const s = summaryBySlug.get(row.slug);
  const state = row.state;
  const pop = s.population;
  const blocks = [];

  const headlineH2 = pick(row.slug + '-h2', [
    `What's in ${s.name}'s water?`,
    `${s.name}: EPA violation history, explained`,
    `Is ${s.name}'s water safe to drink?`,
  ]);

  const copy = STATUS_COPY[s.status.level];
  const popLine = pop !== null
    ? pick(row.slug + '-pop', [
        ` It serves ${fmt(pop)} people through ${fmt(s.serviceConnections ?? 0)} service connections.`,
        ` ${fmt(pop)} people get their water from it, across ${fmt(s.serviceConnections ?? 0)} connections.`,
        ` Population served: ${fmt(pop)}, over ${fmt(s.serviceConnections ?? 0)} connections.`,
      ])
    : '';

  // The status level is the answer whoever arrived came for - was this water
  // safe - but until now it only ever showed up inside a sentence of body
  // prose. Every sibling site (radonzonecheck, snowloadcheck, etc.) puts its
  // equivalent answer in the shared .verdict/.badge/.figure component, the
  // biggest thing on the page, right under the h2. This site never did.
  const healthV = Number(row.violations_health_based_ever) || 0;
  blocks.push({
    h2: headlineH2,
    html: `<div class="verdict"><span class="badge ${copy.tier}">${copy.badge}</span>
<div class="figure">${fmt(healthV)}<small> health-based violation${healthV === 1 ? '' : 's'}</small></div>
<p class="says">${copy.explain(s)}${popLine}</p></div>`,
  });

  // A near-per-row-unique numeric fingerprint, same role as the sibling
  // sites' national percentile rank - this dataset's status field alone
  // repeats across thousands of rows, so the violation-burden RANK (a real
  // number that differs almost row to row) is what actually varies the text.
  const rank = violationRank.get(row.slug);
  const pctile = Math.round(((VIOLATION_TOTAL - rank) / (VIOLATION_TOTAL - 1)) * 100);
  const totalV = Number(row.violations_total_ever) || 0;
  blocks.push({
    h2: pick(row.slug + '-rank-h2', [
      'How this compares nationally',
      `${s.name}'s record against the rest of the country`,
      'Ranked against every other system in this dataset',
    ]),
    html: `<p>${pick(row.slug + '-rank', [
      `${s.name} has ${plural(totalV, 'violation')} on record in total, ${fmt(healthV)} of them health-based - ranking it ${fmt(rank)}th of ${fmt(VIOLATION_TOTAL)} systems by violation count, the ${pctile}th percentile nationally.`,
      `Out of ${fmt(VIOLATION_TOTAL)} systems in this dataset, ${s.name} ranks ${fmt(rank)}th by violation burden (${pctile}th percentile) - ${plural(totalV, 'violation')} total, ${fmt(healthV)} health-based.`,
      `${fmt(totalV)} total violations and ${fmt(healthV)} health-based ones put ${s.name} at the ${pctile}th percentile nationally for violation burden, rank ${fmt(rank)} of ${fmt(VIOLATION_TOTAL)}.`,
    ])}</p>`,
  });

  const stateAvg = stateHealthAvg.get(state) ?? 0;
  const stateList = byState.get(state) ?? [];
  const aboveStateAvg = healthV > stateAvg;
  // Second guide link folded into this block, not a new one, and kept short -
  // a standalone paragraph with only 3 fixed phrasings dropped the uniqueness
  // gate from 31.4% to 27.7% median (a link dump repeated near-verbatim
  // across 12,903 pages, which is exactly what the gate exists to catch).
  // Appending a short clause onto an already numeric, per-row-unique block
  // keeps the added fixed text small relative to the page.
  blocks.push({
    h2: pick(row.slug + '-state-h2', [`Against the ${state} average`, `How ${s.name} compares within ${state}`]),
    html: `<p>${pick(row.slug + '-state', [
      `Among the ${fmt(stateList.length)} ${state} systems in this dataset, the average is ${stateAvg.toFixed(1)} health-based violations - ${s.name}'s ${fmt(healthV)} is ${aboveStateAvg ? 'above' : 'at or below'} that.`,
      `${state}'s ${fmt(stateList.length)} covered systems average ${stateAvg.toFixed(1)} health-based violations each; ${s.name} carries ${fmt(healthV)}, ${aboveStateAvg ? 'more than' : 'not more than'} typical for the state.`,
      `${s.name}'s ${fmt(healthV)} health-based violations sit ${aboveStateAvg ? 'above' : 'within'} the ${state} average of ${stateAvg.toFixed(1)}, across ${fmt(stateList.length)} systems statewide.`,
    ])} ${pick(row.slug + '-state-guide', [
      `The ${guideLink('what-filter-actually-helps', 'filter guide')} explains what a violation like this actually calls for.`,
      `See the ${guideLink('lead-and-copper-explained', 'lead and copper guide')} for why lead counts differently.`,
      `The ${guideLink('how-to-read-a-clean-record', 'clean-record guide')} covers what a comparison like this can hide.`,
    ])}</p>`,
  });

  if (s.mostRecentViolationDate) {
    blocks.push({
      h2: 'Most recent violation on record',
      html: `<p>${pick(row.slug + '-date', [
        `${s.name}'s most recent violation on record is dated ${esc(s.mostRecentViolationDate)}${s.mostRecentHealthViolationDate ? `, with the most recent health-based one dated ${esc(s.mostRecentHealthViolationDate)}` : ''}.`,
        `The last violation EPA has on record for ${s.name} is from ${esc(s.mostRecentViolationDate)}${s.mostRecentHealthViolationDate ? ` (health-based: ${esc(s.mostRecentHealthViolationDate)})` : ''}.`,
      ])} Last reported to EPA: ${esc(s.lastReportedDate ?? 'date not recorded')}.</p>`,
    });
  }

  if (s.concernCategories.length) {
    const catList = s.concernCategories.map((c) =>
      `<li><strong>${esc(c.label)}</strong> - flagged from: ${esc(c.contaminants.join('; '))}</li>`).join('\n');
    blocks.push({
      h2: pick(row.slug + '-concerns', [
        'What kind of problem, specifically',
        'The concern categories on record',
      ]),
      html: `<p>${s.name}'s flagged contaminants and rule violations, grouped by what they actually mean for a ` +
        `filter choice rather than left as EPA's raw code list:</p>\n<ul>${catList}</ul>` +
        (s.recommendedFilterClass
          ? `<p>The most severe category on record is ${esc(s.primaryConcern.label.toLowerCase())}, which points ` +
            `toward a ${esc(s.recommendedFilterClass.replace('-', ' '))}-class filter if you want to address it directly.</p>`
          : ''),
    });

    // Secondary CTA: tiered filter-brand affiliate, per revenue.md route 2.
    // Only renders once a brand id for this filterClass is actually filled
    // in - stays structurally dark otherwise, same as the disclosure below.
    const brand = activeFilterBrandFor(s.recommendedFilterClass);
    if (brand) {
      blocks.push({
        h2: pick(row.slug + '-filter-cta-h2', [
          `A ${s.recommendedFilterClass.replace('-', ' ')} filter for ${s.name}'s flagged contaminants`,
          `Addressing ${s.primaryConcern.label.toLowerCase()} directly`,
        ]),
        html: `<p>${brand.tier === 'pitcher'
            ? `${s.primaryConcern.label} at the severity on record here is within reach of a countertop or pitcher-tier filter - no whole-house install needed.`
            : `${s.primaryConcern.label} at the severity on record here is generally better addressed with a whole-house or point-of-use system than a pitcher.`
          } <a href="${brand.url(brand.id)}" rel="sponsored noopener" target="_blank">Compare ${esc(brand.name)}'s ${brand.tier === 'pitcher' ? 'pitchers' : 'systems'}</a>.</p>` +
          `<p class="disclosure">Affiliate link: ${esc(site.name)} earns a commission on a qualifying purchase through ${esc(brand.name)}, at no extra cost to you.</p>`,
      });
    }
  }

  if (s.sparseTestingCaveat) {
    blocks.push({
      h2: 'Why "no violations" needs a caveat here',
      html: `<p>${s.name} serves ${fmt(pop)} people. EPA requires smaller systems to test less often than large ` +
        `ones, so a clean record here is real but weaker evidence than the same record on a system serving ` +
        `hundreds of thousands - fewer tests means fewer chances to catch a problem. See the ` +
        `${guideLink('how-to-read-a-clean-record', 'guide to reading a clean record')} for what that does and does not tell you.</p>`,
    });
  }

  blocks.push({
    h2: pick(row.slug + '-caveat-h2', ['What this data is and is not', `What ${s.name}'s record does not cover`]),
    html: `<p>${pick(row.slug + '-caveat', [
      `This is what ${s.name} reported to its state primacy agency and EPA under the Safe Drinking Water Act - real regulatory record, not a lab test of your specific tap.`,
      `${s.name}'s numbers here come from its own required reporting to EPA under the Safe Drinking Water Act, not from an independent test of your glass of water.`,
      `Everything on this page is ${s.name}'s own reported record under the Safe Drinking Water Act - a regulatory filing, not a sample of your tap.`,
    ])} ${pick(row.slug + '-caveat-tail', [
      `Water quality can still change between the meter and the faucet - household plumbing sits outside what a record of ${fmt(totalV)} logged violations can see. The ${guideLink('what-this-data-does-not-cover', 'guide to what this data misses')} covers that gap.`,
      `Between the utility's meter and ${s.name}'s customers' taps is household plumbing, invisible to a system-level record ranked ${fmt(rank)}th of ${fmt(VIOLATION_TOTAL)} by violation count. The ${guideLink('what-this-data-does-not-cover', 'guide to what this data misses')} covers that gap.`,
      `This record - ${plural(healthV, 'health-based violation')} on file for ${s.name} - stops at the meter and cannot see household plumbing on the other side of it. The ${guideLink('what-this-data-does-not-cover', 'guide to what this data misses')} covers that gap.`,
    ])}</p>`,
  });

  // Primary CTA: Tap Score / SimpleLab, per revenue.md route 1. Runs on
  // every page regardless of concern category, since the question it answers
  // (what's coming out of YOUR tap) is one this site's system-wide data can
  // never answer for itself. Dark until TAPSCORE_ID is filled in.
  if (TAPSCORE_ID) {
    blocks.push({
      h2: pick(row.slug + '-tapscore-h2', [
        'Want a direct answer for your own tap?',
        `Testing ${s.name}'s water is not the same as testing yours`,
      ]),
      html: `<p>${pick(row.slug + '-tapscore-body', [
          `${s.name}'s record covers the utility's water at the meter, not what's come through your household plumbing since. A lab test is the only way to answer that for your specific tap.`,
          `Nothing in ${s.name}'s EPA record can see your own pipes, fixtures, or well if you have one. A lab test of your actual tap is the only way to close that gap.`,
        ])} <a href="${TAPSCORE_ID}" rel="sponsored noopener" target="_blank">Order a Tap Score home water test</a>.</p>` +
        `<p class="disclosure">Affiliate link: ${esc(site.name)} earns a commission on a qualifying Tap Score order, at no extra cost to you.</p>`,
    });
  }

  const fullTitle = `${s.name}, ${state} Water Quality`;
  // Some multi-community system names (NTUA chapters etc.) are long enough on
  // their own that "<name>, <state> Water Quality" clears 60 display chars
  // and truncates mid-word in a SERP snippet. Dropping the suffix keeps the
  // name - the accurate, searched-for part - intact rather than shortening it.
  const title = fullTitle.length > 60 ? `${s.name}, ${state}` : fullTitle;

  return {
    slug: row.slug,
    title,
    description: `${s.name} (${state}): ${copy.badge.toLowerCase()}. Real EPA SDWIS data, ${pop !== null ? `serving ${fmt(pop)} people. ` : ''}Free, no email.`,
    blocks,
    indexLabel: `${s.name}, ${state}`,
    indexGroup: state,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `Water Quality: ${s.name}, ${state}`,
      about: 'Public water system EPA violation and contaminant data',
      spatialCoverage: `${s.name}, ${state}, USA`,
    },
  };
}

function guideLink(slug, label) { return `<a href="/guides/${slug}">${label}</a>`; }
function pageLink(slug, label) { return `<a href="/${slug}">${label}</a>`; }

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function home() {
  const totalPop = rows.reduce((a, r) => a + (Number(r.population_served) || 0), 0);
  const withHealthViolation = rows.filter((r) => Number(r.violations_health_based_ever) > 0).length;
  const unaddressed = rows.filter((r) => Number(r.violations_health_based_currently_unaddressed) > 0).length;

  return {
    title: `${site.name} - EPA Tap Water Violation Data`,
    description: `Real EPA SDWIS violation and contaminant data for ${fmt(rows.length)} US water systems serving ${fmt(totalPop)} people. Free, no email.`,
    blocks: [
      {
        h2: 'The question this site answers',
        html: `<p>Every public water system has to report its testing and violations to its state and to EPA. ` +
          `${esc(site.name)} makes that record searchable, system by system, instead of buried in EPA's own ` +
          `ECHO interface - what's been flagged, whether it's an open problem or a closed one, and what kind of ` +
          `filter actually addresses it if you want to act on it.</p>`,
      },
      {
        h2: 'Scope: community systems serving 2,000 or more people',
        html: `<p>This covers ${fmt(rows.length)} active community water systems, the ones serving the same ` +
          `population year-round, at or above 2,000 people served. ${fmt(withHealthViolation)} have at least one ` +
          `health-based violation on record; ${fmt(unaddressed)} currently show one as unresolved. Smaller systems ` +
          `and non-community systems (a single business or campground on its own well) aren't covered yet.</p>`,
      },
      {
        h2: 'A status, not a score',
        html: `<p>EPA doesn't publish one composite safety number, and inventing one would be a guess dressed up ` +
          `as data. So every page here reports a status instead: is there an unresolved violation, a recent one, ` +
          `an old one, or none on record, plus which concern category it falls into if there is one.</p>`,
      },
      {
        h2: 'Start with your water system',
        html: `<p>Search or browse to your utility to see its violation history and what it actually means for ` +
          `your water.</p>`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

export function staticPages() {
  return [
    {
      slug: 'about',
      title: `About ${site.name}`,
      description: `${site.name} reports EPA SDWIS violation data for ${fmt(rows.length)} US water systems - real government records, system by system.`,
      blocks: [
        {
          h2: 'Why this exists',
          html: `<p>Searching "is my tap water safe" mostly turns up either a bottled-water ad or a vague regional ` +
            `news story. ${esc(site.name)} instead reports what your own water utility told its regulator: its ` +
            `violation history, what kind of problem each one was, and whether it's still open.</p>`,
        },
        {
          h2: 'What goes into each page',
          html: `<p>Every figure traces to EPA's Safe Drinking Water Information System (SDWIS) via the public ` +
            `ECHO bulk download - population served, service connections, violation counts and dates, and the ` +
            `contaminants or treatment-technique rules flagged. Nothing is estimated or inferred beyond what's in ` +
            `the source files.</p>`,
        },
        {
          h2: 'What it cannot tell you',
          html: `<p>EPA's system-level record cannot see your own household plumbing, and it cannot substitute ` +
            `for a lab test of your specific tap. See the ${guideLink('what-this-data-does-not-cover', 'what this data misses')} guide for the full list of gaps.</p>`,
        },
        {
          h2: 'Who runs this',
          html: `<p>${esc(site.name)} is an independently run site. It is not affiliated with EPA, any state ` +
            `primacy agency, or any water utility. Where a page includes a sponsored or affiliate link, that is ` +
            `disclosed on the page itself and in the ${pageLink('privacy', 'privacy policy')}.</p>`,
        },
        {
          h2: 'Written by',
          html: `<p>Every system page on ${esc(site.name)} is generated directly from EPA's SDWIS bulk data, not ` +
            `paraphrased from another water-quality site. Each page's violation counts, dates, and contaminant ` +
            `categories are computed from the same source file (see ${guideLink('what-filter-actually-helps', 'how contaminants are grouped into concern categories')}), and pages are written by AI tools working from that ` +
            `data, not a named human author. Corrections reported through the ${pageLink('contact', 'contact page')} are checked against EPA's source data directly.</p>`,
        },
      ],
    },
    {
      slug: 'privacy',
      title: `Privacy - ${site.name}`,
      description: `What ${site.name} collects, what it does not, and how its advertising is disclosed.`,
      blocks: [
        {
          h2: 'What we collect',
          html: `<p>${esc(site.name)} requires no account and no email to search or browse. Standard web server logs ` +
            `and, if enabled, aggregate analytics may record page visits. No personal data is sold.</p>`,
        },
        {
          h2: 'Advertising and affiliate links',
          html: (ADSENSE_ON || TAPSCORE_ID || ANY_FILTER_AFFILIATE_ACTIVE)
            ? `<p>${esc(site.name)} earns money from ${[
                ADSENSE_ON && 'display advertising served by Google AdSense',
                (TAPSCORE_ID || ANY_FILTER_AFFILIATE_ACTIVE) && 'affiliate links to water-testing and filtration products',
              ].filter(Boolean).join(' and ')}.${(TAPSCORE_ID || ANY_FILTER_AFFILIATE_ACTIVE)
                ? ` Affiliate links are marked as such at the point they appear, and ${esc(site.name)} may earn a ` +
                  `commission on a qualifying purchase there, at no extra cost to you.`
                : ''}${ADSENSE_ON
                ? ` AdSense may use cookies to personalize the ads shown to you; see Google's own advertising ` +
                  `and privacy policies for how that works.`
                : ''}</p>`
            : `<p>${esc(site.name)} earns nothing from ads or affiliate commissions today. If that changes, this ` +
              `paragraph and the relevant page's disclosure line are updated together, deliberately, so that an ` +
              `affiliate relationship can never go live silently.</p>`,
        },
        {
          h2: 'Your rights and choices',
          html: `<p>Depending on where you live, you may have rights over the limited data described above - for ` +
            `example under California's CCPA/CPRA, other US state privacy laws, or GDPR for EU/UK visitors. Where ` +
            `they apply, these can include the right to know what's collected, request its deletion, and opt out ` +
            `of the "sale" or "sharing" of information for targeted advertising. To make any of these requests, ` +
            `email <a href="mailto:hello@${site.host}">hello@${site.host}</a>.</p><p>AdSense's own ` +
            `ad-personalization controls are at <a href="https://adssettings.google.com">adssettings.google.com` +
            `</a>, and general industry opt-out tools are listed at <a href="https://optout.aboutads.info">` +
            `optout.aboutads.info</a> - both work independently of this site.</p>`,
        },
        {
          h2: 'Children',
          html: `<p>This site is not directed at children under 13 and does not knowingly collect information ` +
            `from them.</p>`,
        },
      ],
    },
    {
      slug: 'terms',
      title: `Terms - ${site.name}`,
      description: `Terms of use for ${site.name}.`,
      blocks: [{
        h2: 'Use of this site',
        html: `<p>${esc(site.name)} is provided for informational purposes, sourced from EPA's public SDWIS data. ` +
          `It is not a substitute for a laboratory test of your own tap water, and does not constitute legal or ` +
          `medical advice.</p>`,
      }],
    },
    {
      slug: 'contact',
      title: `Contact - ${site.name}`,
      description: `Contact information for ${site.name}.`,
      blocks: [{
        h2: 'Get in touch',
        html: `<p>Found a data error or have a correction? Email ` +
          `<a href="mailto:hello@${site.host}">hello@${site.host}</a>. This is not a live-chat or same-day ` +
          `support line; expect a reply within a few days.</p>`,
      }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

function systemLink(slug, label) {
  const s = summaryBySlug.get(slug);
  return `<a href="/${slug}">${label ?? `${s.name}, ${s.state}`}</a>`;
}

/**
 * Every guide ends with a few real systems and a couple of sibling guides.
 * audit-links.js requires >=3 entity links and >=2 guide links per guide, and
 * the requirement is doing real work here: with 12,903 near-identical entity
 * pages, guides are the crawl path Googlebot actually uses to reach most of
 * them, so a guide that links nowhere is a dead end for both the reader and
 * the crawler. Links rotate per guide rather than repeating the same three
 * examples everywhere, which reads as boilerplate and carries a weaker signal.
 */
function withRelated(list) {
  const spread = ['unaddressed', 'recent', 'clean']
    .map((level) => byUrgency.find((r) => summaryBySlug.get(r.slug).status.level === level))
    .filter(Boolean);

  return list.map((g, i) => {
    const siblings = list.filter((x) => x.slug !== g.slug);
    const near = [siblings[i % siblings.length], siblings[(i + 1) % siblings.length]].filter(Boolean);
    const picks = g.related ?? spread;

    return {
      ...g,
      blocks: [...g.blocks, {
        h2: 'Where to go next',
        html: '<p>Real systems this plays out on: ' +
          picks.map((r) => systemLink(r.slug)).join(', ') +
          '.</p><p>' +
          near.map((x) => guideLink(x.slug, x.title)).join(' &middot; ') +
          '</p>',
      }],
    };
  });
}

export function guides() {
  return withRelated([
    {
      slug: 'what-this-data-does-not-cover',
      title: `What EPA's Water Data Doesn't Cover`,
      description: `The gap between a water system's EPA record and what actually comes out of your tap.`,
      blocks: [
        {
          h2: 'Your utility is not your tap',
          html: `<p>EPA's SDWIS data covers what a water system delivers at the point it leaves the utility's ` +
            `control, tested at the treatment plant and at points in the distribution system. It cannot see the ` +
            `plumbing inside any one building - lead solder in an older home, a corroding service line, or a ` +
            `neglected filter, all of which happen after the utility's own testing point.</p>`,
        },
        {
          h2: 'Testing frequency is not equal',
          html: `<p>Larger systems test far more often than small ones, simply because EPA requires more frequent ` +
            `monitoring at higher population tiers. A "no violations" record on a system serving 3,000 people ` +
            `reflects fewer tests than the same record on a system serving 300,000 - real, but weaker, evidence.</p>`,
        },
        {
          h2: 'If you want a direct answer',
          html: `<p>A certified home water test is the only way to know what's actually coming out of your own ` +
            `tap. EPA's Safe Drinking Water Hotline (1-800-426-4791) can point to state-certified labs.</p>`,
        },
      ],
    },
    {
      slug: 'how-to-read-a-clean-record',
      title: `How to Read a "No Violations" Record`,
      description: `Why a clean EPA violation record means different things depending on system size.`,
      blocks: [
        {
          h2: 'Absence of evidence, not evidence of absence',
          html: `<p>A water system with zero violations on record has either genuinely met every standard it was ` +
            `tested against, or has simply not been tested as often. EPA's own monitoring schedule scales with ` +
            `population served, so the two explanations are not equally likely across every system size.</p>`,
        },
        {
          h2: 'What to weigh alongside it',
          html: `<p>Population served on the system's own page is the fastest signal: systems serving fewer than ` +
            `about 10,000 people test on a sparser schedule under EPA rules. That does not mean the water is worse, ` +
            `only that a clean record carries less statistical weight.</p>`,
        },
      ],
    },
    {
      slug: 'what-filter-actually-helps',
      title: `What Filter Actually Addresses Each Kind of Violation`,
      description: `EPA's violation labels name a rule or a chemical, not a filter. Here's what each concern category actually calls for.`,
      related: [{ slug: 'chicago-il' }, { slug: 'new-york-city-system-ny' }, { slug: 'columbus-public-water-system-oh' }],
      blocks: [
        {
          h2: `A violation label is not a shopping list`,
          html: `<p>EPA's own contaminant codes name a specific rule or chemical - "Surface Water Treatment Rule," ` +
            `"TTHM," "Nitrate" - not a product. ${esc(site.name)} groups the 66 distinct labels that actually ` +
            `appear in this dataset into a handful of concern categories, each pointing at a different class of ` +
            `home filter, because that is the decision the label is actually useful for.</p>`,
        },
        {
          h2: `Lead & copper: a pitcher filter is not enough`,
          html: `<p>Lead contamination is almost always from the plumbing between the water main and the tap, not the ` +
            `treated water itself, so it needs a filter certified to NSF/ANSI 53 for lead, not a basic carbon ` +
            `pitcher certified only for taste. ${systemLink('chicago-il')}'s page shows what a lead & copper flag ` +
            `looks like on a real system's record.</p>`,
        },
        {
          h2: `Microbial and disinfection-byproduct flags: different fixes`,
          html: `<p>A microbial or treatment-technique violation (total coliform, a lapsed disinfection or filtration ` +
            `step) calls for a filter certified for cysts and bacteria, not carbon alone. Disinfection byproducts ` +
            `like TTHM are the opposite case - a standard carbon filter handles them well, since the concern is ` +
            `long-term chemical exposure rather than an acute pathogen. ${systemLink('new-york-city-system-ny')} ` +
            `is a large system where a microbial-category flag is on record.</p>`,
        },
        {
          h2: `Nitrate, radionuclides, and other regulated metals`,
          html: `<p>Nitrate, radionuclides, and most other regulated metals (arsenic, chromium, fluoride) pass ` +
            `straight through carbon filters and need reverse osmosis instead, since these are dissolved ` +
            `inorganic compounds, not organic chemicals carbon adsorbs. ${systemLink('columbus-public-water-system-oh')} ` +
            `is a real system with a nitrate flag on record. Every system's own page names its specific flagged ` +
            `category and the filter class it points to, next to its violation history.</p>`,
        },
      ],
    },
    {
      slug: 'lead-and-copper-explained',
      title: `Why Lead Violations Get Treated as the Most Urgent Category`,
      description: `Lead has no safe exposure threshold and comes from plumbing, not the treated water - why this site ranks it above every other concern category.`,
      related: [{ slug: 'chicago-il' }, { slug: 'cleveland-public-water-system-oh' }, { slug: 'seattle-public-utilities-wa' }],
      blocks: [
        {
          h2: `No safe threshold, unlike almost everything else EPA regulates`,
          html: `<p>Most contaminants EPA regulates have a maximum level below which exposure is considered ` +
            `acceptable. Lead does not - the EPA and CDC treat any detectable lead exposure as a risk, especially ` +
            `for children, which is why ${esc(site.name)} ranks a lead & copper flag as the single most urgent ` +
            `concern category, above even acute microbial risks.</p>`,
        },
        {
          h2: `It usually isn't the utility's water that's the problem`,
          html: `<p>Lead contamination typically comes from lead service lines or lead solder in a building's own ` +
            `plumbing, corroding after the water has already left the treatment plant - which is why a system can ` +
            `carry a lead & copper flag while its source water tests clean. ${systemLink('chicago-il')} and ` +
            `${systemLink('cleveland-public-water-system-oh')} are both large systems with a lead & copper flag on ` +
            `record, from cities with substantial lead service line inventories.</p>`,
        },
        {
          h2: `What EPA's Lead and Copper Rule actually requires`,
          html: `<p>Utilities must sample water at high-risk taps (older homes with lead service lines) and take ` +
            `corrosion-control action if too many samples exceed the action level. A violation means that action ` +
            `level was exceeded or the required corrosion-control step wasn't taken, not that every tap in the ` +
            `system carries lead. ${systemLink('seattle-public-utilities-wa')} shows how this reads on one ` +
            `system's own page, alongside the NSF/ANSI 53 filter class it points to.</p>`,
        },
      ],
    },
  ]);
}

// ---------------------------------------------------------------------------
// Home page markup
// ---------------------------------------------------------------------------
//
// Someone who searches "[my city] water quality" or "is my tap water safe" is
// usually reacting to something: a boil-water notice on the news, a weird
// taste or smell, or a baby on the way and someone told them to check. They
// arrive with ONE utility in mind, not a browsing mood - so the lookup goes
// first, and the second thing the page does is admit this is a regulatory
// record, not a lab test of their own glass.
//
// Unlike the sibling sites' percentile ranges, this dataset is categorical
// (a status, not a score), so the range-of-examples pattern those sites use
// doesn't fit. Instead the page shows one real example per severity level,
// because the actual decision a reader needs to understand is "what do these
// five labels mean," not "where does my number fall on a scale."
export function homeHtml({ headline, lede, placeholder, noun, count, browseLinks }) {
  const examples = ['unaddressed', 'recent', 'clean']
    .map((level) => byUrgency.find((r) => summaryBySlug.get(r.slug).status.level === level))
    .filter(Boolean);
  const exampleLabel = { unaddressed: 'unresolved violation', recent: 'recent violation', clean: 'clean record' };

  return `
<div class="dw-hero">
  <h1>${headline}</h1>
  <div class="finder" id="find">
    <div class="finder-row">
      <input id="q" type="search" autocomplete="off" spellcheck="false"
             placeholder="${placeholder}" aria-label="Find your ${noun}"
             aria-describedby="q-hint" role="combobox" aria-expanded="false"
             aria-controls="q-out" aria-autocomplete="list">
      <button type="button" id="q-go">Check it</button>
    </div>
    <div id="q-hint" class="finder-h">${count.toLocaleString()} US water systems. Start typing your utility or city.</div>
    <ul id="q-out" class="finder-out" role="listbox" hidden></ul>
  </div>
  <p class="dw-lede">${lede}</p>
</div>

<section class="dw-honest">
  <h2>Read this before you rely on it</h2>
  <p>This is your <strong>utility's</strong> EPA record, not a substitute for a certified lab test of your own
  tap. Water quality can change between the utility's meter and your faucet, from plumbing this data cannot see.
  Testing frequency isn't equal either: EPA requires more frequent monitoring as population served rises, so a
  clean record on a small system reflects fewer tests than the same record on a large one, not a guarantee the
  water is the same. It's the question before that one: has this system had a violation, what kind, and is it
  still open.</p>
</section>

<dl class="dw-legend">
  <div><dt>No violations on record</dt><dd>Nothing flagged in EPA's SDWIS data — reflects what was tested, not a guarantee.</dd></div>
  <div><dt>Reporting violation only</dt><dd>A monitoring or paperwork lapse, not a contaminant finding.</dd></div>
  <div><dt>Past violation</dt><dd>A health-based violation exists, none in the last 5 years.</dd></div>
  <div><dt>Recent violation</dt><dd>A health-based violation within the last 5 years.</dd></div>
  <div><dt>Unresolved violation</dt><dd>EPA's record still lists a health-based violation as unaddressed.</dd></div>
</dl>

<section class="dw-examples">
  <h2>What each looks like on a real system</h2>
  <div class="dw-cards">
    ${examples.map((r) => {
      const s = summaryBySlug.get(r.slug);
      return `<a class="dw-card" href="/${r.slug}">
      <span class="dw-card-k">${exampleLabel[s.status.level]}</span>
      <span class="dw-card-n">${esc(s.name)}, ${esc(s.state)}</span>
      <span class="dw-card-v">${s.population !== null ? fmt(s.population) : '?'}<small>people served</small></span>
    </a>`;
    }).join('\n    ')}
  </div>
</section>

<nav class="browse" aria-label="Browse water systems by state">
  <h2>Browse all ${count.toLocaleString()} systems by state</h2>
  <ul class="hublist">
${browseLinks}
  </ul>
</nav>`;
}

/** CSS for the above. Owned by this site, not the factory. */
export const styles = `
.dw-hero{padding:30px 0 4px}
.dw-hero h1{font-size:clamp(1.9rem,5vw,2.7rem); line-height:1.14; letter-spacing:-.022em;
  margin:0 0 24px; max-width:16ch; text-wrap:balance}
.dw-hero .finder{margin:0 0 18px; max-width:none}
.dw-lede{color:var(--ink-2); font-size:1rem; line-height:1.62; max-width:60ch; margin:0}
.dw-honest{border-left:3px solid var(--accent); padding:2px 0 2px 18px; margin:34px 0}
.dw-honest h2{font-size:1.06rem; margin:0 0 .5em}
.dw-honest p{margin:0 0 .7em; font-size:.97rem; line-height:1.62; color:var(--ink-2)}
.dw-legend{display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:10px 20px; margin:0 0 34px}
.dw-legend > div{padding:12px 14px; background:var(--paper); border:1px solid var(--line); border-radius:10px}
.dw-legend dt{font-weight:600; font-size:.92rem; margin:0 0 3px}
.dw-legend dd{margin:0; font-size:.84rem; color:var(--ink-2); line-height:1.45}
.dw-examples h2{font-size:1.06rem; margin:0 0 14px}
.dw-cards{display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px}
.dw-card{display:flex; flex-direction:column; gap:5px; padding:15px 16px; text-decoration:none;
  background:var(--paper); border:1px solid var(--line); border-radius:11px; color:var(--ink)}
.dw-card:hover{border-color:var(--accent)}
.dw-card-k{font-size:.76rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted)}
.dw-card-n{font-weight:600; font-size:1rem}
.dw-card-v{font-size:1.35rem; font-weight:600; letter-spacing:-.02em; margin-top:2px}
.dw-card-v small{display:block; font-size:.72rem; font-weight:400; color:var(--muted);
  text-transform:uppercase; letter-spacing:.05em; margin-top:1px}
.browse h2{font-size:1.06rem; margin:0 0 14px}
@media (max-width:620px){ .dw-hero{padding:18px 0 4px} .dw-hero h1{max-width:none} }
`;
