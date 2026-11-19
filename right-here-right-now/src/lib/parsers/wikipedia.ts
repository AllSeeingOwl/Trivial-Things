import * as cheerio from 'cheerio';

// Wikimedia asks API clients to send a descriptive User-Agent; generic browser
// strings get rate-limited. https://meta.wikimedia.org/wiki/User-Agent_policy
export const WIKIPEDIA_HEADERS = {
  'User-Agent': 'RightHereRightNow/0.1 (https://github.com/allseeingowl/trivial-things)',
  'Accept': 'text/html; charset=utf-8',
};

/** Rendered HTML of an English Wikipedia article via the REST API. */
export function wikipediaHtmlUrl(title: string): string {
  return `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
}

/** An English Wikipedia article page (the normal page, not the REST API, which can rate-limit cloud hosts). */
export function wikipediaArticleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

/** Cell text with footnote markers ([1], [a]) and hidden sort keys removed. */
export function cellText($: cheerio.CheerioAPI, el: Parameters<cheerio.CheerioAPI>[0]): string {
  const $cell = $(el).clone();
  $cell.find('sup, .sortkey, style, .mw-ref').remove();
  return $cell.text().replace(/\s+/g, ' ').trim();
}

/**
 * Finds the first wikitable (or the last, with { last: true }) whose header
 * row contains every given heading (case-insensitive) and returns its body
 * rows as arrays of cell text, along with the header names so callers can
 * look columns up by name.
 */
export function findWikiTable(
  html: string,
  requiredHeadings: string[],
  { last = false }: { last?: boolean } = {}
): { headers: string[]; rows: string[][] } | null {
  const $ = cheerio.load(html);
  const wanted = requiredHeadings.map(h => h.toLowerCase());
  const tables = $('table.wikitable').toArray();
  if (last) tables.reverse();

  for (const table of tables) {
    const $table = $(table);
    // Some tables open with an empty or caption-like row; use the first row that has headings
    const $rows = $table.find('tr');
    const headerIndex = $rows.toArray().findIndex(tr => $(tr).children('th').length > 1);
    if (headerIndex < 0) continue;
    const headers = $rows.eq(headerIndex).find('th').toArray().map(th => cellText($, th).toLowerCase());
    if (!wanted.every(w => headers.some(h => h.includes(w)))) continue;

    const rows: string[][] = [];
    $rows.slice(headerIndex + 1).each((_, tr) => {
      const cells = $(tr).children('th, td').toArray().map(c => cellText($, c));
      if (cells.length > 0) rows.push(cells);
    });
    return { headers, rows };
  }
  return null;
}
