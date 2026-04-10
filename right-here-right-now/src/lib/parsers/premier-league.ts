import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

export function parsePremierLeaguePrimary(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // Premier League website table rows
  $('tr[data-filtered-table-row-name]').each((i, el) => {
    if (i >= 10) return false;

    const rank = $(el).find('.league-table__pos-number').text().trim();
    const teamName = $(el).find('.league-table__team-name').text().trim();
    const points = $(el).find('.league-table__pts').text().trim();

    if (teamName) {
      items.push({
        id: `pl-primary-${i}`,
        rank: rank || (i + 1).toString(),
        title: teamName,
        subtitle: `Points: ${points}`
      });
    }
  });

  return items;
}

export function parsePremierLeagueBackup(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // Sky Sports website table rows
  $('.standing-table__row').each((i, el) => {
    // Skip header row
    if ($(el).hasClass('standing-table__row--heading')) return;

    if (items.length >= 10) return false;

    const rank = $(el).find('.standing-table__cell:first-child').text().trim();
    const teamName = $(el).find('.standing-table__cell--name').text().trim();
    const points = $(el).find('.standing-table__cell:nth-child(10)').text().trim(); // Points usually the 10th col

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
