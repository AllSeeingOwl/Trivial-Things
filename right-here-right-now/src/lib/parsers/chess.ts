import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

/** "Carlsen, Magnus" -> "Magnus Carlsen" */
function fideName(name: string): string {
  const [last, first] = name.split(',').map(s => s.trim());
  return first ? `${first} ${last}` : name.trim();
}

/** FIDE official top-100 standard rating list (ratings.fide.com/a_top.php). */
export function parseFideTop(html: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  $('table.top_recors_table tr').each((_, el) => {
    if (items.length >= 10) return false;
    const $cells = $(el).find('td');
    if ($cells.length < 4) return; // header row

    const name = $cells.eq(1).text().trim();
    if (!name) return;

    const federation = $cells.eq(2).text().trim();
    const rating = $cells.eq(3).text().trim();
    items.push({
      id: `chess-fide-${items.length}`,
      rank: $cells.eq(0).text().trim() || items.length + 1,
      title: fideName(name),
      subtitle: [federation, rating && `Rating ${rating}`].filter(Boolean).join(' · ')
    });
  });

  return items;
}

/** Chess.com official public API leaderboards (backup: online rapid ratings). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseChessComLeaderboard(json: any): WidgetItem[] {
  const players = json?.live_rapid;
  if (!Array.isArray(players)) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return players.slice(0, 10).map((p: any, i: number) => ({
    id: `chess-chesscom-${i}`,
    rank: p.rank ?? i + 1,
    title: [p.title, p.name || p.username].filter(Boolean).join(' '),
    subtitle: `Chess.com Rapid ${p.score}`
  }));
}
