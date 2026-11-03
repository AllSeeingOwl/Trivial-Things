import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

/** Drops trailing tallies like "(4, 2–2)" or "(2/2)" that Wikipedia appends to names. */
function stripTally(name: string): string {
  return name.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

/** Most recent Super Bowl winners, newest first ("List of Super Bowl champions"). */
export function parseSuperBowlWinners(html: string): WidgetItem[] {
  const table = findWikiTable(html, ['game', 'winning team', 'losing team']);
  if (!table) return [];

  const gameCol = table.headers.findIndex(h => h === 'game');
  const dateCol = table.headers.findIndex(h => h.startsWith('date'));
  const winCol = table.headers.findIndex(h => h.includes('winning team'));
  const loseCol = table.headers.findIndex(h => h.includes('losing team'));

  return table.rows
    // Played games only: both scores present
    .filter(cells => cells.length === table.headers.length && /\d/.test(cells[winCol + 1]) && /\d/.test(cells[loseCol + 1]))
    .slice(-10)
    .reverse()
    .map((cells, i) => {
      const season = cells[dateCol]?.match(/\((\d{4})\)/)?.[1];
      return {
        id: `superbowl-${i}`,
        rank: i + 1,
        title: stripTally(cells[winCol]),
        subtitle: `Super Bowl ${cells[gameCol]} · beat ${stripTally(cells[loseCol])} ${cells[winCol + 1]}–${cells[loseCol + 1]}`,
        metadata: season ? `${season} season` : undefined
      };
    });
}

/** Most recent Wimbledon singles champions, newest first (Open Era table). */
function parseWimbledon(html: string, idPrefix: string): WidgetItem[] {
  const table = findWikiTable(html, ['year', 'champion', 'runner-up'], { last: true });
  if (!table) return [];

  const yearCol = table.headers.findIndex(h => h.startsWith('year'));
  const champCol = table.headers.findIndex(h => h.includes('champion'));
  const runnerCol = table.headers.findIndex(h => h.includes('runner-up'));
  const scoreCol = table.headers.findIndex(h => h.includes('score'));

  return table.rows
    // Skip years without a tournament (wars, 2020) and any merged/note rows
    .filter(cells => cells.length === table.headers.length && /^\d{4}/.test(cells[yearCol]) && /\d/.test(cells[scoreCol] ?? ''))
    .slice(-10)
    .reverse()
    .map((cells, i) => ({
      id: `${idPrefix}-${i}`,
      rank: i + 1,
      title: stripTally(cells[champCol]),
      subtitle: `${cells[yearCol].slice(0, 4)} · beat ${stripTally(cells[runnerCol])}`,
      metadata: scoreCol >= 0 ? cells[scoreCol] : undefined
    }));
}

export function parseWimbledonGentlemen(html: string): WidgetItem[] {
  return parseWimbledon(html, 'wimbledon-gentlemen');
}

export function parseWimbledonLadies(html: string): WidgetItem[] {
  return parseWimbledon(html, 'wimbledon-ladies');
}
