import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePremierLeaguePrimary(json: any): WidgetItem[] {
  const items: WidgetItem[] = [];

  if (!json || !json.tables || !json.tables[0] || !json.tables[0].entries) {
    return items;
  }

  const entries = json.tables[0].entries;
  for (let i = 0; i < Math.min(10, entries.length); i++) {
    items.push({
      id: `pl-primary-${i}`,
      rank: entries[i].position.toString(),
      title: entries[i].team.name,
      subtitle: `Points: ${entries[i].overall.points}`
    });
  }

  return items;
}

export function parsePremierLeagueBackup(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // Sky Sports website table rows
  $('.sdc-site-table__row').each((i, el) => {
    // ⚡ Bolt Optimization: Cache Cheerio Wrapper
    // Caching $(el) prevents creating a new Cheerio instance and re-traversing the
    // element context multiple times per loop iteration, significantly reducing parsing overhead.
    const $el = $(el);

    // Skip header row
    if ($el.find('th').length > 0) return;

    if (items.length >= 10) return false;

    const rank = $el.find('.sdc-site-table__cell').first().text().trim();
    const teamName = $el.find('.sdc-site-table__name-target').text().trim();
    const points = $el.find('.sdc-site-table__cell').eq(9).text().trim(); // Points usually the 10th col

    if (teamName) {
      items.push({
        id: `pl-backup-${items.length}`,
        rank: rank || (items.length + 1).toString(),
        title: teamName.replace(/\n/g, '').trim(),
        subtitle: `Points: ${points}`
      });
    }
  });

  return items;
}

// Relegation zone: the bottom 3 teams of the same standings feed.
const RELEGATION_SPOTS = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRelegationPrimary(json: any): WidgetItem[] {
  const entries = json?.tables?.[0]?.entries;
  if (!Array.isArray(entries) || entries.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return entries.slice(-RELEGATION_SPOTS).map((entry: any, i: number) => ({
    id: `pl-relegation-primary-${i}`,
    rank: entry.position.toString(),
    title: entry.team.name,
    subtitle: `Points: ${entry.overall.points}`
  }));
}

export function parseRelegationBackup(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const rows: WidgetItem[] = [];

  // Sky Sports table: collect every team row, then keep the last 3
  $('.sdc-site-table__row').each((_, el) => {
    const $el = $(el);
    if ($el.find('th').length > 0) return;

    const teamName = $el.find('.sdc-site-table__name-target').text().replace(/\n/g, '').trim();
    if (!teamName) return;

    const rank = $el.find('.sdc-site-table__cell').first().text().trim();
    const points = $el.find('.sdc-site-table__cell').eq(9).text().trim();
    rows.push({
      id: `pl-relegation-backup-${rows.length}`,
      rank: rank || (rows.length + 1).toString(),
      title: teamName,
      subtitle: `Points: ${points}`
    });
  });

  return rows.slice(-RELEGATION_SPOTS);
}
