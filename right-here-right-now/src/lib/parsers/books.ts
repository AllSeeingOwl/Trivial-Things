import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

// Amazon (charts), the NYT, Waterstones, Foyles and Bookshop.org all refuse
// scripted requests, so the widget uses Publishers Weekly's weekly Circana
// BookScan chart, with Goodreads' "most read this week" as the backup.

/** Collapses whitespace and drops zero-width characters some listings contain. */
function tidy(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

/** "Louise Penny, Author" -> "Louise Penny"; "Grisham, John, Author" -> "John Grisham" */
function cleanAuthor(text: string): string {
  const name = tidy(text).replace(/,\s*(Author|Editor|Illustrator)\b.*$/i, '').trim();
  const surnameFirst = name.match(/^([^,]+),\s*([^,]+)$/);
  return surnameFirst ? `${surnameFirst[2]} ${surnameFirst[1]}` : name;
}

/** Publishers Weekly Hardcover Frontlist Fiction (publishersweekly.com/pw/nielsen/hardcoverfiction.html). */
export function parseBooksPrimary(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('table.nielsen-table tr').each((_, el) => {
    if (items.length >= 10) return false;

    // ⚡ Bolt Optimization: Cache Cheerio Wrapper
    const $row = $(el);
    const rank = $row.children('td.nielsen-rank').text().trim();
    if (!rank) return; // header row

    const $info = $row.find('td.nielsen-bookinfo');
    const title = tidy($info.find('.nielsen-booktitle').text());
    if (!title) return;

    const author = cleanAuthor($info.find('.nielsen-booktitle').next('div').text());
    const units = $info.find('.nielsen-small-info').text().match(/UNITS SOLD:\s*([\d,]+)/i)?.[1];
    const weeks = $info.find('.nielsen-small-info').text().match(/WEEKS ON LIST:\s*(\d+)/i)?.[1];

    items.push({
      id: `book-primary-${items.length}`,
      rank,
      title,
      subtitle: author,
      metadata: [
        units && `${units} sold this week`,
        weeks && `${weeks} week${weeks === '1' ? '' : 's'} on list`
      ].filter(Boolean).join(' · ') || undefined
    });
  });

  return items;
}

/** Goodreads "Most Read Books This Week" (goodreads.com/book/most_read). */
export function parseBooksBackup(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('tr[itemtype="http://schema.org/Book"]').each((_, el) => {
    if (items.length >= 10) return false;

    // ⚡ Bolt Optimization: Cache Cheerio Wrapper
    const $row = $(el);
    const title = tidy($row.find('a.bookTitle [itemprop="name"]').text());
    if (!title) return;

    const author = tidy($row.find('a.authorName [itemprop="name"]').first().text());
    const readers = $row.find('.statistic').text().match(/([\d,]+)\s+people read it/)?.[1];

    items.push({
      id: `book-backup-${items.length}`,
      rank: $row.find('td.number').text().trim() || items.length + 1,
      title,
      subtitle: author,
      metadata: readers ? `${readers} read it this week` : undefined
    });
  });

  return items;
}
