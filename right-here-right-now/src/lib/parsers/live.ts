import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

const DAY_MS = 86_400_000;

function countryName(code: string): string {
  const upper = code.toUpperCase();
  const special: Record<string, string> = { USA: 'USA', UK: 'UK', UAE: 'UAE' };
  if (special[upper]) return special[upper];
  return code.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Astronaut {
  name?: string;
  title?: string;
  location?: string;
  country?: string;
  launchdate?: string;
}

/** Everyone currently in space (howmanypeopleareinspacerightnow.com/peopleinspace.json). */
export function parsePeopleInSpace(json: Record<string, unknown>): WidgetItem[] {
  const people = Array.isArray(json.people) ? (json.people as Astronaut[]) : [];
  const now = Date.now();

  return people
    .filter(p => p.name)
    .map((p, i) => {
      const launched = p.launchdate ? Date.parse(p.launchdate) : NaN;
      const days = Number.isFinite(launched) ? Math.max(0, Math.floor((now - launched) / DAY_MS)) : undefined;
      return {
        id: `space-${i}`,
        rank: i + 1,
        title: p.name!,
        subtitle: [p.title, p.location].filter(Boolean).join(' · ') || undefined,
        metadata: [
          p.country ? countryName(p.country) : undefined,
          days !== undefined ? `${days} day${days === 1 ? '' : 's'} in space` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });
}

/** Pages that top the view counts but aren't articles anyone is reading about. */
function isArticle(title: string): boolean {
  if (title === 'Main_Page' || title === 'Main Page' || title === '-') return false;
  return !/^(Special|Wikipedia|File|Portal|Help|Talk|User|Template|Category|Draft|Module|MediaWiki)( talk)?:/i.test(title);
}

function formatViews(views: number): string {
  return `${views.toLocaleString('en-GB')} views`;
}

/** Yesterday's (UTC) top English Wikipedia articles from the Wikimedia pageviews API. */
export function wikipediaMostReadUrl(now = new Date()): string {
  const day = new Date(now.getTime() - DAY_MS);
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, '0');
  const d = String(day.getUTCDate()).padStart(2, '0');
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${y}/${m}/${d}`;
}

export async function resolveWikipediaMostReadUrl(): Promise<string> {
  return wikipediaMostReadUrl();
}

/** Parses the pageviews "top" response: { items: [{ articles: [{ article, views, rank }] }] }. */
export function parseWikipediaMostRead(json: Record<string, unknown>): WidgetItem[] {
  const items = json.items as { articles?: { article: string; views: number }[] }[] | undefined;
  const articles = items?.[0]?.articles ?? [];

  return articles
    .filter(a => a.article && isArticle(a.article))
    .slice(0, 10)
    .map((a, i) => ({
      id: `wiki-most-read-${i}`,
      rank: i + 1,
      title: a.article.replace(/_/g, ' '),
      metadata: Number.isFinite(a.views) ? `${formatViews(a.views)} yesterday` : undefined,
    }));
}

/** Backup: the weekly "Wikipedia:Top 25 Report" table. */
export function parseWikipediaTop25(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['rank', 'article', 'views']);
  if (!table) return [];

  const articleCol = table.headers.findIndex(h => h.startsWith('article'));
  const viewsCol = table.headers.findIndex(h => h.startsWith('views'));

  return table.rows
    .filter(cells => cells[articleCol] && /\d/.test(cells[viewsCol] ?? ''))
    .slice(0, 10)
    .map((cells, i) => ({
      id: `wiki-top25-${i}`,
      rank: i + 1,
      title: cells[articleCol],
      metadata: `${cells[viewsCol]} views this week`,
    }));
}

interface CoinGeckoCoin {
  item?: {
    name?: string;
    symbol?: string;
    market_cap_rank?: number | null;
    data?: {
      price?: number;
      price_change_percentage_24h?: Record<string, number>;
    };
  };
}

function formatUsd(price: number): string {
  if (price >= 1) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  // Small prices: keep four significant figures
  return `$${price.toPrecision(4).replace(/\.?0+$/, '')}`;
}

/** Trending coins on CoinGecko (api.coingecko.com/api/v3/search/trending). */
export function parseTrendingCrypto(json: Record<string, unknown>): WidgetItem[] {
  const coins = Array.isArray(json.coins) ? (json.coins as CoinGeckoCoin[]) : [];

  return coins
    .map(c => c.item)
    .filter(c => c?.name)
    .map((c, i) => {
      const price = c!.data?.price;
      const change = c!.data?.price_change_percentage_24h?.usd;
      return {
        id: `crypto-${i}`,
        rank: i + 1,
        title: c!.name!,
        subtitle: [
          c!.symbol?.toUpperCase(),
          c!.market_cap_rank ? `Market cap #${c!.market_cap_rank}` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
        metadata: [
          typeof price === 'number' && Number.isFinite(price) ? formatUsd(price) : undefined,
          typeof change === 'number' && Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}% 24h` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });
}

interface CorquaidPerson {
  name?: string;
  country?: string;
  agency?: string;
  position?: string;
  spacecraft?: string;
  launched?: number;
  iss?: boolean;
}

/** Backup for people in space: corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json. */
export function parsePeopleInSpaceCorquaid(json: Record<string, unknown>): WidgetItem[] {
  const people = Array.isArray(json.people) ? (json.people as CorquaidPerson[]) : [];
  const now = Date.now();

  return people
    .filter(p => p.name)
    .map((p, i) => {
      // launched is a Unix timestamp in seconds
      const days = typeof p.launched === 'number' ? Math.max(0, Math.floor((now - p.launched * 1000) / DAY_MS)) : undefined;
      return {
        id: `space-backup-${i}`,
        rank: i + 1,
        title: p.name!,
        subtitle: [p.position, p.iss ? 'International Space Station' : p.spacecraft].filter(Boolean).join(' · ') || undefined,
        metadata: [
          [p.country, p.agency].filter(Boolean).join(' / ') || undefined,
          days !== undefined ? `${days} day${days === 1 ? '' : 's'} in space` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });
}

interface CmcSearchRank {
  name?: string;
  symbol?: string;
  rank?: number;
  priceChange?: { price?: number; priceChange24h?: number };
}

/** Backup for trending crypto: CoinMarketCap's most-searched coins (api.coinmarketcap.com/data-api/v3/topsearch/rank). */
export function parseCoinMarketCapTrending(json: Record<string, unknown>): WidgetItem[] {
  const list = ((json.data as { cryptoTopSearchRanks?: CmcSearchRank[] } | undefined)?.cryptoTopSearchRanks) ?? [];

  return list
    .filter(c => c.name)
    .map((c, i) => {
      const price = c.priceChange?.price;
      const change = c.priceChange?.priceChange24h;
      return {
        id: `cmc-${i}`,
        rank: i + 1,
        title: c.name!,
        subtitle: [c.symbol?.toUpperCase(), c.rank ? `Market cap #${c.rank}` : undefined].filter(Boolean).join(' · ') || undefined,
        metadata: [
          typeof price === 'number' && Number.isFinite(price) ? formatUsd(price) : undefined,
          typeof change === 'number' && Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}% 24h` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      };
    });
}
