import * as cheerio from 'cheerio';
import { WidgetData, WidgetItem } from '../scraper';

// Current champions (Cagematch title pages) and latest tournament winners
// (The SmackDown Hotel), one page per row. The list mirrors
// "Current Wrestling Champs.txt"; add or remove a row here to change the cards.

interface WrestlingSource {
  url: string;
  name: string;
}

const WRESTLING_URLS_1: WrestlingSource[] = [
  { url: 'https://www.cagematch.net/en/?id=5&nr=145', name: 'IWGP Heavyweight Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1576', name: 'Wonder Of Stardom Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=4380', name: 'DDT Iron Man Heavy Metal Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=311', name: 'Open The Dream Gate Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1789', name: 'WWE NXT Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=24', name: 'Triple Crown Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=121', name: 'ROH World Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=2964', name: 'Princess Of Princess Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=2827', name: 'RevPro Undisputed British Cruiserweight Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=3796', name: 'GCW World Championship' },
];

const WRESTLING_URLS_2: WrestlingSource[] = [
  { url: 'https://www.cagematch.net/en/?id=5&nr=4370', name: "AEW Women's World Championship" },
  { url: 'https://www.cagematch.net/en/?id=5&nr=650', name: 'TNA Knockouts World Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1501', name: 'EVE Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=181', name: 'TNA X-Division Championship' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-best-of-the-super-juniors', name: 'NJPW Best of the Super Juniors' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-g1-climax', name: 'NJPW G1 Climax' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-world-tag-league', name: 'NJPW World Tag League' },
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

export interface ChampionInfo {
  champion: string;
  detail?: string;
}

/**
 * A Cagematch title page (cagematch.net/en/?id=5&nr=…). Its reign table has
 * no header row and lists the newest reign first; the current reign ends
 * "today". If no reign does, the title is vacant.
 */
export function parseCagematchChampion(html: string): ChampionInfo | null {
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
export function parseSmackdownHotelWinner(html: string): ChampionInfo | null {
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

/** Cagematch promotion IDs for the "titles" tab (cagematch.net/en/?id=8&nr=<id>&page=9). */
export const PROMOTIONS = [
  { key: 'wwe', id: 1, title: 'WWE Champions' },
  { key: 'aew', id: 2287, title: 'AEW Champions' },
  { key: 'tna', id: 5, title: 'TNA Champions' },
  { key: 'njpw', id: 7, title: 'NJPW Champions (Japan)' },
  { key: 'stardom', id: 745, title: 'Stardom Champions (Japan)' },
  { key: 'cmll', id: 78, title: 'CMLL Champions (Mexico)' },
  { key: 'aaa', id: 122, title: 'AAA Champions (Mexico)' },
] as const;

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

async function fetchChampion(source: WrestlingSource): Promise<ChampionInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(source.url, {
      headers: COMMON_HEADERS,
      signal: controller.signal,
      next: { revalidate: 86400, tags: ['widgets'] }, // 24 hours, refreshed with the other widgets
    });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    const html = await res.text();
    return source.url.includes('thesmackdownhotel.com') ? parseSmackdownHotelWinner(html) : parseCagematchChampion(html);
  } finally {
    clearTimeout(timer);
  }
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
        console.error(`Failed fetching ${sources[i].url}:`, e);
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
