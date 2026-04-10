import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

export function parseBooksPrimary(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // Amazon Charts structure
  $('.kc-rank-card').each((i, el) => {
    if (i >= 10) return false;

    const rank = $(el).find('.kc-rank-card-rank').text().trim();
    const title = $(el).find('.kc-rank-card-title').text().trim();
    const author = $(el).find('.kc-rank-card-author').text().trim();

    if (title) {
      items.push({
        id: `book-primary-${i}`,
        rank: rank || (i + 1).toString(),
        title: title,
        subtitle: author
      });
    }
  });

  return items;
}

export function parseBooksBackup(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // NYT Bestsellers structure
  $('li[itemprop="itemListElement"]').each((i, el) => {
    if (i >= 10) return false;

    const title = $(el).find('h3[itemprop="name"]').text().trim();
    const author = $(el).find('p[itemprop="author"]').text().trim().replace(/^by\s+/i, '');

    if (title) {
      items.push({
        id: `book-backup-${i}`,
        rank: i + 1,
        title: title,
        subtitle: author
      });
    }
  });

  return items;
}
