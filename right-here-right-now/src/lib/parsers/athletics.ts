import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

/** "Armand DUPLANTIS" -> "Armand Duplantis" (World Athletics capitalises surnames). */
function tidyName(name: string): string {
  return name
    .split(' ')
    .map(part => (part.length > 1 && part === part.toUpperCase()
      ? part.charAt(0) + part.slice(1).toLowerCase()
      : part))
    .join(' ')
    // Keep hyphenated/apostrophe surnames readable: "Dos-santos" -> "Dos-Santos"
    .replace(/([-'])(\p{Ll})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

/**
 * World Athletics overall world ranking (server-rendered table; each cell
 * carries a data-th attribute naming its column).
 */
function parseWorldAthletics(html: string, idPrefix: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('table tbody tr').each((i, el) => {
    if (items.length >= 10) return false;
    const $row = $(el);
    const cell = (th: string) => $row.find(`td[data-th="${th}"]`).text().replace(/\s+/g, ' ').trim();

    const name = cell('Competitor');
    if (!name) return;

    const event = cell('EventList').replace(/\s*\[.*?\]\s*/g, '').trim();
    items.push({
      id: `${idPrefix}-${items.length}`,
      rank: cell('Rank') || items.length + 1,
      title: tidyName(name),
      subtitle: [cell('Nat'), event].filter(Boolean).join(' · '),
      metadata: cell('score') ? `${cell('score')} pts` : undefined
    });
  });

  return items;
}

export function parseAthleticsMen(html: string): WidgetItem[] {
  return parseWorldAthletics(html, 'athletics-men');
}

export function parseAthleticsWomen(html: string): WidgetItem[] {
  return parseWorldAthletics(html, 'athletics-women');
}
