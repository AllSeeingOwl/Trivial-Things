import * as cheerio from 'cheerio';
import { fetchWidgetData, WidgetData, WidgetItem } from '../scraper';

/** Rank shown next to the head of government, ahead of the ten numbered positions. */
export const LEADER_RANK = '★';

/** Head of government plus the ten highest-ranking positions below them. */
const POSITIONS_BELOW_LEADER = 10;

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
function stripHonorific(name: string): string {
  return name.replace(/^(The\s+)?(Rt\.?\s+Hon\.?|Right Honourable)\s+(the\s+)?/i, '').trim();
}

/**
 * Cabinet ministers in GOV.UK's order, starting with the Prime Minister. Each
 * person's most senior current role is the headline position; any other roles
 * they hold are listed underneath.
 */
export function parseUkGovernment(json: Record<string, unknown>): WidgetItem[] {
  const links = json.links as { ordered_cabinet_ministers?: GovUkPerson[] } | undefined;
  const people = links?.ordered_cabinet_ministers ?? [];
  const items: WidgetItem[] = [];

  for (const person of people) {
    if (items.length > POSITIONS_BELOW_LEADER) break;
    const name = stripHonorific(person.title ?? '');
    if (!name) continue;

    const roles = (person.links?.role_appointments ?? [])
      .filter(a => a.details?.current)
      .map(a => a.links?.role?.[0])
      .filter((r): r is GovUkRole => !!r?.title)
      .sort((a, b) => (a.details?.seniority ?? Infinity) - (b.details?.seniority ?? Infinity))
      .map(r => r.title as string);
    if (roles.length === 0) continue;

    const isLeader = items.length === 0;
    // The PM must head the list; if GOV.UK's order ever changes, don't mislabel someone else.
    if (isLeader && !roles.includes('Prime Minister')) return [];

    items.push({
      id: `uk-gov-${items.length}`,
      rank: isLeader ? LEADER_RANK : items.length,
      title: name,
      subtitle: isLeader ? 'Prime Minister' : roles[0],
      metadata: (isLeader ? roles.filter(r => r !== 'Prime Minister') : roles.slice(1)).join(' · ') || undefined
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// United States: whitehouse.gov
// ---------------------------------------------------------------------------

export const US_ADMINISTRATION_URL = 'https://www.whitehouse.gov/administration/';
export const US_CABINET_URL = 'https://www.whitehouse.gov/administration/cabinet/';

/**
 * Executive departments in statutory order of precedence (the presidential
 * line of succession, minus the Speaker and President pro tempore). The first
 * nine filled posts follow the Vice President to make up the ten positions.
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

function headingText($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  return $(el).text().replace(/\s+/g, ' ').trim();
}

/**
 * whitehouse.gov/administration: each principal is an h2 reading
 * "President Donald J. Trump" / "Vice President JD Vance".
 */
export function parseUsLeaders(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  let president = '';
  let vicePresident = '';

  $('h2').each((_, h2) => {
    const text = headingText($, h2);
    const vp = text.match(/^Vice President\s+(.+)$/i);
    if (vp) { vicePresident ||= vp[1]; return; }
    const pres = text.match(/^President\s+(.+)$/i);
    if (pres) president ||= pres[1];
  });

  if (!president || !vicePresident) return [];
  return [
    { id: 'us-gov-president', rank: LEADER_RANK, title: president, subtitle: 'President' },
    { id: 'us-gov-vp', rank: 1, title: vicePresident, subtitle: 'Vice President' },
  ];
}

/**
 * whitehouse.gov/administration/cabinet lists members alphabetically as an h2
 * (name) followed by an h3 (position). Reorders them by precedence.
 */
export function parseUsCabinet(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const byPosition = new Map<string, string>();

  $('h2').each((_, h2) => {
    const name = headingText($, h2);
    const position = headingText($, $(h2).nextAll('h3').first().get(0) ?? h2);
    if (!name || position === name) return;
    const dept = US_DEPARTMENTS.find(d => d.match.test(position));
    if (dept && !byPosition.has(dept.position)) byPosition.set(dept.position, name);
  });

  return US_DEPARTMENTS
    .filter(d => byPosition.has(d.position))
    .slice(0, POSITIONS_BELOW_LEADER - 1)
    .map((d, i) => ({
      id: `us-gov-${i + 2}`,
      rank: i + 2,
      title: byPosition.get(d.position) as string,
      subtitle: d.position
    }));
}

/** President, Vice President and the next nine cabinet secretaries in order of precedence. */
export async function fetchUsGovernment(): Promise<WidgetData> {
  const [leaders, cabinet] = await Promise.all([
    fetchWidgetData({ primaryUrl: US_ADMINISTRATION_URL, primaryParser: parseUsLeaders }),
    fetchWidgetData({ primaryUrl: US_CABINET_URL, primaryParser: parseUsCabinet }),
  ]);

  if (leaders.source === 'error') return leaders;
  if (cabinet.source === 'error') return cabinet;
  return { items: [...leaders.items, ...cabinet.items], source: 'primary' };
}
