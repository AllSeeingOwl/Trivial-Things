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
    // Skip header row
    if ($(el).find('th').length > 0) return;

    if (items.length >= 10) return false;

    const rank = $(el).find('.sdc-site-table__cell').first().text().trim();
    const teamName = $(el).find('.sdc-site-table__name-target').text().trim();
    const points = $(el).find('.sdc-site-table__cell').eq(9).text().trim(); // Points usually the 10th col

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
