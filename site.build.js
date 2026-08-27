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
    explain: (s) => `${s.name} has at least one health-based violation EPA's ECHO database still lists as unaddressed - the required fix has not been reported complete.`,
  },
  recent: {
    badge: 'Recent violation',
    explain: (s) => `${s.name} had a health-based violation within the last five years. The required corrective action was reported, but it happened recently enough to matter.`,
  },
  past: {
    badge: 'Past violation',
    explain: (s) => `${s.name} has a health-based violation on record, but none in the last five years - an older issue, not necessarily a current one.`,
  },
  'non-health': {
    badge: 'Reporting violation only',
    explain: (s) => `${s.name}'s only violations on record are reporting or monitoring lapses, not a contaminant or treatment-technique failure EPA classifies as health-based.`,
  },
  clean: {
    badge: 'No violations on record',
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

  blocks.push({ h2: headlineH2, html: `<p>${copy.explain(s)}${popLine}</p>` });

  // A near-per-row-unique numeric fingerprint, same role as the sibling
  // sites' national percentile rank - this dataset's status field alone
  // repeats across thousands of rows, so the violation-burden RANK (a real
  // number that differs almost row to row) is what actually varies the text.
  const rank = violationRank.get(row.slug);
  const pctile = Math.round(((VIOLATION_TOTAL - rank) / (VIOLATION_TOTAL - 1)) * 100);
  const totalV = Number(row.violations_total_ever) || 0;
  const healthV = Number(row.violations_health_based_ever) || 0;
  blocks.push({
    h2: pick(row.slug + '-rank-h2', [
      'How this compares nationally',
      `${s.name}'s record against the rest of the country`,
      'Ranked against every other system in this dataset',
    ]),
    html: `<p>${pick(row.slug + '-rank', [
      `${s.name} has ${plural(totalV, 'violation')} on record in total, ${plural(healthV, 'of them')} health-based - ranking it ${fmt(rank)}th of ${fmt(VIOLATION_TOTAL)} systems by violation count, the ${pctile}th percentile nationally.`,
      `Out of ${fmt(VIOLATION_TOTAL)} systems in this dataset, ${s.name} ranks ${fmt(rank)}th by violation burden (${pctile}th percentile) - ${plural(totalV, 'violation')} total, ${plural(healthV, 'health-based')}.`,
      `${fmt(totalV)} total violations and ${fmt(healthV)} health-based ones put ${s.name} at the ${pctile}th percentile nationally for violation burden, rank ${fmt(rank)} of ${fmt(VIOLATION_TOTAL)}.`,
    ])}</p>`,
  });

  const stateAvg = stateHealthAvg.get(state) ?? 0;
  const stateList = byState.get(state) ?? [];
  const aboveStateAvg = healthV > stateAvg;
  blocks.push({
    h2: pick(row.slug + '-state-h2', [`Against the ${state} average`, `How ${s.name} compares within ${state}`]),
    html: `<p>${pick(row.slug + '-state', [
      `Among the ${fmt(stateList.length)} ${state} systems in this dataset, the average is ${stateAvg.toFixed(1)} health-based violations - ${s.name}'s ${fmt(healthV)} is ${aboveStateAvg ? 'above' : 'at or below'} that.`,
      `${state}'s ${fmt(stateList.length)} covered systems average ${stateAvg.toFixed(1)} health-based violations each; ${s.name} carries ${fmt(healthV)}, ${aboveStateAvg ? 'more than' : 'not more than'} typical for the state.`,
      `${s.name}'s ${fmt(healthV)} health-based violations sit ${aboveStateAvg ? 'above' : 'within'} the ${state} average of ${stateAvg.toFixed(1)}, across ${fmt(stateList.length)} systems statewide.`,
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
    ])} Water quality can still change between the utility's meter and your faucet, from household plumbing that ` +
      `EPA's system-level data cannot see. See the ${guideLink('what-this-data-does-not-cover', 'guide to what this data misses')} for that gap.</p>`,
  });

  return {
    slug: row.slug,
    title: `${s.name}, ${state} Water Quality: EPA Violation Data`,
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

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function home() {
  const totalPop = rows.reduce((a, r) => a + (Number(r.population_served) || 0), 0);
  const withHealthViolation = rows.filter((r) => Number(r.violations_health_based_ever) > 0).length;
  const unaddressed = rows.filter((r) => Number(r.violations_health_based_currently_unaddressed) > 0).length;

  return {
    title: `${site.name} - What's Actually In Your Tap Water, From EPA Records`,
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
      ],
    },
    {
      slug: 'privacy',
      title: `Privacy - ${site.name}`,
      description: `${site.name} collects no personal data. No account, no email required to use it.`,
      blocks: [{
        h2: 'What we collect',
        html: `<p>${esc(site.name)} requires no account and no email to search or browse. Standard web server logs ` +
          `and, if enabled, aggregate analytics may record page visits. No personal data is sold.</p>`,
      }],
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
        html: `<p>Found a data error or have a correction? Contact the site through the details on ${esc(site.name)}'s About page.</p>`,
      }],
    },
  ];
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

export function guides() {
  return [
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
  ];
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
  <p>This is your <strong>utility's</strong> EPA record, not a test of your own tap. Water quality can change
  between the utility's meter and your faucet, from plumbing this data cannot see. It's the question before
  that one: has this system had a violation, what kind, and is it still open.</p>
</section>

<dl class="dw-legend">
  <div><dt>No violations on record</dt><dd>Nothing flagged in EPA's SDWIS data.</dd></div>
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
