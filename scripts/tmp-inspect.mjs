import { accessToken, SCOPES } from '../../SiteFactory/sitekit/google-auth.js';
import { site } from '../../SiteFactory/sitekit/config.js';

const token = await accessToken(SCOPES.searchConsoleRead);
const siteUrl = site.searchConsoleProperty;

const sample = [
  'https://drinkingwatercheck.com/',
  'https://drinkingwatercheck.com/about',
  'https://drinkingwatercheck.com/browse/az',
  'https://drinkingwatercheck.com/browse/ca',
  'https://drinkingwatercheck.com/browse/tx',
  'https://drinkingwatercheck.com/crownpoint-littlewater-three-mile-point-ntua-az',
];

for (const url of sample) {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl }),
  });
  const j = await res.json();
  const r = j.inspectionResult?.indexStatusResult;
  console.log(url, '->', r?.coverageState, '| lastCrawl:', r?.lastCrawlTime || 'never', '| referringUrls:', r?.referringUrls?.length || 0);
}

const smRes = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent('https://drinkingwatercheck.com/sitemap.xml')}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const sm = await smRes.json();
console.log('\nsitemap:', JSON.stringify({ isPending: sm.isPending, isSitemapsIndex: sm.isSitemapsIndex, lastSubmitted: sm.lastSubmitted, lastDownloaded: sm.lastDownloaded, errors: sm.errors, warnings: sm.warnings, contents: sm.contents }, null, 2));
