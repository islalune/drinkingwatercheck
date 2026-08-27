// Shared water-quality model. Same role as FloodZoneCheck's flood-model.js
// and HeatPumpPayback's heatpump-model.js: the one place that turns raw
// EPA SDWA numbers (src/data/systems.csv) into what a page shows, so the
// generator and any future API route cannot disagree about a system's
// standing.
//
// The decision a reader is actually making is not "what's my risk score"
// (there is no single EPA number for that - a composite score built from
// unrelated violation categories would be invented, not measured) but
// "should I filter my water, and for what." So the model's output is not a
// score, it is a STATUS (how urgent) plus a CONCERN CATEGORY (what kind of
// problem, if any) that maps directly to a filter class - the same
// categories revenue.md's tiered filter-affiliate CTA is built around.

/**
 * EPA's violation/contaminant labels mix specific contaminants (Lead,
 * Nitrate, TTHM) with treatment-technique RULE names (Surface Water
 * Treatment Rule, Groundwater Rule) that describe a required PROCESS, not a
 * single chemical. Both are real signals - a treatment-technique violation
 * means the required safeguard against microbial contamination wasn't in
 * place, not that a specific microbe was measured. Categorized from the 66
 * distinct labels actually observed in systems.csv (see
 * src/data/systems-sources.json for the source), not guessed.
 */
const CONCERN_CATEGORIES = [
  {
    id: 'lead-copper',
    label: 'Lead & copper',
    filterClass: 'lead',
    severity: 4, // corrosion-related lead exposure has no safe threshold - highest urgency
    match: [/lead/i, /copper/i],
  },
  {
    id: 'microbial',
    label: 'Microbial contamination / treatment technique',
    filterClass: 'microbial',
    severity: 3, // acute-illness risk (E. coli, Cryptosporidium, Giardia) when the safeguard fails
    match: [
      /coliform/i, /surface water treatment/i, /groundwater rule/i,
      /filtration/i, /disinfection/i, /disinfectant/i,
    ],
  },
  {
    id: 'disinfection-byproducts',
    label: 'Disinfection byproducts',
    filterClass: 'carbon',
    severity: 2, // long-term exposure risk, not acute
    match: [/^TTHM$/i, /haloacetic/i, /bromate/i, /chlorite/i, /disinfectants and disinfection byproducts/i],
  },
  {
    id: 'nitrate',
    label: 'Nitrate / nitrite',
    filterClass: 'reverse-osmosis',
    severity: 3, // acute risk to infants (methemoglobinemia)
    match: [/nitrate/i, /nitrite/i],
  },
  {
    id: 'radionuclides',
    label: 'Radionuclides',
    filterClass: 'reverse-osmosis',
    severity: 3,
    match: [/radium/i, /uranium/i, /gross alpha/i, /radionuclide/i],
  },
  {
    id: 'metals',
    label: 'Other regulated metals',
    filterClass: 'reverse-osmosis',
    severity: 2,
    match: [
      /arsenic/i, /barium/i, /cadmium/i, /chromium/i, /selenium/i, /thallium/i,
      /antimony/i, /beryllium/i, /mercury/i, /nickel/i, /fluoride/i, /cyanide/i, /asbestos/i,
    ],
  },
  {
    id: 'organic-chemicals',
    label: 'Synthetic organic chemicals / pesticides / VOCs',
    filterClass: 'carbon',
    severity: 2,
    // Catch-all for the long tail of specific organics (benzene, atrazine,
    // vinyl chloride, trichloroethylene, ...) that are individually rare
    // per-system but numerous in the code list. Matched last, after every
    // more specific category above has had first refusal.
    match: [/.+/],
  },
];

