import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';
import { cellText, findWikiTable } from './wikipedia';

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** MyAnimeList top anime by score (myanimelist.net/topanime.php). */
export function parseTopAnime(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('tr.ranking-list').each((_, el) => {
    const $row = $(el);
    const rank = parseInt(tidy($row.find('.rank').first().text()), 10);
    const title = tidy($row.find('h3 a').first().text());
    if (!Number.isFinite(rank) || !title) return;

    // "TV (28 eps) Sep 2023 - Mar 2024 1,546,232 members" -> "TV (28 eps) · Sep 2023 - Mar 2024"
    const info = tidy($row.find('.information').first().text()).replace(/\s*[\d,]+\s+members$/, '');
    const format = info.match(/^[^()]*\([^)]*\)/)?.[0];
    const dates = format ? tidy(info.slice(format.length)) : '';
    const score = tidy($row.find('.score').first().text());

    items.push({
      id: `anime-${rank}`,
      rank,
      title,
      subtitle: [format ?? info, dates].filter(Boolean).join(' · ') || undefined,
      metadata: /^\d/.test(score) ? `Score ${score}` : undefined,
    });
  });

  return items;
}

/** Most recent Eurovision Song Contest winners, newest first ("List of Eurovision Song Contest winners"). */
export function parseEurovisionWinners(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['year', 'country', 'song', 'artist']);
  if (!table) return [];

  const yearCol = table.headers.findIndex(h => h.startsWith('year'));
  const countryCol = table.headers.findIndex(h => h.startsWith('country'));
  const songCol = table.headers.findIndex(h => h.startsWith('song'));
  const artistCol = table.headers.findIndex(h => h.startsWith('artist'));

  return table.rows
    // Contest rows only (skips 2020, cancelled, and any note rows)
    .filter(cells => /^\d{4}/.test(cells[yearCol] ?? '') && cells[songCol] && cells[artistCol])
    .slice(-10)
    .reverse()
    .map((cells, i) => ({
      id: `eurovision-${i}`,
      rank: i + 1,
      title: `${cells[artistCol]} – ${cells[songCol].replace(/["“”]/g, '').trim()}`,
      subtitle: cells[countryCol],
      metadata: cells[yearCol].slice(0, 4),
    }));
}

/**
 * Latest Academy Award winners from "Academy Award for Best Actor/Actress".
 * Each ceremony's rows start with a <th rowspan> year cell; the winner is the
 * first row of the group and the nominees follow without a year cell.
 */
function parseOscarWinners(html: string, person: 'actor' | 'actress'): WidgetItem[] {
  const $ = cheerio.load(html);
  const winners: { year: string; name: string; role: string; film: string }[] = [];

  $('table.wikitable').each((_, table) => {
    const $table = $(table);
    const headers = $table.find('tr').first().find('th').toArray().map(th => cellText($, th).toLowerCase());
    if (!headers[0]?.startsWith('year') || headers[1] !== person || !headers.some(h => h.startsWith('film'))) return;

    $table.find('tr').slice(1).each((_, tr) => {
      const $cells = $(tr).children('th, td');
      const first = $cells.first();
      if (first.prop('tagName')?.toLowerCase() !== 'th') return;
      const cells = $cells.toArray().map(c => cellText($, c));
      const year = cells[0];
      const name = cells[1]?.replace(/\s*[‡†]+\s*$/, '').trim();
      if (!/^\d{4}/.test(year) || !name) return;
      winners.push({ year, name, role: cells[2] ?? '', film: cells[3] ?? '' });
    });
  });

  return winners
    .slice(-10)
    .reverse()
    .map((w, i) => {
      // "2025(98th)" -> "2025 · 98th ceremony"
      const ceremony = w.year.match(/\((\d+\w*)\)/)?.[1];
      return {
        id: `oscar-${person}-${i}`,
        rank: i + 1,
        title: w.name,
        subtitle: [w.film, w.role ? `as ${w.role}` : ''].filter(Boolean).join(' · '),
        metadata: `${w.year.slice(0, 4)} film year${ceremony ? ` · ${ceremony} Oscars` : ''}`,
      };
    });
}

export function parseOscarBestActor(html: string): WidgetItem[] {
  return parseOscarWinners(html, 'actor');
}

export function parseOscarBestActress(html: string): WidgetItem[] {
  return parseOscarWinners(html, 'actress');
}

interface KitsuAnime {
  attributes?: {
    canonicalTitle?: string;
    averageRating?: string | null;
    ratingRank?: number | null;
    subtype?: string;
    episodeCount?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  };
}

function monthYear(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Backup for top anime: Kitsu's highest-rated (kitsu.io/api/edge/anime?sort=ratingRank); ratings are out of 100. */
export function parseKitsuTopAnime(json: Record<string, unknown>): WidgetItem[] {
  const data = Array.isArray(json.data) ? (json.data as KitsuAnime[]) : [];

  return data
    .map(d => d.attributes)
    .filter(a => a?.canonicalTitle)
    .map((a, i) => {
      // Kitsu subtypes: TV, movie, OVA, ONA, special, music
      const subtype = a!.subtype ? a!.subtype.charAt(0).toUpperCase() + a!.subtype.slice(1) : 'TV';
      const eps = a!.episodeCount ? `${subtype} (${a!.episodeCount} ep${a!.episodeCount === 1 ? '' : 's'})` : subtype;
      const start = monthYear(a!.startDate);
      const end = monthYear(a!.endDate);
      const dates = start ? (end && end !== start ? `${start} - ${end}` : start) : undefined;
      const rating = Number(a!.averageRating);
      return {
        id: `kitsu-anime-${i}`,
        rank: a!.ratingRank ?? i + 1,
        title: a!.canonicalTitle!,
        subtitle: [eps, dates].filter(Boolean).join(' · ') || undefined,
        metadata: Number.isFinite(rating) && rating > 0 ? `Rated ${(rating / 10).toFixed(2)}/10 on Kitsu` : undefined,
      };
    });
}
