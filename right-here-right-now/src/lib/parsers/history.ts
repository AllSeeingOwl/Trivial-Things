import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';
import { cellText } from './wikipedia';

// Running lists of office-holders and award winners from English Wikipedia.
// All widgets show the ten most recent, newest first.

type Cheerio$ = cheerio.CheerioAPI;
type El = Parameters<Cheerio$>[0];

/** Headings of a wikitable's first heading row (lower-cased), or [] if none. */
function headings($: Cheerio$, table: El): string[] {
  const row = $(table).find('tr').toArray().find(tr => $(tr).children('th').length > 1);
  return row ? $(row).find('th').toArray().map(th => cellText($, th).toLowerCase()) : [];
}

/** All wikitables whose headings include every given (partial) heading. */
function tablesWith($: Cheerio$, wanted: string[]): El[] {
  return $('table.wikitable').toArray().filter(t => {
    const h = headings($, t);
    return wanted.every(w => h.some(x => x.includes(w)));
  });
}

/**
 * A table's body as a grid of cell text with rowspan/colspan expanded, so
 * column n means the same column on every row. Includes <th> cells.
 */
function expandTable($: Cheerio$, table: El): string[][] {
  const grid: string[][] = [];
  const carry: { text: string; left: number }[] = [];

  $(table).find('tr').each((_, tr) => {
    const row: string[] = [];
    const cells = $(tr).children('th, td').toArray();
    let col = 0;
    const fillCarried = () => {
      while (carry[col]?.left > 0) {
        row[col] = carry[col].text;
        carry[col].left--;
        col++;
      }
    };
    fillCarried();
    for (const cell of cells) {
      fillCarried();
      const text = cellText($, cell);
      const rows = Math.max(1, parseInt($(cell).attr('rowspan') ?? '1', 10) || 1);
      const cols = Math.max(1, parseInt($(cell).attr('colspan') ?? '1', 10) || 1);
      for (let c = 0; c < cols; c++) {
        row[col] = text;
        if (rows > 1) carry[col] = { text, left: rows - 1 };
        col++;
      }
    }
    fillCarried();
    grid.push(row);
  });

  return grid;
}

/** Text of the first article link in a cell (skips image links). */
function firstLinkText($: Cheerio$, cell: El): string {
  const link = $(cell).find('a').toArray().find(a => {
    const $a = $(a);
    return $a.text().trim() && !$a.hasClass('mw-file-description') && !$a.closest('sup').length;
  });
  return link ? $(link).text().replace(/\s+/g, ' ').trim() : '';
}

/** "(b. 1947)", "(1924–2018)", "(born 1970)", "(founded 1989)" -> removed. */
function stripLifespan(text: string): string {
  return text.replace(/\s*\((b\.|born|founded|est\.)?\s*[^()]*\d{3,4}[^()]*\)\s*$/i, '').trim();
}

/** "January 20, 2025–Incumbent" -> "2025–present"; "4 May 1979 – 28 November 1990" -> "1979–1990". */
function yearSpan(start: string, end?: string): string {
  const from = start.match(/\d{4}/)?.[0] ?? start;
  if (end === undefined) return from;
  if (/incumbent|present/i.test(end)) return `${from}–present`;
  const to = end.match(/\d{4}/)?.[0];
  return to && to !== from ? `${from}–${to}` : from;
}

/** 1 -> "1st", 12 -> "12th", 22 -> "22nd". */
function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

function newestTen<T>(rows: T[]): T[] {
  return rows.slice(-10).reverse();
}

/** "List of popes": the modern tables have Pontiff number, Pontificate, Name, Personal name columns. */
export function parsePopes(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const popes: { number: string; name: string; personal?: string; years: string }[] = [];

  for (const table of tablesWith($, ['pontiff', 'pontificate', 'name'])) {
    const h = headings($, table);
    const numCol = h.findIndex(x => x.startsWith('pontiff'));
    const termCol = h.findIndex(x => x.startsWith('pontificate'));
    const nameCol = h.findIndex(x => x.startsWith('name'));
    const personalCol = h.findIndex(x => x.startsWith('personal name'));

    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray();
      if (cells.length !== h.length) return;
      const number = cellText($, cells[numCol]);
      // Antipopes are listed with "—" instead of a number
      if (!/^\d+$/.test(number)) return;

      // English name is bold; a "Ven." / "St" link may come first and the Latin form follows
      const name = $(cells[nameCol]).find('b').first().text().replace(/\s+/g, ' ').trim()
        || firstLinkText($, cells[nameCol]) || cellText($, cells[nameCol]);
      const [start, end] = cellText($, cells[termCol]).replace(/\(.*\)$/, '').split('–');
      popes.push({
        number,
        name: name.replace(/^(St|Bl|Ven)\.?\s+/, ''),
        personal: personalCol >= 0 ? cellText($, cells[personalCol]) || undefined : undefined,
        years: yearSpan(start ?? '', end),
      });
    });
  }

  return newestTen(popes).map((p, i) => ({
    id: `pope-${p.number}`,
    rank: i + 1,
    title: p.name,
    subtitle: p.personal,
    metadata: `${p.years} · Pope #${p.number}`,
  }));
}

/**
 * "List of Nobel Peace Prize laureates": one row per laureate. A year's first
 * row starts with the year (rowspan over shared prizes); co-laureate rows
 * carry only image, name and country.
 */