function categorize(label) {
  const clean = String(label || '').trim();
  if (!clean) return null;
  for (const cat of CONCERN_CATEGORIES) {
    if (cat.match.some((re) => re.test(clean))) return cat;
  }
  return null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * EPA's SDWIS is state-reported, and casing is inconsistent across primacy
 * agencies: system names and rule/contaminant labels arrive as either
 * normal prose ("Lead and Copper Rule") or ALL CAPS ("LEAD AND COPPER RULE
 * REVISIONS") for the exact same underlying thing, sometimes both in the
 * same row's semicolon list. Left alone, the shouted version flows straight
 * into a page's h1/title/body verbatim - "CHICAGO, IL Water Quality",
 * "flagged from: LEAD AND COPPER RULE REVISIONS" - a database dump, not a
 * sentence. Only touches strings with no lowercase letter at all, so
 * anything already reported sanely is left exactly as EPA sent it.
 */
export function humanizeShout(raw) {
  const s = String(raw || '');
  if (!s || /[a-z]/.test(s)) return s;
  let i = 0;
  return s.replace(/[A-Za-z']+/g, (word) => {
    const first = i++ === 0;
    const lower = word.toLowerCase();
    if (!first && CONNECTOR.has(lower)) return lower;
    return word[0] + word.slice(1).toLowerCase().replace(/(?<=['-])[a-z]/g, (c) => c.toUpperCase());
  });
}
const CONNECTOR = new Set(['of', 'and', 'the', 'for', 'at', 'in', 'on', 'a', 'an', 'to']);

/**
 * Parses the semicolon-joined contaminants_ever_flagged column into
 * deduplicated concern categories, ranked most-severe first. Unrecognized
 * labels are kept out of the ranked list but counted, so an unmapped future
 * EPA code doesn't silently vanish from view.
 */
export function concernCategories(row) {
  const raw = String(row.contaminants_ever_flagged || '')
    .split(';').map((s) => s.trim()).filter(Boolean);

  const seen = new Map();
  let unmapped = 0;
  for (const label of raw) {
    const cat = categorize(label);
    if (!cat) { unmapped += 1; continue; }
    if (!seen.has(cat.id)) seen.set(cat.id, { ...cat, labels: [] });
    seen.get(cat.id).labels.push(humanizeShout(label));
  }
  const ranked = [...seen.values()].sort((a, b) => b.severity - a.severity);
  return { ranked, unmappedCount: unmapped, totalLabels: raw.length };
}

/**
 * The status a reader actually needs: is there a live problem right now.
 * Ordered by urgency, not by count - one currently-unaddressed violation
 * outranks a high historical count from a decade ago.
 */
export function violationStatus(row) {
  const unaddressed = num(row.violations_health_based_currently_unaddressed) || 0;
  const recent5y = num(row.violations_health_based_last5y) || 0;
  const everHealth = num(row.violations_health_based_ever) || 0;
  const everAny = num(row.violations_total_ever) || 0;

  if (unaddressed > 0) return { level: 'unaddressed', label: 'Unresolved health violation on record' };
  if (recent5y > 0) return { level: 'recent', label: 'Health violation in the last 5 years' };
  if (everHealth > 0) return { level: 'past', label: 'Past health violation, none in the last 5 years' };
  if (everAny > 0) return { level: 'non-health', label: 'Only non-health (reporting/monitoring) violations on record' };
  return { level: 'clean', label: 'No violations on record' };
}

/**
 * Full per-system summary - the shape a page or future API route consumes.
 * Every field a page renders should come from here, not be recomputed
 * inline, so a future API endpoint returns the same numbers the static
 * pages show.
 */
export function summarizeSystem(row) {
  const status = violationStatus(row);
  const concerns = concernCategories(row);
  const primary = concerns.ranked[0] ?? null;

  // Systems test less often as they get smaller (documented in
  // systems-sources.json) - a "clean" record on a very small system is
  // weaker evidence than the same record on a large one, so the page copy
  // needs this distinction, not a silently identical "clean" badge for both.
  const population = num(row.population_served);
  const sparseTestingCaveat = status.level === 'clean' && population !== null && population < 10000;

  return {
    pwsid: row.pwsid,
    name: row.name,
    state: row.state,
    countiesServed: row.counties_served,
    citiesServed: row.cities_served,
    population,
    serviceConnections: num(row.service_connections),
    ownerType: row.owner_type,
    sourceWaterType: row.source_water_type,
    status,
    concernCategories: concerns.ranked.map((c) => ({
      id: c.id, label: c.label, filterClass: c.filterClass, contaminants: c.labels,
    })),
    unmappedContaminantCount: concerns.unmappedCount,
    primaryConcern: primary ? { id: primary.id, label: primary.label, filterClass: primary.filterClass } : null,
    recommendedFilterClass: primary ? primary.filterClass : null,
    sparseTestingCaveat,
    mostRecentViolationDate: row.most_recent_violation_date || null,
    mostRecentHealthViolationDate: row.most_recent_health_violation_date || null,
    lastReportedDate: row.last_reported_date || null,
  };
}

export const CONCERN_CATEGORY_IDS = CONCERN_CATEGORIES.map((c) => c.id);
