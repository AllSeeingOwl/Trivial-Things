import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

// Official World Golf Ranking JSON API (the one owgr.com itself loads).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOwgrRankings(json: any): WidgetItem[] {
  const list = json?.rankingsList;
  if (!Array.isArray(list)) return [];

  return list.slice(0, 10).flatMap((entry, i): WidgetItem[] => {
    const name = entry?.player?.fullName;
    if (!name) return [];
    const country = entry.player.country?.name;
    const avg = typeof entry.pointsAverage === 'number' ? entry.pointsAverage.toFixed(2) : null;
    return [{
      id: `golf-men-owgr-${i}`,
      rank: entry.rank ?? i + 1,
      title: name,
      subtitle: [country, avg && `${avg} avg pts`].filter(Boolean).join(' · ')
    }];
  });
}

/**
 * Current top-10 table on a Wikipedia ranking article
 * (columns include Rank, Player, Country, Points).
 */
function parseWikiGolfRanking(html: string, idPrefix: string): WidgetItem[] {
  const table = findWikiTable(html, ['rank', 'player', 'points']);
  if (!table) return [];

  const col = (name: string) => table.headers.findIndex(h => h.includes(name));
  const rankCol = col('rank');
  const playerCol = col('player');
  const countryCol = col('country');
  const pointsCol = col('points');

  return table.rows
    .filter(cells => cells.length === table.headers.length && cells[playerCol])
    .slice(0, 10)
    .map((cells, i) => ({
      id: `${idPrefix}-${i}`,
      rank: cells[rankCol] || i + 1,
      title: cells[playerCol],
      subtitle: [countryCol >= 0 ? cells[countryCol] : '', cells[pointsCol] && `${cells[pointsCol]} avg pts`]
        .filter(Boolean)
        .join(' · ')
    }));
}

export function parseWikiMensGolf(html: string): WidgetItem[] {
  return parseWikiGolfRanking(html, 'golf-men-wiki');
}

export function parseWikiWomensGolf(html: string): WidgetItem[] {
  return parseWikiGolfRanking(html, 'golf-women-wiki');
}
