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
    const headers = $table.find('tr').first().find('th').toArray().map(th => cellText($, th).toLowerCase());
    if (!wanted.every(w => headers.some(h => h.includes(w)))) continue;

    const rows: string[][] = [];
    $table.find('tr').slice(1).each((_, tr) => {
      const cells = $(tr).children('th, td').toArray().map(c => cellText($, c));
      if (cells.length > 0) rows.push(cells);
    });
    return { headers, rows };
  }
  return null;
}
