import * as cheerio from 'cheerio';
import { fetchWidgetData, WidgetData, WidgetItem } from '../scraper';

/**
 * "Who runs the country" widgets: each shows a head of government (or state)
 * followed by the ten highest-ranking posts below them, in the order the
 * government itself publishes. Every source is an official government site.
 */

/** Rank shown next to the head of government, ahead of the ten numbered positions. */
export const LEADER_RANK = '★';

/** Positions listed below the leader. */
const POSITIONS_BELOW_LEADER = 10;

/** Leader + ten; pass as maxItems so the scraper doesn't trim to its default of 10. */
export const GOVERNMENT_LIST_LENGTH = POSITIONS_BELOW_LEADER + 1;

interface Official {
  name: string;
  /** Headline position. */
  position: string;
  /** Any other posts held at the same time. */
  otherRoles?: string[];
}

/**
 * Turns an ordered list into widget rows: ★ for the leader, then 1–10. The
 * list starts at the first entry whose position matches leaderPattern (pages
 * sometimes have heading entries first) and is empty if there is none, so a
 * layout change on the source never mislabels someone as head of government.
 */
function toLeaderList(prefix: string, officials: Official[], leaderPattern: RegExp): WidgetItem[] {
  const named = officials.filter(o => o.name && o.position);
  const leaderIndex = named.findIndex(o => leaderPattern.test(o.position));
  if (leaderIndex === -1) return [];

  return named.slice(leaderIndex, leaderIndex + GOVERNMENT_LIST_LENGTH).map((o, i) => ({
    id: `${prefix}-${i}`,
    rank: i === 0 ? LEADER_RANK : i,
    title: o.name,
    subtitle: o.position,
    metadata: o.otherRoles?.filter(Boolean).join(' · ') || undefined
  }));
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function text($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  return clean($(el).text());
}

// ---------------------------------------------------------------------------
// United Kingdom: GOV.UK content API
// ---------------------------------------------------------------------------

/** GOV.UK's ministers page as JSON. Its cabinet list is in official order of precedence. */
export const UK_MINISTERS_URL = 'https://www.gov.uk/api/content/government/ministers';

interface GovUkRole {
  title?: string;
  details?: { seniority?: number };
}

interface GovUkAppointment {
  details?: { current?: boolean };
  links?: { role?: GovUkRole[] };
}

interface GovUkPerson {
  title?: string;
  links?: { role_appointments?: GovUkAppointment[] };
}

/** "The Rt Hon Keir Starmer KCB KC MP" -> "Keir Starmer KCB KC MP" */
function stripUkHonorific(name: string): string {
  return name.replace(/^(The\s+)?(Rt\.?\s+Hon\.?|Right Honourable)\s+(the\s+)?/i, '').trim();
}

/**
 * Cabinet ministers in GOV.UK's order, starting with the Prime Minister. Each
 * person's most senior current role is the headline position.
 */
export function parseUkGovernment(json: Record<string, unknown>): WidgetItem[] {
  const links = json.links as { ordered_cabinet_ministers?: GovUkPerson[] } | undefined;

  const officials = (links?.ordered_cabinet_ministers ?? []).map((person): Official => {
    const roles = (person.links?.role_appointments ?? [])
      .filter(a => a.details?.current)
      .map(a => a.links?.role?.[0])
      .filter((r): r is GovUkRole => !!r?.title)
      .sort((a, b) => (a.details?.seniority ?? Infinity) - (b.details?.seniority ?? Infinity))
      .map(r => r.title as string);
    // The PM's most senior role is "Prime Minister"; make sure it is the headline either way.
    const position = roles.includes('Prime Minister') ? 'Prime Minister' : roles[0] ?? '';
    return {
      name: stripUkHonorific(person.title ?? ''),
      position,
      otherRoles: roles.filter(r => r !== position)
    };
  });

  return toLeaderList('uk-gov', officials, /^Prime Minister$/);
}

// ---------------------------------------------------------------------------
// United States: whitehouse.gov and house.gov
// ---------------------------------------------------------------------------

export const US_ADMINISTRATION_URL = 'https://www.whitehouse.gov/administration/';
export const US_CABINET_URL = 'https://www.whitehouse.gov/administration/cabinet/';
export const US_HOUSE_LEADERSHIP_URL = 'https://www.house.gov/leadership';

/**
 * Executive departments in the order of the presidential line of succession.
 * The President pro tempore of the Senate sits between the Speaker and the
 * Secretary of State in the line but is not included here.
 */
const US_DEPARTMENTS: { position: string; match: RegExp }[] = [
  { position: 'Secretary of State', match: /^Secretary of State$/i },
  { position: 'Secretary of the Treasury', match: /^Secretary of the Treasury$/i },
  { position: 'Secretary of War', match: /^Secretary of (War|Defense)$/i },
  { position: 'Attorney General', match: /^Attorney General$/i },
  { position: 'Secretary of the Interior', match: /^Secretary of the Interior$/i },
  { position: 'Secretary of Agriculture', match: /^Secretary of Agriculture$/i },
  { position: 'Secretary of Commerce', match: /^Secretary of Commerce$/i },
  { position: 'Secretary of Labor', match: /^Secretary of Labor$/i },
  { position: 'Secretary of Health and Human Services', match: /^Secretary of Health and Human Services$/i },
  { position: 'Secretary of Housing and Urban Development', match: /^Secretary of Housing and Urban Development$/i },
  { position: 'Secretary of Transportation', match: /^Secretary of Transportation$/i },
  { position: 'Secretary of Energy', match: /^Secretary of Energy$/i },
  { position: 'Secretary of Education', match: /^Secretary of Education$/i },
  { position: 'Secretary of Veterans Affairs', match: /^Secretary of Veterans Affairs$/i },
  { position: 'Secretary of Homeland Security', match: /^Secretary of Homeland Security$/i },
];

/**
 * whitehouse.gov/administration: each principal is an h2 reading
 * "President Donald J. Trump" / "Vice President JD Vance".
 */
export function parseUsLeaders(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  let president = '';
  let vicePresident = '';

  $('h2').each((_, h2) => {
    const heading = text($, h2);
    const vp = heading.match(/^Vice President\s+(.+)$/i);
    if (vp) { vicePresident ||= vp[1]; return; }
    const pres = heading.match(/^President\s+(.+)$/i);
    if (pres) president ||= pres[1];
  });

  if (!president || !vicePresident) return [];
  return [
    { id: 'us-gov-0', rank: LEADER_RANK, title: president, subtitle: 'President' },
    { id: 'us-gov-1', rank: 1, title: vicePresident, subtitle: 'Vice President' },
  ];
}

/** house.gov/leadership: h2 "Speaker of the House" followed by h3 "Rep. Mike Johnson". */
export function parseUsSpeaker(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const heading = $('h2').filter((_, h2) => /^Speaker of the House$/i.test(text($, h2))).first();
  const name = clean(heading.nextAll('h3').first().text()).replace(/^Rep\.?\s+/i, '');
  if (!name) return [];
  return [{ id: 'us-gov-2', rank: 2, title: name, subtitle: 'Speaker of the House' }];
}

/**
 * whitehouse.gov/administration/cabinet lists members alphabetically as an h2
 * (name) followed by an h3 (position). Reorders them by line of succession and
 * keeps enough to follow the President, Vice President and Speaker.
 */
export function parseUsCabinet(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const byPosition = new Map<string, string>();

  $('h2').each((_, h2) => {
    const name = text($, h2);
    const h3 = $(h2).nextAll('h3').first();
    const position = h3.length ? clean(h3.text()) : '';
    if (!name || !position) return;
    const dept = US_DEPARTMENTS.find(d => d.match.test(position));
    if (dept && !byPosition.has(dept.position)) byPosition.set(dept.position, name);
  });

  const firstRank = 3; // after the VP (1) and the Speaker (2)
  return US_DEPARTMENTS
    .filter(d => byPosition.has(d.position))
    .slice(0, POSITIONS_BELOW_LEADER - firstRank + 1)
    .map((d, i) => ({
      id: `us-gov-${i + firstRank}`,
      rank: i + firstRank,
      title: byPosition.get(d.position) as string,
      subtitle: d.position
    }));
}

/** President, Vice President, Speaker, then cabinet secretaries in line-of-succession order. */
export async function fetchUsGovernment(): Promise<WidgetData> {
  const parts = await Promise.all([
    fetchWidgetData({ primaryUrl: US_ADMINISTRATION_URL, primaryParser: parseUsLeaders }),
    fetchWidgetData({ primaryUrl: US_HOUSE_LEADERSHIP_URL, primaryParser: parseUsSpeaker }),
    fetchWidgetData({ primaryUrl: US_CABINET_URL, primaryParser: parseUsCabinet }),
  ]);

  const failed = parts.find(p => p.source === 'error');
  if (failed) return failed;
  return { items: parts.flatMap(p => p.items), source: 'primary' };
}

// ---------------------------------------------------------------------------
// Canada: Prime Minister's Office (pm.gc.ca)
// ---------------------------------------------------------------------------

/** The PMO's Cabinet page, which lists ministers in the official order of precedence. */
export const CANADA_CABINET_URL = 'https://www.pm.gc.ca/en/cabinet';

export function parseCanadaGovernment(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const officials = $('.minister-teaser').toArray().map((el): Official => {
    // "Minister of Transport and Leader of the Government in the House of Commons":
    // the first post is the headline, the rest go underneath.
    const roles = text($, $(el).find('.role'))
      .split(/ and (?=(?:Minister|Secretary of State|Leader|Attorney General|President|Receiver General)\b)/);
    return {
      name: text($, $(el).find('.name')).replace(/^The\s+(Right\s+)?Honourable\s+/i, ''),
      position: roles[0],
      otherRoles: roles.slice(1)
    };
  });
  return toLeaderList('ca-gov', officials, /^Prime Minister/i);
}

// ---------------------------------------------------------------------------
// Germany: Federal Government (bundesregierung.de)
// ---------------------------------------------------------------------------

/** The Federal Cabinet in protocol order: the Chancellor, then the Federal Ministers. */
export const GERMANY_CABINET_URL = 'https://www.bundesregierung.de/breg-en/federal-government/federal-cabinet';

export function parseGermanyGovernment(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const officials = $('.bpa-teaser-cabinet').toArray().map((el): Official => {
    const $teaser = $(el);
    const name = text($, $teaser.find('.bpa-teaser-title-text-inner').first());
    // Each card lists links to the person's CV and to each office they hold.
    const roles = $teaser.closest('li').find('.bpa-teaser-cabinet-item').toArray()
      .map(item => text($, item))
      .filter(role => role && !/^CV$/i.test(role));
    return { name, position: roles[0] ?? '', otherRoles: roles.slice(1) };
  });
  return toLeaderList('de-gov', officials, /Chancellor/i);
}

// ---------------------------------------------------------------------------
// Japan: Prime Minister's Office (japan.kantei.go.jp)
// ---------------------------------------------------------------------------

export const JAPAN_HOME_URL = 'https://japan.kantei.go.jp/';
/** Used if the current-cabinet lookup fails. The path includes the cabinet's number. */
export const JAPAN_MINISTERS_FALLBACK_URL = 'https://japan.kantei.go.jp/105/meibo/daijin/index.html';

/**
 * The Kantei's ministers list lives under the current cabinet's number
 * (/105/meibo/...), which changes with each new cabinet, so read it from the
 * home page's "List of Cabinet Members" link.
 */
export async function resolveJapanMinistersUrl(): Promise<string> {
  const res = await fetch(JAPAN_HOME_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RightHereRightNow/0.1)' },
    next: { revalidate: 86400, tags: ['widgets'] }
  });
  if (!res.ok) throw new Error(`Kantei home page status: ${res.status}`);
  const html = await res.text();
  const cabinets = [...html.matchAll(/href="\/(\d+)\/meibo\//g)].map(m => Number(m[1]));
  if (cabinets.length === 0) throw new Error('No cabinet link on the Kantei home page');
  return `https://japan.kantei.go.jp/${Math.max(...cabinets)}/meibo/daijin/index.html`;
}

/** "List of Ministers": the Prime Minister, then ministers in official order. */
export function parseJapanGovernment(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const officials = $('.list-profile__item').toArray().map((el): Official => {
    const $item = $(el);
    // Each post is on its own line (<br>).
    const titleHtml = $item.find('.list-profile__title').first().html() ?? '';
    const roles = titleHtml.split(/<br\s*\/?>/i).map(part => clean(cheerio.load(part).text())).filter(Boolean);
    return {
      name: text($, $item.find('.list-profile__name').first()),
      position: roles[0] ?? '',
      otherRoles: roles.slice(1)
    };
  });
  return toLeaderList('jp-gov', officials, /^Prime Minister$/i);
}

// ---------------------------------------------------------------------------
// Italy: Italian Government (governo.it)
// ---------------------------------------------------------------------------

/**
 * The Prime Minister, Deputy Prime Ministers, undersecretaries, ministers
 * without portfolio, then each ministry with its minister in official order.
 */
export const ITALY_GOVERNMENT_URL = 'https://www.governo.it/en/ministers-and-undersecretaries';

/** "Ministry of the Interior" -> "Minister of the Interior" */
const ministerOf = (ministry: string) => ministry.replace(/^Ministry\b/, 'Minister');

/**
 * Leader, then the two Deputy PMs, then ministers with portfolio in ministry
 * order. Ministers without portfolio and undersecretaries are left out; a
 * Deputy PM's ministry is shown under their name rather than listed twice.
 */
export function parseItalyGovernment(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const blocks = $('h3, h4, p').toArray().map(el => ({
    tag: el.tagName,
    isName: $(el).is('h3.title'),
    text: text($, el)
  }));

  let leader: Official | null = null;
  const deputies: Official[] = [];
  const ministers: Official[] = [];
  let ministry = '';

  blocks.forEach((b, i) => {
    const next = blocks[i + 1];
    if (b.tag === 'h4' && /^President of the Council of Ministers$/i.test(b.text) && next?.isName) {
      leader ??= { name: next.text, position: 'Prime Minister (President of the Council of Ministers)' };
    } else if (b.isName && next && /^Vice-President of the Council of Ministers$/i.test(next.text)) {
      deputies.push({ name: b.text, position: 'Deputy Prime Minister' });
    } else if (b.tag === 'h3' && !b.isName) {
      ministry = /^Ministry of\b/i.test(b.text) ? b.text : '';
    } else if (ministry && b.isName && next?.tag === 'p' && /^Minister$/i.test(next.text)) {
      ministers.push({ name: b.text, position: ministerOf(ministry) });
      ministry = '';
    }
  });

  if (!leader) return [];
  for (const deputy of deputies) {
    const own = ministers.find(m => m.name === deputy.name);
    if (own) deputy.otherRoles = [own.position];
  }
  const deputyNames = new Set(deputies.map(d => d.name));
  return toLeaderList('it-gov', [
    leader,
    ...deputies,
    ...ministers.filter(m => !deputyNames.has(m.name))
  ], /^Prime Minister/);
}

// ---------------------------------------------------------------------------
// Spain: La Moncloa (lamoncloa.gob.es)
// ---------------------------------------------------------------------------

/** The President of the Government, Vice-Presidents and Ministers in official order. */
export const SPAIN_GOVERNMENT_URL = 'https://www.lamoncloa.gob.es/lang/en/gobierno/government-organisational-structure/Paginas/index.aspx';

/**
 * Each member is a schema.org Person with name and jobTitle meta tags.
 * "First Vice-President of the Government of Spain and Minister for Economy"
 * is split into the vice-presidency and the ministry.
 */
export function parseSpainGovernment(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const officials = $('[typeof="Person"]').toArray().map((el): Official => {
    const $person = $(el);
    const name = clean($person.find('meta[property="name"]').attr('content') ?? '');
    const jobTitle = clean($person.find('meta[property="jobTitle"]').attr('content') ?? '');
    const [position, ...rest] = jobTitle.split(/ of the Government of Spain and /i);
    if (/^President of the Government of Spain$/i.test(jobTitle)) {
      return { name, position: 'Prime Minister (President of the Government)' };
    }
    return {
      name,
      position: rest.length ? `${position} of the Government` : position,
      otherRoles: rest.map(r => r.replace(/^minister/i, 'Minister'))
    };
  });
  return toLeaderList('es-gov', officials, /^Prime Minister/);
}
