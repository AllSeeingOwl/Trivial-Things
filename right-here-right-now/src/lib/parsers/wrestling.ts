import * as cheerio from 'cheerio';
import { WidgetData, WidgetItem } from '../scraper';
import { cellText, WIKIPEDIA_HEADERS, wikipediaArticleUrl } from './wikipedia';

// The two "More Championships" cards: one title or tournament per row.
// Championships read the title's Wikipedia article (its infobox names the
// current champion) and fall back to its Cagematch page; Cagematch answers
// Render's servers with a redirect, so Wikipedia is the source in production.
// Tournaments read The SmackDown Hotel. Titles from promotions with their own
// card (see PROMOTIONS) are left out so nothing appears twice.
// "Current Wrestling Champs.txt" mirrors this list; edit both to change the cards.

interface WrestlingSource {
  name: string;
  /** English Wikipedia article title */
  wiki?: string;
  /** Cagematch title page */
  cagematch?: string;
  /** The SmackDown Hotel tournament page */
  tournament?: string;
}

const cagematchTitle = (nr: number) => `https://www.cagematch.net/en/?id=5&nr=${nr}`;

const WRESTLING_URLS_1: WrestlingSource[] = [
  { name: 'DDT Iron Man Heavy Metal Championship', wiki: 'Ironman Heavymetalweight Championship', cagematch: cagematchTitle(4380) },
  { name: 'Open The Dream Gate Championship', wiki: 'Open the Dream Gate Championship', cagematch: cagematchTitle(311) },
  { name: 'Triple Crown Championship', wiki: 'Triple Crown Heavyweight Championship', cagematch: cagematchTitle(24) },
  { name: 'ROH World Championship', wiki: 'ROH World Championship', cagematch: cagematchTitle(121) },
  { name: 'Princess Of Princess Championship', wiki: 'Princess of Princess Championship', cagematch: cagematchTitle(2964) },
  { name: 'RevPro Undisputed British Heavyweight Championship', wiki: 'Undisputed British Heavyweight Championship', cagematch: cagematchTitle(1976) },
  { name: 'GCW World Championship', wiki: 'GCW World Championship', cagematch: cagematchTitle(3796) },
  { name: 'GHC Heavyweight Championship (NOAH)', wiki: 'GHC Heavyweight Championship', cagematch: cagematchTitle(140) },
  { name: 'NWA Worlds Heavyweight Championship', wiki: 'NWA Worlds Heavyweight Championship', cagematch: cagematchTitle(179) },
  { name: 'MLW World Heavyweight Championship', wiki: 'MLW World Heavyweight Championship', cagematch: cagematchTitle(224) },
];

