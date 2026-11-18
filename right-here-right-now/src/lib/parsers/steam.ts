import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

// Steam250 (steam250.com) publishes server-rendered rankings built from Steam's
// own data. Each game is a `.applist > div[id]` block with .title, .score and
// .reviews; what .score means depends on the list.

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

type ScoreLabel = (score: string) => string | undefined;

function parseSteam250(html: string, idPrefix: string, scoreLabel: ScoreLabel): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('.applist > div[id]').each((_, el) => {
    const $app = $(el);
    // The element id is the rank; the .rank cell also holds a movement badge such as "+3"
    const rank = parseInt($app.attr('id') ?? '', 10);
    const $title = $app.find('.title a[title]').first();
    const title = tidy($title.text()) || $title.attr('title');
    if (!Number.isFinite(rank) || !title) return;

    const date = tidy($app.find('.title .date').first().text());
    const tag = tidy($app.find('.title .tag').first().text());
    const rating = tidy($app.find('.reviews .rating').first().text());
    const score = tidy($app.find('.score').first().text());

    items.push({
      id: `${idPrefix}-${rank}`,
      rank,
      title,
      subtitle: [tag, date].filter(Boolean).join(' · ') || undefined,
      metadata: [scoreLabel(score), rating ? `${rating} positive` : undefined].filter(Boolean).join(' · ') || undefined,
    });
  });

  return items;
}

/** steam250.com/most_played: .score is the current player count, e.g. "690K". */
export function parseSteamMostPlayed(html: string): WidgetItem[] {
  return parseSteam250(html, 'steam-most-played', s => (s ? `${s} playing` : undefined));
}

/** steam250.com/7day: best-rated games released in the last week; .score is a rating out of 10. */
export function parseSteamWeek(html: string): WidgetItem[] {
  return parseSteam250(html, 'steam-week', s => (s ? `Rated ${s}/10` : undefined));
}

/** steam250.com/bottom100: lowest-rated games on Steam; .score is a rating out of 10. */
export function parseSteamBottom(html: string): WidgetItem[] {
  return parseSteam250(html, 'steam-bottom', s => (s ? `Rated ${s}/10` : undefined));
}

/**
 * Backup for most played: Steam's own chart (store.steampowered.com/charts/mostplayed).
 * Its class names are hashed and change between builds, so this reads the table
 * by shape: rank cell, game link, price, current players, peak today.
 */
export function parseSteamStoreMostPlayed(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('tr').each((_, tr) => {
    const $cells = $(tr).children('td');
    if ($cells.length < 4) return;
    const rank = parseInt(tidy($cells.first().text()), 10);
    const title = tidy($(tr).find('a[href*="/app/"]').last().text());
    if (!Number.isFinite(rank) || !title) return;

    const numbers = $cells.toArray().map(td => tidy($(td).text())).filter(t => /^\d{1,3}(,\d{3})*$/.test(t));
    const [current, peak] = numbers.slice(-2);

    items.push({
      id: `steam-store-most-played-${rank}`,
      rank,
      title,
      metadata: [current ? `${current} playing` : undefined, peak ? `Peak today ${peak}` : undefined].filter(Boolean).join(' · ') || undefined,
    });
  });

  return items;
}
