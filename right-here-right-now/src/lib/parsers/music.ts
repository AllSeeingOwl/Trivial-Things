import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

// The Official Charts Company site refuses scripted requests, so the UK widget
// reads Wikipedia's running list of number ones instead.

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** "+1" / "-3" / "=" movement -> a short label for the metadata line. */
function movement(lastWeek: string, rank: number): string | undefined {
  const lw = parseInt(lastWeek, 10);
  if (!Number.isFinite(lw)) return lastWeek ? tidy(lastWeek) : undefined;
  if (lw === rank) return 'No change';
  return lw > rank ? `Up from ${lw}` : `Down from ${lw}`;
}

/** Billboard Hot 100 (billboard.com/charts/hot-100). */
export function parseBillboardHot100(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('.o-chart-results-list-row-container').each((_, el) => {
    const $row = $(el);
    const $title = $row.find('li.o-chart-results-list__item h3#title-of-a-story').first();
    const title = tidy($title.text());
    const artist = tidy($title.next('span').text());
    // Labels in order: rank, artist, last week, peak, weeks on chart, ...
    const labels = $row.find('span.c-label').toArray().map(e => tidy($(e).text()));
    const rank = parseInt(labels[0], 10);
    if (!title || !Number.isFinite(rank)) return;

    const [lastWeek, peak, weeks] = labels.slice(2, 5);
    const meta = [
      movement(lastWeek, rank),
      /^\d+$/.test(peak ?? '') ? `Peak ${peak}` : undefined,
      /^\d+$/.test(weeks ?? '') ? `${weeks} wk${weeks === '1' ? '' : 's'}` : undefined,
    ].filter(Boolean).join(' · ');

    items.push({
      id: `billboard-${rank}`,
      rank,
      title,
      subtitle: artist || undefined,
      metadata: meta || undefined,
    });
  });

  return items;
}

/** Spotify global weekly chart as mirrored by kworb.net/spotify/country/global_weekly.html. */
export function parseSpotifyGlobalWeekly(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const headers = $('table thead th').toArray().map(th => tidy($(th).text()).toLowerCase());
  const posCol = headers.indexOf('pos');
  const nameCol = headers.findIndex(h => h.includes('artist and title'));
  const streamsCol = headers.indexOf('streams');
  const wksCol = headers.indexOf('wks');
  if (posCol < 0 || nameCol < 0) return [];

  const items: WidgetItem[] = [];
  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).children('td').toArray().map(td => tidy($(td).text()));
    const rank = parseInt(cells[posCol], 10);
    const name = cells[nameCol];
    if (!Number.isFinite(rank) || !name) return;

    // "Artist - Title (w/ Guest)"; artists can contain hyphens, titles rarely start a split
    const split = name.indexOf(' - ');
    const artist = split > 0 ? name.slice(0, split) : undefined;
    const title = split > 0 ? name.slice(split + 3) : name;

    const meta = [
      streamsCol >= 0 && cells[streamsCol] ? `${cells[streamsCol]} streams` : undefined,
      wksCol >= 0 && /^\d+$/.test(cells[wksCol] ?? '') ? `${cells[wksCol]} wk${cells[wksCol] === '1' ? '' : 's'}` : undefined,
    ].filter(Boolean).join(' · ');

    items.push({ id: `spotify-${rank}`, rank, title, subtitle: artist, metadata: meta || undefined });
  });

  return items;
}

/** Latest UK number one singles, newest first ("List of UK singles chart number ones of the 2020s"). */
export function parseUkNumberOnes(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['artist', 'single', 'week ending']);
  if (!table) return [];

  const artistCol = table.headers.findIndex(h => h.startsWith('artist'));
  const singleCol = table.headers.findIndex(h => h.startsWith('single'));
  const dateCol = table.headers.findIndex(h => h.includes('week ending'));
  const weeksCol = table.headers.findIndex(h => h.includes('weeks'));

  return table.rows
    // Full rows only (skips year dividers); "re" rows are re-entries and still count
    .filter(cells => cells.length === table.headers.length && cells[singleCol] && /\d{4}/.test(cells[dateCol]))
    .slice(-10)
    .reverse()
    .map((cells, i) => {
      const weeks = cells[weeksCol];
      return {
        id: `uk-number-one-${i}`,
        rank: i + 1,
        title: cells[singleCol].replace(/["“”]/g, '').trim(),
        subtitle: cells[artistCol],
        metadata: [
          `From ${cells[dateCol]}`,
          /^\d+$/.test(weeks ?? '') ? `${weeks} wk${weeks === '1' ? '' : 's'} at No. 1` : undefined,
        ].filter(Boolean).join(' · '),
      };
    });
}