const WRESTLING_URLS_2: WrestlingSource[] = [
  { name: 'EVE Championship', wiki: 'Pro-Wrestling: EVE Championship', cagematch: cagematchTitle(1501) },
  { name: 'wXw Unified World Wrestling Championship', wiki: 'wXw Unified World Wrestling Championship', cagematch: cagematchTitle(1342) },
  { name: 'PROGRESS World Championship', wiki: 'Progress World Championship', cagematch: cagematchTitle(1723) },
  { name: 'Marigold World Championship', wiki: 'Marigold World Championship', cagematch: cagematchTitle(6915) },
  { name: 'NJPW Best of the Super Juniors', tournament: 'https://www.thesmackdownhotel.com/tournaments/njpw-best-of-the-super-juniors' },
  { name: 'NJPW G1 Climax', tournament: 'https://www.thesmackdownhotel.com/tournaments/njpw-g1-climax' },
  { name: 'NJPW World Tag League', tournament: 'https://www.thesmackdownhotel.com/tournaments/njpw-world-tag-league' },
];

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Cagematch rate-limits bursts, so pages are fetched a few at a time. */
const MAX_PARALLEL = 3;

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** "14.06.2026" -> "14 Jun 2026" */
function cagematchDate(text: string): string | undefined {
  const m = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

interface ChampionInfo {
  champion: string;
  detail?: string;
}

/**
 * A Cagematch title page (cagematch.net/en/?id=5&nr=…). Its reign table has
 * no header row and lists the newest reign first; the current reign ends
 * "today". If no reign does, the title is vacant.
 */
function parseCagematchChampion(html: string): ChampionInfo | null {
  const $ = cheerio.load(html);
  const rows = $('.TableContents tr').toArray();
  if (rows.length === 0) return null;

  const current = rows.find(r => tidy($(r).find('.TextHighlightBold').text()).toLowerCase() === 'today');
  const $details = $(current ?? rows[0]).find('.ChampionDetailsText').first();
  // "Yota Tsuji (2)": name plus how many times they have held it
  const holder = tidy($details.find('.TextBold').first().text());
  const name = holder.replace(/\s*\((\d+)\)$/, '');
  const times = Number(holder.match(/\((\d+)\)$/)?.[1] ?? 1);
  if (!name) return null;

  const dates = tidy($details.text());
  if (!current) {
    // "dd.mm.yyyy - dd.mm.yyyy": the second date is when the last reign ended
    const ended = cagematchDate(dates.match(/\d{2}\.\d{2}\.\d{4}/g)?.[1] ?? '');
    return { champion: 'Vacant', detail: `Last held by ${name}${ended ? ` until ${ended}` : ''}` };
  }

  const since = cagematchDate(dates);
  return {
    champion: name,
    detail: [since ? `Since ${since}` : undefined, times > 1 ? `${ordinal(times)} reign` : undefined]
      .filter(Boolean).join(' · ') || undefined,
  };
}

/**
 * A SmackDown Hotel tournament page (thesmackdownhotel.com/tournaments/…):
 * winners newest first. Tag teams list each partner as a separate link.
 */
function parseSmackdownHotelWinner(html: string): ChampionInfo | null {
  const $ = cheerio.load(html);
  const $info = $('table tbody tr').first().find('.reign-info').first();
  const names = $info.find('h3 a').toArray().map(a => tidy($(a).text())).filter(Boolean);
  if (names.length === 0) return null;

  const team = tidy($info.find('h3 .team-name').text());
  const won = tidy($info.find('.from-date').text());
  return {
    champion: team ? `${team} (${names.join(' & ')})` : names.join(' & '),
    detail: won ? `Won ${won}` : undefined,
  };
}

/** "(1)" / "1(2, 1)" -> 1; the first number is the champion's (or team's) reign count. */
function reignCount(text: string): number {
  return Number(text.match(/\d+/)?.[0] ?? 1) || 1;
}

/** "August 9, 2026" -> "9 Aug 2026" (anything else is returned as-is). */
function wikiDate(text: string): string | undefined {
  const t = Date.parse(text);
  if (!/\d{4}/.test(text) || Number.isNaN(t)) return undefined;
  return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "The Young Bucks(Matt Jackson and Nick Jackson)" -> "The Young Bucks (Matt Jackson & Nick Jackson)" */
function tidyHolder(text: string): string {
  return balanceBrackets(tidy(text).replace(/(\S)\(/g, '$1 (').replace(/ and /g, ' & '));
}

/**
 * A championship's Wikipedia article: the infobox's "Current champion(s)"
 * and "Date won" rows.
 */
function parseWikiInfoboxChampion(html: string): ChampionInfo | null {
  const $ = cheerio.load(html);
  const row = (label: RegExp) => $('table.infobox tr').toArray()
    .find(tr => label.test(cellText($, $(tr).children('th').first()[0] ?? tr)));
  const champRow = row(/^current\s+champions?(\(s\))?$/i);
  if (!champRow) return null;

  const champion = tidyHolder(cellText($, $(champRow).children('td').first()[0] ?? champRow));
  if (!champion) return null;
  const dateRow = row(/^date won$/i);
  const won = dateRow ? wikiDate(cellText($, $(dateRow).children('td').first()[0] ?? dateRow)) : undefined;
  const vacant = /^vacant/i.test(champion);
  return {
    champion: vacant ? 'Vacant' : champion,
    detail: won ? `${vacant ? 'Vacant since' : 'Since'} ${won}` : undefined,
  };
}

/**
 * A promotion's current champions on Wikipedia ("List of current champions
 * in …", or the promotion article for Stardom and CMLL): tables headed
 * "Championship | Current champion(s) | Reign | Date won | …". Rows are read
 * by position, because a belt-image column is sometimes present and
 * sometimes not. Titles matching `exclude` (other promotions' belts
 * defended there) are skipped.
 */
export function parseWikiPromotionChampions(html: string, exclude?: RegExp): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];
  const seen = new Set<string>();

  $('table.wikitable').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    const headIndex = rows.findIndex(tr => $(tr).children('th').length > 1);
    if (headIndex < 0) return;
    const head = $(rows[headIndex]).children('th').toArray().map(th => cellText($, th).toLowerCase());
    if (!head[0]?.startsWith('championship') || !head.some(h => h.startsWith('current champion'))) return;

    for (const tr of rows.slice(headIndex + 1)) {
      const cells = $(tr).children('th, td').toArray().map(c => cellText($, c));
      const title = cells[0];
      if (!title || seen.has(title) || exclude?.test(title)) continue;
      // Skip the empty image cell, if any: champion, reign, date won follow
      const rest = cells.slice(1);
      while (rest.length && !rest[0]) rest.shift();
      const [holderText, reignText, dateText] = rest;
      if (!holderText) continue;

      const holder = tidyHolder(holderText);
      const vacant = /^vacant/i.test(holder);
      const won = dateText ? wikiDate(dateText) : undefined;
      const times = reignText && /^\d/.test(reignText) ? reignCount(reignText) : 1;
      seen.add(title);
      items.push({
        id: `wiki-title-${items.length}`,
        rank: items.length + 1,
        title,
        subtitle: vacant ? 'Vacant' : holder,
        metadata: [
          won ? `${vacant ? 'Vacant since' : 'Since'} ${won}` : undefined,
          !vacant && times > 1 ? `${ordinal(times)} reign` : undefined,
        ].filter(Boolean).join(' · ') || undefined,
      });
    }
  });

  return items;
}