export function parseNobelPeace(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const table = tablesWith($, ['year', 'recipient', 'citation'])[0];
  if (!table) return [];

  const years: { year: string; names: string[]; countries: string[]; citation?: string }[] = [];

  $(table).find('tr').each((_, tr) => {
    const cells = $(tr).children('td').toArray().map(td => cellText($, td));
    if (cells.length >= 4 && /^\d{4}$/.test(cells[0])) {
      // year | image | recipient | country | citation
      const name = stripLifespan(cells[2]);
      years.push({
        year: cells[0],
        names: name ? [name] : [],
        countries: cells[3] ? [cells[3]] : [],
        citation: cells[4] || undefined,
      });
    } else if (cells.length === 3 && years.length && cells[1]) {
      // co-laureate: image | recipient | country
      const current = years[years.length - 1];
      current.names.push(stripLifespan(cells[1]));
      if (cells[2]) current.countries.push(cells[2]);
    }
  });

  return newestTen(years.filter(y => y.names.length > 0)).map((y, i) => ({
    id: `nobel-peace-${y.year}`,
    rank: i + 1,
    title: y.names.join(' & '),
    subtitle: y.citation?.replace(/^["“]|["”]$/g, ''),
    metadata: [y.year, [...new Set(y.countries)].join(', ')].filter(Boolean).join(' · '),
  }));
}

/**
 * "List of prime ministers of the United Kingdom". Rowspans make column
 * positions vary, so each PM's row is found by its name cell ("MP for …",
 * lifespan) and read from there: name, start, end, duration.
 */
export function parseUkPrimeMinisters(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const pms: { name: string; start: string; end: string; duration: string }[] = [];

  // The first table is the list proper; a later one covers disputed short-lived ministries
  const table = tablesWith($, ['prime minister', 'term of office'])[0];
  if (table) {
    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray();
      const nameIdx = cells.findIndex(td => /\((born \d{4}|\d{4}\s*–\s*\d{4})\)/.test(cellText($, td)));
      if (nameIdx < 0 || cells.length < nameIdx + 4) return;

      const name = firstLinkText($, cells[nameIdx]);
      const start = cellText($, cells[nameIdx + 1]);
      if (!name || !/\d{4}/.test(start)) return;
      pms.push({
        name,
        start,
        end: cellText($, cells[nameIdx + 2]),
        duration: cellText($, cells[nameIdx + 3]),
      });
    });
  }

  return newestTen(pms).map((p, i) => ({
    id: `uk-pm-${i}`,
    rank: i + 1,
    title: p.name,
    subtitle: `${p.start} – ${/incumbent/i.test(p.end) ? 'present' : p.end.replace(/([A-Za-z])(\d{4})$/, '$1 $2')}`,
    metadata: p.duration || undefined,
  }));
}

/** "List of vice presidents of the United States": rows start with a numbered <th>. */
export function parseUsVicePresidents(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const table = tablesWith($, ['name', 'term', 'president'])[0];
  if (!table) return [];

  const vps: { number: string; name: string; years: string; party?: string; president?: string }[] = [];

  // No. | portrait | name | term | (spacer) | party | election | president
  for (const cells of expandTable($, table)) {
    const number = cells[0] ?? '';
    // A second term repeats the spanned cells on its own row; keep the first
    if (!/^\d+$/.test(number) || vps.some(v => v.number === number)) continue;
    const name = stripLifespan(cells[2] ?? '');
    const [start, end] = (cells[3] ?? '').split('–');
    if (!name || !start) continue;
    vps.push({
      number,
      name,
      years: yearSpan(start, end ?? 'present'),
      party: cells[5] || undefined,
      president: cells[7] || undefined,
    });
  }

  return newestTen(vps).map((v, i) => ({
    id: `us-vp-${v.number}`,
    rank: i + 1,
    title: v.name,
    subtitle: v.president ? `Under ${v.president}` : undefined,
    metadata: [v.years, v.party, `${ordinal(Number(v.number))} VP`].filter(Boolean).join(' · '),
  }));
}

/**
 * "Golden Raspberry Award for Worst Picture": each ceremony opens with a row
 * holding only the year ("2025(46th)"); the winner is the next row.
 */
export function parseRazzieWorstPicture(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const winners: { year: string; ceremony?: string; film: string; studio?: string }[] = [];

  for (const table of tablesWith($, ['year', 'film', 'production'])) {
    let pending: { year: string; ceremony?: string } | null = null;

    $(table).find('tr').each((_, tr) => {
      const cells = $(tr).children('th, td').toArray().map(c => cellText($, c));
      const yearMatch = cells.length === 1 ? cells[0].match(/^(\d{4})\s*\((\d+\w*)\)/) ?? cells[0].match(/^(\d{4})/) : null;
      if (yearMatch) {
        pending = { year: yearMatch[1], ceremony: yearMatch[2] };
        return;
      }
      if (pending && cells.length >= 2 && cells[0]) {
        winners.push({ ...pending, film: cells[0], studio: cells[1] || undefined });
        pending = null;
      }
    });
  }

  return newestTen(winners).map((w, i) => ({
    id: `razzie-${w.year}`,
    rank: i + 1,
    title: w.film,
    subtitle: w.studio,
    metadata: `${w.year} films${w.ceremony ? ` · ${w.ceremony} Razzies` : ''}`,
  }));
}
