import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

// IMDb answers scripted requests with a bot challenge, so the Top 250 comes
// from a Letterboxd list that mirrors it in rank order.

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** "1.2M" style figures for view counts. */
function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

/** IMDb Top 250 as mirrored on Letterboxd (letterboxd.com/dave/list/imdb-top-250/). */
export function parseImdbTop250Mirror(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('[data-item-name]').each((_, el) => {
    // "The Shawshank Redemption (1994)"
    const full = tidy($(el).attr('data-item-name') ?? '');
    if (!full) return;
    const match = full.match(/^(.*)\s+\((\d{4})\)$/);
    const rank = items.length + 1;
    items.push({
      id: `imdb-top-${rank}`,
      rank,
      title: match ? match[1] : full,
      metadata: match ? match[2] : undefined,
    });
  });

  return items;
}

/** The Numbers weekly domestic (US) box office chart (the-numbers.com/weekly-box-office-chart). */
export function parseWeeklyBoxOffice(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const table = $('table').toArray().find(t => {
    const head = $(t).find('tr').first().children().toArray().map(c => tidy($(c).text()).toLowerCase());
    return head.includes('rank') && head.includes('title') && head.includes('gross') && head.some(h => h.startsWith('total'));
  });
  if (!table) return [];

  const head = $(table).find('tr').first().children().toArray().map(c => tidy($(c).text()).toLowerCase());
  const col = (name: string) => head.findIndex(h => h === name);
  const rankCol = col('rank');
  const titleCol = col('title');
  const grossCol = col('gross');
  const totalCol = head.findIndex(h => h.startsWith('total'));
  const daysCol = head.findIndex(h => h.startsWith('days'));
  const prevCol = col('prev');

  const items: WidgetItem[] = [];
  $(table).find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).children('td').toArray().map(td => tidy($(td).text()));
    const rank = parseInt(cells[rankCol], 10);
    const title = cells[titleCol];
    if (!Number.isFinite(rank) || !title) return;

    const isNew = prevCol >= 0 && /new/i.test(cells[prevCol] ?? '');
    const days = daysCol >= 0 ? parseInt(cells[daysCol], 10) : NaN;
    items.push({
      id: `box-office-${rank}`,
      rank,
      title,
      subtitle: cells[grossCol] ? `${cells[grossCol]} this week` : undefined,
      metadata: [
        isNew ? 'New' : undefined,
        cells[totalCol] && cells[totalCol] !== cells[grossCol] ? `${cells[totalCol]} total` : undefined,
        Number.isFinite(days) && !isNew ? `Week ${Math.ceil(days / 7)}` : undefined,
      ].filter(Boolean).join(' · ') || undefined,
    });
  });

  return items;
}

/** "2026-11-15" (the Sunday a Netflix week ends) -> "Week to 15 Nov 2026". */
function weekEnding(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return `Week to ${isoDate}`;
  return `Week to ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
}

type NetflixKind = 'Films' | 'TV';

/**
 * Netflix's official global weekly Top 10 (netflix.com/tudum/top10/data/all-weeks-global.tsv).
 * Columns: week, category, weekly_rank, show_title, season_title, weekly_hours_viewed,
 * runtime, weekly_views, cumulative_weeks_in_top_10. English and non-English
 * lists for the latest week are merged and re-ranked by views.
 */
function parseNetflixTsv(text: string, kind: NetflixKind): WidgetItem[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = (lines.shift() ?? '').split('\t');
  const at = (name: string) => head.indexOf(name);
  const [weekCol, catCol, titleCol, seasonCol, viewsCol, hoursCol, weeksCol] =
    ['week', 'category', 'show_title', 'season_title', 'weekly_views', 'weekly_hours_viewed', 'cumulative_weeks_in_top_10'].map(at);
  if ([weekCol, catCol, titleCol].some(c => c < 0)) return [];

  const rows = lines.map(l => l.split('\t')).filter(r => r[catCol]?.startsWith(kind));
  const latest = rows.reduce((max, r) => (r[weekCol] > max ? r[weekCol] : max), '');

  return rows
    .filter(r => r[weekCol] === latest)
    .map(r => ({
      title: r[titleCol],
      season: seasonCol >= 0 && r[seasonCol] && r[seasonCol] !== 'N/A' ? r[seasonCol] : undefined,
      views: Number(r[viewsCol]) || 0,
      hours: Number(r[hoursCol]) || 0,
      weeks: Number(r[weeksCol]) || 0,
      english: !/non-english/i.test(r[catCol]),
    }))
    // Older weeks have no view counts; fall back to hours watched
    .sort((a, b) => (b.views - a.views) || (b.hours - a.hours))
    .map((r, i) => ({
      id: `netflix-${kind.toLowerCase()}-${i}`,
      rank: i + 1,
      title: r.title,
      subtitle: [
        // "Black Doves: Season 2" -> "Season 2"
        r.season ? r.season.replace(`${r.title}: `, '') : undefined,
        r.views ? `${compact(r.views)} views` : r.hours ? `${compact(r.hours)} hours` : undefined,
        r.english ? undefined : 'Non-English',
      ].filter(Boolean).join(' · ') || undefined,
      metadata: [
        weekEnding(latest),
        r.weeks ? `${r.weeks} wk${r.weeks === 1 ? '' : 's'} in Top 10` : undefined,
      ].filter(Boolean).join(' · '),
    }));
}

export function parseNetflixFilms(text: string): WidgetItem[] {
  return parseNetflixTsv(text, 'Films');
}

export function parseNetflixTv(text: string): WidgetItem[] {
  return parseNetflixTsv(text, 'TV');
}

/**
 * Backup: What's on Netflix's daily global ranking (whats-on-netflix.com/most-popular/),
 * a table of "# | Movies | Points | Prior day | TV series | Points | Prior day".
 */
function parseWhatsOnNetflix(html: string, kind: NetflixKind): WidgetItem[] {
  const $ = cheerio.load(html);
  const label = kind === 'Films' ? 'movies' : 'tv series';
  const table = $('table').toArray().find(t =>
    $(t).find('tr').first().children().toArray().some(c => tidy($(c).text()).toLowerCase() === label));
  if (!table) return [];

  const head = $(table).find('tr').first().children().toArray().map(c => tidy($(c).text()).toLowerCase());
  const titleCol = head.indexOf(label);
  const pointsCol = titleCol + 1;
  const priorCol = titleCol + 2;

  const items: WidgetItem[] = [];
  $(table).find('tr').slice(1).each((_, tr) => {
    const cells = $(tr).children('td').toArray().map(td => tidy($(td).text()));
    const title = cells[titleCol];
    if (!title) return;
    const rank = items.length + 1;
    items.push({
      id: `won-${kind.toLowerCase()}-${rank}`,
      rank,
      title,
      subtitle: /^\d+$/.test(cells[pointsCol] ?? '') ? `${cells[pointsCol]} points today` : undefined,
      metadata: cells[priorCol] ? `Prior day: ${cells[priorCol]}` : undefined,
    });
  });

  return items;
}

export function parseWhatsOnNetflixFilms(html: string): WidgetItem[] {
  return parseWhatsOnNetflix(html, 'Films');
}

export function parseWhatsOnNetflixTv(html: string): WidgetItem[] {
  return parseWhatsOnNetflix(html, 'TV');
}