/** Cagematch promotion IDs for the "titles" tab (cagematch.net/en/?id=8&nr=<id>&page=9). */
export const PROMOTIONS: {
  key: string;
  title: string;
  /** Cagematch promotion id (backup source) */
  id: number;
  /** Wikipedia page listing the current champions (primary source) */
  wiki: string;
  /** Titles on that page that belong on another card */
  exclude?: RegExp;
}[] = [
  { key: 'wwe', id: 1, title: 'WWE Champions', wiki: 'List of current champions in WWE', exclude: /^AAA\b/ },
  { key: 'aew', id: 2287, title: 'AEW Champions', wiki: 'List of current champions in All Elite Wrestling' },
  { key: 'tna', id: 5, title: 'TNA Champions', wiki: 'List of current champions in Total Nonstop Action Wrestling' },
  { key: 'njpw', id: 7, title: 'NJPW Champions (Japan)', wiki: 'List of current champions in New Japan Pro-Wrestling', exclude: /^CMLL\b/ },
  { key: 'stardom', id: 745, title: 'Stardom Champions (Japan)', wiki: 'World Wonder Ring Stardom', exclude: /^(IWGP|Strong|CMLL)\b/ },
  { key: 'cmll', id: 78, title: 'CMLL Champions (Mexico)', wiki: 'Consejo Mundial de Lucha Libre' },
  { key: 'aaa', id: 122, title: 'AAA Champions (Mexico)', wiki: 'List of current champions in Lucha Libre AAA Worldwide' },
];

export function promotionChampionsUrl(promotion: (typeof PROMOTIONS)[number]): string {
  return wikipediaArticleUrl(promotion.wiki);
}

export function promotionTitlesUrl(id: number): string {
  return `https://www.cagematch.net/en/?id=8&nr=${id}&page=9`;
}

/** Closes brackets Cagematch sometimes leaves open: "The Nemeths (Nic Nemeth & Ryan Nemeth" */
function balanceBrackets(text: string): string {
  const open = (text.match(/\(/g) ?? []).length - (text.match(/\)/g) ?? []).length;
  return open > 0 ? text + ')'.repeat(open) : text;
}

/**
 * A promotion's titles tab: "# | Title | Current champion(s) | Since | Rating | Votes".
 * The first table holds active titles (a second lists retired ones). Titles
 * are ordered by fan votes, which puts the headline belts first; ties (many
 * titles have no votes) put "World" titles first, then keep the site's order.
 */
