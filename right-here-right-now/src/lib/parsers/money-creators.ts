import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

/** 907047.6 (millions) -> "$907.0B"; 950 -> "$950M". */
function usdFromMillions(millions: number): string {
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

interface ForbesPerson {
  rank?: number;
  personName?: string;
  finalWorth?: number;
  source?: string;
  countryOfCitizenship?: string;
}

/** Forbes real-time billionaires feed (forbes.com/forbesapi/person/rtb/0/position/true.json); worth is in millions. */
export function parseForbesBillionaires(json: Record<string, unknown>): WidgetItem[] {
  const list = (json.personList as { personsLists?: ForbesPerson[] } | undefined)?.personsLists ?? [];

  return list
    .filter(p => p.personName)
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
    .map((p, i) => ({
      id: `billionaire-${i}`,
      rank: p.rank ?? i + 1,
      title: p.personName!,
      subtitle: [p.source, p.countryOfCitizenship].filter(Boolean).join(' · ') || undefined,
      metadata: typeof p.finalWorth === 'number' ? `${usdFromMillions(p.finalWorth)} net worth` : undefined,
    }));
}

interface FortuneItem {
  rank?: number;
  name?: string;
  data?: Record<string, string>;
}

/** Fortune Global 500 (fortune.com/ranking/global500/): the full list sits in the page's Next.js data. */
export function parseFortuneGlobal500(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').text();
  if (!raw) return [];

  const pageProps = (JSON.parse(raw) as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps ?? {};
  const items = (pageProps.franchiseSearch as { items?: FortuneItem[] } | undefined)?.items ?? [];
  const year = (pageProps.franchise as { year?: string | number } | undefined)?.year;

  return items
    .filter(c => c.name && typeof c.rank === 'number')
    .sort((a, b) => a.rank! - b.rank!)
    .map(c => {
      const d = c.data ?? {};
      const revenue = Number((d['Revenues ($M)'] ?? '').replace(/[$,]/g, ''));
      return {
        id: `global500-${c.rank}`,
        rank: c.rank!,
        title: c.name!,
        subtitle: [d['Industry'] ?? d['Sector'], d['Country / Territory']].filter(Boolean).join(' · ') || undefined,
        metadata: [
          Number.isFinite(revenue) && revenue > 0 ? `${usdFromMillions(revenue)} revenue` : undefined,
          year ? `Global 500 ${year}` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });
}

/** Backup: Wikipedia "List of largest companies by revenue" (revenue in USD billions). */
export function parseLargestCompaniesWiki(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['name', 'industry', 'revenue']);
  if (!table) return [];

  const col = (start: string) => table.headers.findIndex(h => h.startsWith(start));
  const [rankCol, nameCol, industryCol, revenueCol, hqCol] = ['rank', 'name', 'industry', 'revenue', 'headquarters'].map(col);

  return table.rows
    .filter(cells => cells.length === table.headers.length && /^\d+$/.test(cells[rankCol]) && cells[nameCol])
    .map(cells => ({
      id: `largest-company-${cells[rankCol]}`,
      rank: Number(cells[rankCol]),
      title: cells[nameCol],
      subtitle: [cells[industryCol], hqCol >= 0 ? cells[hqCol] : undefined].filter(Boolean).join(' · ') || undefined,
      metadata: /\d/.test(cells[revenueCol] ?? '') ? `$${cells[revenueCol]}B revenue` : undefined,
    }));
}

interface HibpBreach {
  Title?: string;
  Domain?: string;
  BreachDate?: string;
  AddedDate?: string;
  PwnCount?: number;
  DataClasses?: string[];
  IsFabricated?: boolean;
  IsSpamList?: boolean;
}

/** Most recently added breaches on Have I Been Pwned (haveibeenpwned.com/api/v3/breaches, no key needed). */
export function parseLatestBreaches(json: unknown): WidgetItem[] {
  const breaches = Array.isArray(json) ? (json as HibpBreach[]) : [];

  return breaches
    .filter(b => b.Title && b.AddedDate && !b.IsFabricated && !b.IsSpamList)
    .sort((a, b) => b.AddedDate!.localeCompare(a.AddedDate!))
    .map((b, i) => ({
      id: `breach-${i}`,
      rank: i + 1,
      title: b.Title!,
      subtitle: [
        typeof b.PwnCount === 'number' ? `${compact(b.PwnCount)} accounts` : undefined,
        b.DataClasses?.slice(0, 3).join(', '),
      ].filter(Boolean).join(' · ') || undefined,
      metadata: [
        b.BreachDate ? `Breached ${b.BreachDate}` : undefined,
        `Added ${b.AddedDate!.slice(0, 10)}`,
      ].filter(Boolean).join(' · '),
    }));
}

/** Wikipedia "List of most-subscribed YouTube channels" (subscribers in millions). */
export function parseMostSubscribedYouTube(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['name', 'subscribers', 'category']);
  if (!table) return [];

  const col = (start: string) => table.headers.findIndex(h => h.startsWith(start));
  const [nameCol, subsCol, langCol, categoryCol, countryCol] = ['name', 'subscribers', 'primary', 'category', 'country'].map(col);

  return table.rows
    .filter(cells => cells.length === table.headers.length && cells[nameCol] && /\d/.test(cells[subsCol] ?? ''))
    .map((cells, i) => ({
      id: `youtube-subs-${i}`,
      rank: i + 1,
      title: cells[nameCol],
      subtitle: [cells[categoryCol], langCol >= 0 ? cells[langCol] : undefined, countryCol >= 0 ? cells[countryCol] : undefined]
        .filter(Boolean).join(' · ') || undefined,
      metadata: `${cells[subsCol]}M subscribers`,
    }));
}

/** Wikipedia "List of most-disliked YouTube videos" (counts frozen since YouTube hid dislikes in December 2021). */
export function parseMostDislikedYouTube(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['rank', 'title', 'uploader', 'dislike count']);
  if (!table) return [];

  const col = (start: string) => table.headers.findIndex(h => h.startsWith(start));
  const [rankCol, titleCol, uploaderCol, dislikesCol, pctCol, dateCol] =
    ['rank', 'title', 'uploader', 'dislike count', 'dislike percentage', 'upload date'].map(col);

  return table.rows
    .filter(cells => cells.length === table.headers.length && /^\d+$/.test(cells[rankCol]) && cells[titleCol])
    .map(cells => ({
      id: `youtube-disliked-${cells[rankCol]}`,
      rank: Number(cells[rankCol]),
      title: cells[titleCol],
      subtitle: cells[uploaderCol] || undefined,
      metadata: [
        /\d/.test(cells[dislikesCol] ?? '') ? `${cells[dislikesCol]}M dislikes` : undefined,
        pctCol >= 0 && cells[pctCol] ? `${cells[pctCol]} disliked` : undefined,
        dateCol >= 0 ? cells[dateCol].match(/\d{4}/)?.[0] : undefined,
      ].filter(Boolean).join(' · ') || undefined,
    }));
}
