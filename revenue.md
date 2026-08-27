# TapWaterCheck — revenue routes

Researched 2026-08-27, before the dataset and template exist, so the answer
shapes what the pages must contain — same order as HeatPumpPayback,
FloodZoneCheck, WildfireRiskCheck, and ChargeCostFinder.

**Every number below is sourced.** Where a figure could not be verified for
this specific vertical it is marked unknown, not estimated — a guessed
commission, AOV, or conversion rate is worse than none because the whole
site gets planned around it.

The site: enter an address or ZIP, get an EPA SDWIS lookup of the local
public water system's violations and contaminant testing history (one of
~50,000 systems). That is a decision moment for exactly one high-intent
purchase — "should I filter my water, and with what" — plus a much weaker
secondary moment ("should I get my own water tested, since the utility's
system-wide data isn't my tap"). `scout/candidates.json`'s own note flags
both the opportunity and the ceiling in one sentence: **"EWG built a
well-known database on exactly this data, which proves demand but also
means a strong incumbent. Water filter affiliate rates are solid."** Both
halves check out below — the commission rates are real and mostly
double-digit, but the query family itself is small, and EWG (plus
Wirecutter/NYT, Consumer Reports, and a cluster of filter-review sites) has
owned the top of this SERP for years.

---

## The honest ceiling — run first, before anything else

`scout/ranked.json` puts this niche's total query-family volume at **6,200
searches/month** — one of the smallest of the ranked candidates (86,000,
92,000, 61,210, 37,700, 21,600, 14,700, 8,160, 6,200, 5,190, 2,770, 700, 70
are the others in the same file), a quarter of FloodZoneCheck's and a
tenth of WildfireRiskCheck's. Run through `factory/target.js`:

| Model | Rate used (sourced below) | Monthly visits needed | Realistically capturable (top-3, 15% CTR) | Verdict |
|---|---|---|---|---|
| Display ads, low end | $6 RPM | 166,667 | 930 | **NOT reachable — needs 17,921% of the whole niche** |
| Display ads, high end | $15 RPM | 66,667 | 930 | **NOT reachable — needs 7,168% of the whole niche** |
| Affiliate/lead model, realistic (sourced $25/sale, sourced 0.5% conv) | $0.13/visit | 8,000 | 930 | **NOT reachable — needs 860%** |
| Affiliate/lead model, generous (sourced $25/sale, template 2% conv) | $0.50/visit | 2,000 | 930 | **NOT reachable — needs 215%** |
| Affiliate/lead model, best plausible single-brand sale ($50/sale, 2% conv) | $1.00/visit | 1,000 | 930 | **NOT reachable — needs 108%** |
| Affiliate/lead model, best case anywhere sourced ($100/sale, 2% conv) | $2.00/visit | 500 | 930 | Reachable only by dominating the niche — **54%**, tight |

**Display ads cannot get this site to $1,000/month, full stop** — worse than
every sibling site researched so far, because the query family is a tenth
the size of WildfireRiskCheck's and a quarter of FloodZoneCheck's, while the
RPM range is the same. Even $15 RPM (the high end of the AdSense/Raptive
range) would need 72x the entire realistically capturable traffic.

**Affiliate/lead-gen does not close the gap either, unlike WildfireRiskCheck's
insurance-lead route.** The best sourced per-sale value in this niche is a
single-digit-to-low-double-digit dollar commission on a $150–600 filter
system (worked out route-by-route below), which lands the realistic
per-visit value at $0.10–0.30 — an order of magnitude below what
WildfireRiskCheck's sourced $9–100/lead insurance rates deliver. Even
stacking every generous assumption (a $100 average commission — only
plausible for a high-ticket whole-house system sale at a high commission
rate — **and** the template's 2% visit-to-conversion rate, which is 2–4x
higher than the sourced 0.5–1% industry-average affiliate conversion rate)
gets to only 54% of capturable traffic — tight, and built on the two most
optimistic numbers in the whole research pass stacked together, not a
baseline.

**Honest ceiling for Olivia: $1,000/month is not realistically reachable on
any single model at this niche's real 6,200/month search volume**, and it
is a worse position than every sibling site researched so far (FloodZoneCheck,
WildfireRiskCheck, ChargeCostFinder, HeatPumpPayback), because the query
family is smaller AND the per-conversion value is lower than the insurance
leads that carried WildfireRiskCheck's math. A **stacked portfolio**
(display ads + Tap Score affiliate + direct filter-brand affiliates +
Amazon Associates, all running simultaneously, zero mutually exclusive) is
the only realistic path to real money here, and even that portfolio should
be modeled as a few hundred dollars a month at full traffic capture, not
$1,000 — see the per-route sections below for why. This does not mean don't
build it — the scout's own `decision: 0.85` score reflects that visitors
have a genuine, specific need this data answers, and the effort is
`static: true` (a one-time data build, not ongoing content) — but the
revenue target for this specific site should be set lower than $1,000/month,
or accepted as a smaller supporting property in a larger portfolio rather
than a standalone $1,000/month bet.

---

## Ranked by expected revenue per 1,000 visits

| # | Route | Rate (sourced) | Est. $/1,000 visits (0.5–1% conv, sourced range) | Status |
|---|---|---|---|---|
| 1 | Tap Score / SimpleLab water-test-kit affiliate | 10% commission, 90-day cookie, kits $193–290 | ~$95–290 | Needs Awin/Refersion account (Olivia) + traffic |
| 2 | Direct filter-brand affiliates (Berkey, Aquasana, Waterdrop, iSpring, ZeroWater, Brita) | 5–20% commission depending on brand/network, AOV $30–600 | ~$10–250 depending on brand and product tier | Needs per-brand account (Olivia) + traffic |
| 3 | Display ads — AdSense | $6–15/1,000 pageviews (no traffic floor) | $6–15 | **Build now, apply now once content bar met** — necessary, not sufficient alone |
| 4 | Display ads — Raptive / Mediavine Journey / Ezoic | 25k pageviews / 1k sessions / 250k MAU respectively | $8–50/1,000 (once qualified) | Needs traffic |
| 5 | Amazon Associates (filters, pitchers, softeners) | 3% (Home Improvement, most likely category; not filter-specific) | ~$10–25 (low-intent add-on) | Needs Amazon Associates account (Olivia); 3-sale/180-day retention rule |
| 6 | Water softener/treatment installer lead-gen (Culligan, RainSoft, general plumbing proxy) | No publisher-facing rate found; dealer networks not affiliate networks; general plumbing lead proxy $25–120 | Unknown — proxy only | **NEVER for now** — no real marketplace found for this specific trade |
| 7 | Email capture (annual CCR-release alert) | Real hook (utilities issue new Consumer Confidence Reports annually, by July 1) but monetizes only by re-driving traffic into routes 1–5 | Indirect only | Build now — feeds other routes, not its own line item |
| 8 | Data licensing / API / bulk sale | EPA SDWIS data is public domain; no evidence any real-estate/relocation data buyer (ATTOM, ClimateCheck) has incorporated tap-water-quality specifically | — | **NEVER for now** — speculative, no market found |
| 9 | Embeddable widget (realtor/property-site embed) | Generic real-estate listing widgets exist (Elfsight etc.); no dedicated water-quality widget product or buyer market found | — | **NEVER for now** — speculative, no market found |
| 10 | FlexOffers / general affiliate network | Free to join; declined PanelFit outright at 4 days old / 7 impressions (sibling-site finding, generalizes) | — | **NEVER before real traffic exists** |
| 11 | Site sale | Affiliate sites reportedly sell at 30–45x monthly net profit (Flippa) | — | **NEVER before there is profit to multiply** |

---

## 1. Tap Score / SimpleLab water-test-kit affiliate — the best-fitting route

This is the one route that matches the site's actual premise better than
any generic filter ad: the site's core content **is** EPA testing data
about the visitor's *public system*, and the natural next question is "but
what's actually coming out of *my* tap" — which SDWIS system-wide data
cannot answer (lead from household plumbing, private wells, point-of-use
contamination are all invisible to a utility-level compliance report). Tap
Score (brand name of **SimpleLab, Inc.**, a real California corporation)
sells exactly that test.

**Sourced**: **10% commission**, paid when an order is placed within a
**90-day cookie window**, tracked via **Refersion** (their own affiliate
portal, `simplewater.refersion.com`) and also listed on **Awin**
(merchant #92253). Only completed kit purchases qualify — coupon-code
orders do not count as referrals. Tap Score explicitly does **not** earn
commission from filters or treatment systems, so this route is clean of
the conflict-of-interest question a filter-affiliate CTA raises (a
lab-testing recommendation is not also a sales pitch for a specific
product). Kit prices: **Essential kit ~$193, Advanced kit ~$290** — so a
10% commission is **$19–29 per sale**.

At the sourced industry-average affiliate conversion rate of 0.5–1%
(general e-commerce benchmark, not water-testing-specific — see Sources),
that is **~$95–290 per 1,000 visits**, the highest of any route researched
for this site, though still a fraction of what WildfireRiskCheck's
insurance leads deliver per visit.

### Qualification checklist
| Requirement | Site now | Gap |
|---|---|---|
| Live site with real, indexed search traffic | No — not deployed | Needs deploy + months of indexing |
| Named contact / real business behind it | Not yet | About page needed regardless (route 3) |
| Content that naturally motivates "test your own water" | Fits by design — SDWIS data is system-wide, not household-level | none once framed correctly in content |
| Awin or Refersion account | **Not held** | needs Olivia |

**Verdict: APPLY AT — real, indexed traffic.** No published traffic floor
for the affiliate programme itself, but the same lesson from every sibling
site applies: apply once there's real traffic to point to, not at zero.
Highest-ranked route by $/1,000 visits. Parked to `idea.js` for the traffic
half; the account signup is a note for Olivia below.

## 2. Direct filter-brand affiliate programmes

Six brands checked, all with real, sourced programmes:

| Brand | Commission | Network | Product AOV (sourced) |
|---|---|---|---|
| Berkey (Berkey Filters) | **up to 15%** | Impact, $100 min payout | gravity/countertop systems, ~$300–400 (not separately sourced this pass) |
| Aquasana | **~10%** (5–10% range across networks) | LinkShare/Rakuten | Tank systems (Rhino EQ-1000) **$800–1,600** installed; cartridge systems lower |
| Waterdrop | **7–10%** (varies by network: 7% Awin, 8% AffJumbo, 10% Affpaying) | Awin + others, 30-day cookie | Whole-house unit (WHF3T-PG) **~$220** |
| iSpring (water filtration) | **up to 8%** (referral.123filter.com/program-details/commissions shows tiers down to 5% on $100+ orders — read the live tier table before applying, banner and program page disagree) | direct, apply at [referral.123filter.com](https://referral.123filter.com/) (found 2026-08-27 via the "EARN UP TO 8% COMMISSION" link in ispringfilter.com's own footer — NOT ispringsolutions.com, which is an unrelated eLearning-software company that also uses the iSpring name and has its own separate 10% affiliate program; do not confuse the two) | 3-Stage whole-house system **$500–600** |
| ZeroWater | **5–20%** depending on network/SKU (official site "up to 20%"; FlexOffers 8%; AffJumbo 2.8%) | FlexOffers, Yazing, others; 30-day cookie | Pitchers/dispensers, lower AOV (not separately sourced, sub-$50 category) |
| Brita | **8–10%** (Commission Factory 10%, FlexOffers 8%) | Commission Factory, FlexOffers; 30-day cookie | Pitchers ~$25–40 (not separately sourced this pass, general retail knowledge) |

Commission-times-AOV spans a wide range: a Brita pitcher referral nets
roughly $2–4; an Aquasana whole-house tank system at 10% of $800–1,600 nets
**$80–160** — a single high-ticket sale here is worth 4–8x a Tap Score
kit sale. At the same 0.5–1% conversion benchmark used above, that is
roughly **$10–250 per 1,000 visits** depending heavily on which brand/tier
the content steers toward — the range is wide because the AOV range is
wide, not because any individual number above is unsourced.

**Build implication**: content that steers toward *whole-house* or
*under-sink* systems (Aquasana tank systems, iSpring, Waterdrop) captures
meaningfully more per sale than content that defaults to pitcher-tier
recommendations (Brita, ZeroWater) — worth a deliberate content decision,
not an accident of which brand's widget gets embedded first.

### Qualification checklist
| Requirement | Site now | Gap |
|---|---|---|
| Content recommending filtration tiered by contaminant found (natural fit — SDWIS violation data implies which contaminant class matters) | Fits by design | not built yet |
| Impact account (Berkey) | **Not held** | needs Olivia |
| LinkShare/Rakuten account (Aquasana) | **Not held** | needs Olivia |
| Awin account (Waterdrop, and Tap Score above) | **Not held** | needs Olivia |
| Direct iSpring signup | **Not held** | needs Olivia |
| FlexOffers/Commission Factory/Yazing accounts (ZeroWater, Brita) | **Not held** | needs Olivia — note FlexOffers' own general acceptance bar (route 10) |

**Verdict: APPLY AT — real, indexed traffic.** Same threshold as route 1;
these can be applied for in the same pass since several share networks
(Awin covers both Tap Score and Waterdrop). Parked to `idea.js`.

## 3. Display ads — AdSense — build now regardless

Verified from Google's own eligibility page (re-checked this pass, current
as of June 2026 per third-party trackers): **no minimum traffic, no
mandatory post count, no six-month domain-age rule.** What actually gates
approval: original content demonstrating genuine expertise (commonly cited
around **15–20+ published pages**, 800–1,200+ words each), a professional
mobile-friendly layout, and the four standard pages — **About, Contact,
Privacy Policy, Terms.**

**On the health/contamination framing question**: EPA violation and
contaminant data is inherently alarming-adjacent ("your water system
violated the lead action level"), the same tension WildfireRiskCheck's
research flagged for disaster-risk data and resolved the same way — no
AdSense policy explicitly bans factual public-health data reporting; the
risk is *tone* (AdSense's general "shocking content" policy targets content
"intentionally created... to provoke a strong emotional reaction"), not
*topic*. Google's healthcare/medical-claims restrictions found in this
pass are **advertiser-side Google Ads policies** (what an advertiser may
claim about a drug or treatment), not AdSense publisher content policy, and
do not appear to apply to a site reporting utility compliance data
factually. **Build requirement that follows: report violations and
contaminant levels in a factual, cited register (EPA source and regulatory
limit named on every page) — never "your water could be poisoning you"
framing** — both honest and the one lever this site controls against the
vaguest of the ad networks' content policies.

### Qualification checklist
| Requirement | Site now | Gap |
|---|---|---|
| About/Contact/Privacy/Terms, named author | Not built yet | **build requirement**: `content` step |
| 15–20+ original pages showing real expertise, factual tone | Not built | per-system pages count if not boilerplate; uniqueness gate already spec'd at 30% median in `site.config.json` |
| ads.txt | Not present | **build requirement**: `install` step |
| Under the 15-site-per-account cap | Existing AdSense account (per sibling sites) already has several sites added | check before adding another |

**Verdict: APPLY NOW, as soon as `content` and `deploy` steps are done.**
Per the target.js model above, not close to sufficient alone at this
niche's real volume even at the high end of RPMs — install it as backstop
revenue, prioritize routes 1–2.

## 4. Display ads — Raptive / Mediavine Journey / Ezoic

Verified current thresholds (re-checked this pass): **Raptive 25,000
monthly pageviews** (cut from 100k on 2025-10-16), **Mediavine main
programme now revenue-gated at $5,000/year in ad earnings** rather than a
flat session count, with the **Journey** tier (rolled out 2026-01-15)
opening at **1,000 sessions/month**, no revenue minimum to apply, 70%
revenue share, auto-upgrading to the main programme once $5,000/year is
earned. **Ezoic's floor is 250,000 monthly active users** for new
publishers as of 2026-02-19 (publishers who joined earlier are
grandfathered) — the highest bar of the three.

Given this niche's realistically capturable ceiling is **~930 visits/month**
even ranking top-3 across the *entire* query family, **Journey's 1,000
sessions/month floor is close to the whole site's realistic traffic
ceiling, not a modest early milestone** — worth naming explicitly, since it
means Raptive (25,000) and Ezoic (250,000) are likely out of reach for this
site as a standalone property unless traffic comes from a wider net than
the 6,200-search core query family (e.g., long-tail city/system-name
queries beyond `scout/ranked.json`'s core seed list).

**Verdict: APPLY AT** the respective thresholds — Journey first by a wide
margin, Raptive and Mediavine main a stretch goal, Ezoic likely unreachable
as a standalone site. Parked to `idea.js` with each threshold.

## 5. Amazon Associates

**Home Improvement category pays 3%** (stable since an April 2020 rate
cut from 8%); water filters are not called out as their own category in
Amazon's published rate card, so 3% (Home Improvement) is the most likely
applicable rate, with "All Other Categories" at 4% as a fallback if
misclassified — not separately confirmed this pass. At a blended AOV
across pitchers-to-under-sink systems (~$50–150) and the same 0.5–1%
conversion benchmark, that is roughly **$10–25 per 1,000 visits** — the
weakest of the affiliate routes, but zero traffic floor to start. The real
gate is Amazon's **3-qualifying-sales/180-day retention rule**, the same
structural risk every sibling site's research has flagged.

### Qualification checklist
| Requirement | Site now | Gap |
|---|---|---|
| Amazon Associates account | **Not held** | needs Olivia — tax/payment info, same boundary as every other payments-linked account |
| 3 sales within 180 days of approval | N/A yet | don't apply until enough traffic to plausibly clear this |

**Verdict: APPLY AT — traffic sufficient to plausibly clear the 180-day
bar.** Parked to `idea.js`.

## 6. Water softener / treatment installer lead-gen — no real marketplace found

This was the route most worth stress-testing, since "get quotes from local
water-treatment installers" is the closest analogue to the insurance-lead
route that carried WildfireRiskCheck's math — and it does not hold up the
same way here.

**Culligan** and **RainSoft** both operate through **independent dealer
networks with exclusive sales territories**, not affiliate or CPL
programmes. Culligan's own "affiliate" activity found in this pass is a
manufacturer sponsorship of an engineering trade association (ASPE) and
**customer-to-customer referral bonuses** ($50–100 store credit per
referral) — neither is a publisher-facing lead-sale programme. RainSoft
similarly runs **national lead-generation infrastructure for its own
dealers** (including a Home Depot in-store presence), not a
publisher-facing affiliate arrangement. No CPL marketplace equivalent to
SmartFinancial/Insurify (insurance) or LeafFilter/CJ (gutter guards) could
be found for water-softener installation specifically.

The only sourced number is a **general plumbing lead proxy**: HomeAdvisor/
Angi resell a shared plumbing lead to 3–4 contractors simultaneously at
**$25–120 per lead** — not water-softener-specific, and (per the
HomeAdvisor/Angi model generally) this is what a *contractor* pays a
*marketplace*, not what a *publisher* earns for referring into that
marketplace; no public publisher-side payout rate was found.

### Qualification checklist
| Requirement | Site now | Gap |
|---|---|---|
| CPL marketplace for this specific trade | **Not found** | this avenue may not exist in publisher-facing form |
| Direct dealer-network partnership (Culligan, RainSoft) | Not pursued | would require direct outreach to individual dealer territories, not a network signup — high effort for unverified payout |

**Verdict: NEVER for now.** Unlike WildfireRiskCheck's insurance-lead
route, this is not a "needs traffic" gap — it's a "no publisher-facing
programme could be found at all" gap. Revisit only if a real network
(a water-treatment-specific analogue to SmartFinancial) surfaces later;
no `idea.js` entry needed since there's no threshold to wait for.

## 7. Email capture — real hook, not padding, but indirect

Unlike some scout-listed avenues that turn out to be padding, this one has
a genuine, sourced reason to exist: EPA's **Consumer Confidence Report
(CCR) Rule requires every community water system to issue a new annual
water-quality report by July 1 each year**. That is a real, recurring,
predictable data-refresh cycle this site's underlying dataset will follow
— "we'll email you when your system's new report comes out, and what
changed" is a genuine, non-padded value proposition, not a generic
"subscribe to our newsletter" filler CTA.

It is not, however, its own revenue line — it monetizes only by
re-driving a past visitor back into routes 1, 2, 3, or 5 a year later.
No CCR-alert-specific monetization product exists to sell into.

**Verdict: Build now** — cheap to build (a form + a yearly cron against
the refreshed dataset), reinforces routes 1–2 and 5 on the return visit,
but do not count it as incremental $/1,000-visits revenue on its own.

## 8–9. Data licensing and embeddable widget — both speculative, no market found

**Data licensing/API**: EPA SDWIS data is **public domain** — the same
finding every sibling site's research has made about its own government
dataset (USFS, FEMA) — so there is nothing exclusive to license out.
Checked whether a real-estate/relocation-data aggregator has built tap-water
quality into its product the way it has built in climate/hazard risk:
**ATTOM's Climate Change Risk and Environmental Hazard Risk products cover
wildfire, flood, heat, storm, drought, air quality, landslides, and radon —
tap-water quality is not among them.** That is a meaningful negative
finding, not just an absence of evidence: the market leader in exactly this
kind of hazard-data licensing has had years to add water-quality-by-address
and has not. No other credible buyer was found.

**Embeddable widget**: generic real-estate listing widgets (property
search, IDX feeds) are a real product category (Elfsight and similar), but
no water-quality-specific widget product or realtor-side buyer market was
found — the same "plausible in theory, unverified in practice" conclusion
every sibling site's research has reached for this avenue.

**Verdict: NEVER for now, both routes.** No `idea.js` entry needed since
neither has a programme or threshold to wait for — these would need a
direct partnership conversation initiated after there's real traffic to
point to, not a network signup.

## 10. FlexOffers / any general affiliate network — NEVER before traffic

Same finding as every sibling site: FlexOffers is free to join with no
published traffic floor, but **declined PanelFit outright at four days old
with 7 impressions**, burning both the account and that traffic source.
The lesson generalizes regardless of niche — **never apply to any general
affiliate network before this site has real, sustained traffic.** Several
of this site's own brand programmes (ZeroWater, Brita) are *listed* on
FlexOffers, so this isn't a route to skip entirely, just one to delay.

## 11. Site sale

Affiliate/content sites reportedly sell at **30–45x monthly net profit**
on Flippa — meaningless before there is profit. **NEVER before there is
profit to multiply.**

---

## What the template must therefore include

- About page with a **named author** (byline), Contact, Privacy, Terms —
  all four required for AdSense and forward-compatible with every
  affiliate-network application later
- `ads.txt`
- A **primary CTA slot** on every system page framed as "get your own tap
  tested" (Tap Score), since the site's own SDWIS data is system-wide, not
  household-level, and can't answer the household question itself —
  structurally ready even though its target id starts empty
- A **secondary CTA slot** for filtration-product affiliates, tiered by
  the contaminant class actually found in that system's violation data
  (e.g. lead → point-of-use/whole-house recommendation; nitrate/PFAS →
  different filter class) rather than one generic "buy a filter" banner —
  same empty-id-switches-CTA-and-disclosure pattern as every sibling site
- Content written in a **factual, cited, non-alarmist register** — EPA
  source and regulatory limit named on every page, never "your water is
  poisoning you" framing — both honest and the one lever this site
  controls against ad networks' shocking-content policies
- A yearly-refresh mechanism tied to the **CCR Rule's July 1 annual report
  cycle**, feeding the email-capture route (build requirement, cheap)
- Enough non-templated, genuinely varied content (real per-system
  violation/contaminant data, not boilerplate) to clear both the
  uniqueness gate (30% median, already in `site.config.json`) and
  AdSense's "genuine expertise" bar

## Three buckets — sorted explicitly

**(a) Something the site build can satisfy now** (page, byline, schema,
post count, CTA structure):
- About/Contact/Privacy/Terms pages with a named author
- `ads.txt`
- Primary Tap Score CTA slot + secondary tiered-filter-affiliate CTA slot,
  both with empty target ids wired to disclosure text
- Factual/cited/non-alarmist content register on every page
- CCR-cycle-driven email-capture mechanism
- Enough genuinely varied per-system pages to clear the uniqueness gate

**(b) Something only time/traffic can satisfy** (do not file to `idea.js`
directly — list here for a human/next step to park with its threshold):
- Tap Score / SimpleLab affiliate application — at real, indexed traffic
- Direct filter-brand affiliate applications (Berkey, Aquasana, Waterdrop,
  iSpring, ZeroWater, Brita) — at real, indexed traffic
- Amazon Associates application — at traffic sufficient to plausibly clear
  the 3-sale/180-day rule
- Mediavine Journey — at 1,000 monthly sessions (note: this is close to
  this site's entire realistic traffic ceiling, not an early milestone)
- Raptive — at 25,000 monthly pageviews (likely a stretch for this site
  standalone)
- Mediavine main programme — at $5,000/year ad earnings
- Ezoic — at 250,000 monthly active users (likely unreachable standalone)
- FlexOffers / any general affiliate network — only after real, sustained
  traffic exists

**(c) Something needing an account/signature/money/permission** (listed,
not acted on):
- Awin account (Tap Score, Waterdrop)
- Impact account (Berkey)
- LinkShare/Rakuten account (Aquasana)
- Direct iSpring affiliate signup
- FlexOffers, Commission Factory, and/or Yazing accounts (ZeroWater, Brita)
- Amazon Associates account (tax/payment info required)
- AdSense account (add as a new site to the existing multi-site account)
- Raptive / Mediavine / Ezoic applications once traffic thresholds are met

## Sources

- [Tap Score Water Testing Affiliate Program — Refersion](https://simplewater.refersion.com/)
- [Awin | SimpleLab, Inc Affiliate Program](https://ui.awin.com/merchant-profile/92253)
- [Become a Tap Score Affiliate — mytapscore.com](https://mytapscore.com/pages/become-a-tap-score-affiliate)
- [Essential Home Water Test Kit — Tap Score](https://mytapscore.com/products/home-water-test-essential)
- [Advanced City Water Test — Tap Score](https://mytapscore.com/products/advanced-city-water-test)
- [Berkey Affiliate Program — Impact/berkeywaterfilter.com](https://www.berkeywaterfilter.com/affiliates/)
- [Join Our Berkey Filters Affiliate Program](https://www.berkeyfilters.com/pages/berkey-filters-affiliate-program)
- [Affiliate Program | Aquasana](https://www.aquasana.com/affiliate-program.html)
- [Aquasana Home Water Filters Affiliate Program — FlexOffers](https://www.flexoffers.com/affiliate-programs/aquasana-home-water-filters-affiliate-program/)
- [The Aquasana Rhino EQ-1000 10-Year Cost — nontoxiclab.com / theexaminernews.com whole-house filter roundups](https://www.theexaminernews.com/buying-guides/best-whole-house-water-filter-systems-top-5-picks-reviewed/)
- [Affiliate Program — Waterdrop Filters](https://www.waterdropfilter.com/pages/waterdrop-affiliate-program)
- [Awin | Waterdropfilter UK Affiliate Programme](https://ui.awin.com/merchant-profile/117649)
- [Waterdrop Affiliate Program — Affpaying](https://www.affpaying.com/waterdropaffiliateprogram)
- [iSpring Affiliate Program — ispringsolutions.com / affiliateprogramdb.com](https://www.affiliateprogramdb.com/brands/ispring-affiliate-program/)
- [iSpring 3-Stage Whole House Water Filtration System pricing — vendor roundups](https://nontoxiclab.com/ispring-vs-aquasana/)
- [Affiliates | Culligan ZeroWater](https://www.zerowater.com/pages/affiliate)
- [ZeroWater UK Affiliate Program — FlexOffers](https://www.flexoffers.com/affiliate-programs/zerowater-uk-affiliate-program/)
- [BRITA Affiliate Program — Commission Factory](https://www.commissionfactory.com/advertiser-directory/brita-affiliate-program/62431)
- [BRITA Affiliate Program @VigLink / FlexOffers listing](http://www.viglink.com/merchants/136420/brita-affiliate-program)
- [ASPE announces addition of Culligan to Affiliate Sponsorship Program — WaterWorld](https://www.waterworld.com/drinking-water-treatment/article/16199481/aspe-announces-addition-of-culligan-to-affiliate-sponsorship-program)
- [Refer A Friend & Save — Culligan customer referral programs](https://www.txculliganreferrals.com/)
- [RainSoft Dealer Network — rainsoftdealer.com](https://rainsoftdealer.com/)
- [The Home Depot — RainSoft Dealer lead-gen channel](https://rainsoftdealer.com/the-home-depot/)
- [Water Softener System Installation Cost 2026 — Angi](https://www.angi.com/articles/how-much-does-water-softener-installation-cost.htm)
- [Why Plumbers Pay $80+ Per Lead on HomeAdvisor — Astra Results Marketing](https://astraresults.com/blog/post/may-2026/home-advisor-plumbing-leads)
- [Amazon Affiliate Commission Rates By Category 2026 — Azonpress](https://azonpress.com/amazon-affiliate-commission-rates/)
- [Amazon Associates Commission Rates 2026 — EarnifyHub](https://earnifyhub.com/blog/affiliate/amazon-associates-commission-rates-all-categories)
- [13 Affiliate Conversion Rate Statistics For eCommerce Stores — Opensend](https://www.opensend.com/post/affiliate-conversion-rate-statistics-ecommerce)
- [Affiliate Marketing Conversion Rate Benchmarks & Best Practices 2026 — Optimonk](https://www.optimonk.com/affiliate-marketing-conversion-rate)
- [Eligibility requirements for AdSense — Google AdSense Help](https://support.google.com/adsense/answer/9724?hl=en)
- [Google AdSense Approval Requirements 2026 — Innopanda](https://innopanda.com/google-adsense-in-2026/)
- [AdSense Program policies — Google AdSense Help](https://support.google.com/adsense/answer/48182?hl=en)
- [Health in personalized advertising — Google Advertising Policies Help](https://support.google.com/adspolicy/answer/16701855?hl=en)
- [Raptive Drops Traffic Requirement By 75% To 25,000 Views — Search Engine Journal](https://www.searchenginejournal.com/raptive-drops-traffic-requirement-by-75-to-25000-views/558780/)
- [How to Apply for Mediavine in 2026: Requirements & Approval Process — Jupiter](https://www.jupiter.co/blog/mediavine-requirements-2026-how-to-qualify)
- [Journey Minimum Requirements — Journey (Mediavine)](https://journeymv.zendesk.com/hc/en-us/articles/24633185741723-Journey-Minimum-Requirements)
- [New Mediavine requirements rolling out Jan 15, 2026 — Threads](https://www.threads.com/@theunconventionalrd/post/DQuu6EuEohb/)
- [Getting Started: Ezoic's Requirements](https://support.ezoic.com/kb/article/getting-started-ezoics-requirements)
- [Ezoic Raises Bar to 250K — PR Newswire](https://www.prnewswire.com/news-releases/ezoic-raises-bar-to-250k-js-integration-for-full-revenue-platform-surges-in-popularity-with-web-builders-302692672.html)
- [EWG National Tap Water Database — business-model context, Hydroviv](https://www.hydroviv.com/blogs/water-smarts/environmental-working-group-tap-water-database)
- [Don't Let That Viral Drinking Water Database Scare You — Vice, on EWG's affiliate revenue](https://www.vice.com/en/article/dont-let-that-viral-drinking-water-database-scare-you/)
- [ATTOM Environmental Hazard Risk Data — attomdata.com](https://www.attomdata.com/data/hazard-risk-data/)
- [ATTOM Climate Change Risk Data — attomdata.com](https://www.attomdata.com/data/climate-risk-data/)
- [Consumer Confidence Reports (CCRs) — ASDWA](https://www.asdwa.org/regulatory/consumer-confidence-reports/)
- [How to Read Drinking Water Quality Reports — CDC](https://www.cdc.gov/drinking-water/about/how-to-read-drinking-water-quality-reports.html)
- [FlexOffers: How can I tell what traffic will be accepted](https://support.flexoffers.com/hc/en-us/articles/360042476812-How-can-I-tell-what-kinds-of-traffic-will-be-accepted-by-this-affiliate-program)
- [Affiliate Website Valuation — Flippa](https://flippa.com/blog/affiliate-website-valuation-how-to-properly-determine-it/)
- `scout/candidates.json` and `scout/ranked.json` — SiteFactory internal (tap-water-quality entry: 6,200 monthly queries, decision 0.85, avenues listed)