export function parseCagematchPromotionTitles(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const table = $('.TableContents').first();
  const head = table.find('tr').first().children().toArray().map(c => tidy($(c).text()).toLowerCase());
  const titleCol = head.indexOf('title');
  const champCol = head.findIndex(h => h.startsWith('current champion'));
  const sinceCol = head.indexOf('since');
  const votesCol = head.indexOf('votes');
  if (titleCol < 0 || champCol < 0) return [];

  const titles = table.find('tr').slice(1).toArray().map((tr, order) => {
    const cells = $(tr).children('td').toArray().map(td => tidy($(td).text()));
    const raw = cells[champCol] ?? '';
    // A trailing "(2)" is how many times they have held it
    const times = Number(raw.match(/\((\d+)\)$/)?.[1] ?? 1);
    const holder = balanceBrackets(raw.replace(/\s*\(\d+\)$/, ''));
    const vacant = /^(vacant|vakant)$/i.test(holder);
    const since = sinceCol >= 0 ? cagematchDate(cells[sinceCol] ?? '') : undefined;
    return {
      order,
      title: cells[titleCol],
      votes: votesCol >= 0 ? Number(cells[votesCol]) || 0 : 0,
      world: /\bworld\b/i.test(cells[titleCol] ?? ''),
      champion: vacant ? 'Vacant' : holder,
      detail: [
        since ? `${vacant ? 'Vacant since' : 'Since'} ${since}` : undefined,
        !vacant && times > 1 ? `${ordinal(times)} reign` : undefined,
      ].filter(Boolean).join(' · ') || undefined,
    };
  }).filter(t => t.title && t.champion && !/^inactive$/i.test(t.champion));

  return titles
    .sort((a, b) => (b.votes - a.votes) || (Number(b.world) - Number(a.world)) || (a.order - b.order))
    .map((t, i) => ({
      id: `promotion-title-${i}`,
      rank: i + 1,
      title: t.title,
      subtitle: t.champion,
      metadata: t.detail,
    }));
}

async function fetchPage(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      next: { revalidate: 86400, tags: ['widgets'] }, // 24 hours, refreshed with the other widgets
    });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Tries each of a row's sources in turn: Wikipedia, then Cagematch (or the tournament page). */
async function fetchChampion(source: WrestlingSource): Promise<ChampionInfo | null> {
  const attempts: [string, Record<string, string>, (html: string) => ChampionInfo | null][] = [];
  if (source.wiki) attempts.push([wikipediaArticleUrl(source.wiki), WIKIPEDIA_HEADERS, parseWikiInfoboxChampion]);
  if (source.cagematch) attempts.push([source.cagematch, COMMON_HEADERS, parseCagematchChampion]);
  if (source.tournament) attempts.push([source.tournament, COMMON_HEADERS, parseSmackdownHotelWinner]);

  let lastError: unknown = null;
  for (const [url, headers, parse] of attempts) {
    try {
      const info = parse(await fetchPage(url, headers));
      if (info) return info;
    } catch (e) {
      lastError = e;
      console.warn(`Wrestling source failed for ${source.name} (${url}):`, e);
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function fetchWrestlingItems(sources: WrestlingSource[]): Promise<WidgetData> {
  const results: (ChampionInfo | null | Error)[] = new Array(sources.length);

  // A small worker pool keeps at most MAX_PARALLEL requests in flight
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, sources.length) }, async () => {
    while (next < sources.length) {
      const i = next++;
      try {
        results[i] = await fetchChampion(sources[i]);
      } catch (e) {
        console.error(`No source worked for ${sources[i].name}:`, e);
        results[i] = e instanceof Error ? e : new Error(String(e));
      }
    }
  }));

  const items: WidgetItem[] = sources.map((source, i) => {
    const result = results[i];
    const info = result instanceof Error ? null : result;
    return {
      id: `wrestling-${source.name.replace(/\s+/g, '-').toLowerCase()}`,
      rank: i + 1,
      title: source.name,
      subtitle: info?.champion ?? 'Update Unavailable',
      metadata: info?.detail,
    };
  });

  // Every row failing means the source is down, not that each title changed hands
  if (results.every(r => r instanceof Error || r === null)) {
    return { items: [], source: 'error', error: 'Update Unavailable' };
  }
  return { items, source: 'primary' };
}

export async function fetchWrestlingData1(): Promise<WidgetData> {
  return fetchWrestlingItems(WRESTLING_URLS_1);
}

export async function fetchWrestlingData2(): Promise<WidgetData> {
  return fetchWrestlingItems(WRESTLING_URLS_2);
}
