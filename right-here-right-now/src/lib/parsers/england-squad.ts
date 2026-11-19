import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';
import { findWikiTable } from './wikipedia';

const POSITION_LABELS: Record<string, string> = {
  Goalkeepers: 'Goalkeeper',
  Defenders: 'Defender',
  Midfielders: 'Midfielder',
  Forwards: 'Forward',
};

/**
 * englandfootball.com squad page. The page lists the current squad first and a
 * "recent players" squad second, so only the first .squad-profiles-wrapper is
 * read. Widgets show 10 rows, so the squad is ordered by senior caps.
 */
function parseEnglandSquad(html: string, idPrefix: string): WidgetItem[] {
  const $ = cheerio.load(html);
  const players: { name: string; position: string; caps: number }[] = [];

  $('.squad-profiles-wrapper').first().find('.player-profile-list').each((_, list) => {
    const $list = $(list);
    const group = ($list.attr('id') || '').replace('squad-block-', '');
    const position = POSITION_LABELS[group];
    if (!position) return; // skip Manager / staff

    $list.find('.player-profile').each((_, profile) => {
      const $profile = $(profile);
      const name = $profile.find('a.player-name').text().replace(/\s+/g, ' ').trim();
      if (!name) return;

      let caps = 0;
      $profile.find('.stats').each((_, stat) => {
        const $stat = $(stat);
        if (/caps/i.test($stat.find('p').first().text())) {
          caps = parseInt($stat.find('.value').text().trim(), 10) || 0;
        }
      });
      players.push({ name, position, caps });
    });
  });

  return players
    .sort((a, b) => b.caps - a.caps)
    .slice(0, 10)
    .map((p, i) => ({
      id: `${idPrefix}-${i}`,
      rank: i + 1,
      title: p.name,
      subtitle: `${p.position} · ${p.caps} cap${p.caps === 1 ? '' : 's'}`
    }));
}

export function parseEnglandMensSquad(html: string): WidgetItem[] {
  return parseEnglandSquad(html, 'england-men');
}

export function parseEnglandWomensSquad(html: string): WidgetItem[] {
  return parseEnglandSquad(html, 'england-women');
}

const WIKI_POSITIONS: Record<string, string> = { GK: 'Goalkeeper', DF: 'Defender', MF: 'Midfielder', FW: 'Forward' };

/**
 * Backup: the "Current squad" table on the team's Wikipedia article
 * (No. | Pos. | Player | Date of birth (age) | Caps | Goals | Club), ordered by caps.
 */
function parseEnglandSquadWiki(html: string, idPrefix: string): WidgetItem[] {
  const table = findWikiTable(html, ['pos', 'player', 'caps', 'club']);
  if (!table) return [];

  const col = (start: string) => table.headers.findIndex(h => h.startsWith(start));
  const [posCol, playerCol, capsCol] = ['pos', 'player', 'caps'].map(col);

  return table.rows
    .filter(cells => cells.length === table.headers.length && cells[playerCol] && /^\d+$/.test(cells[capsCol]))
    .map(cells => ({
      name: cells[playerCol].replace(/\s*\((captain|vice-captain)\)$/i, ''),
      // "4FW" -> "FW" (the digit is a sort key)
      position: WIKI_POSITIONS[cells[posCol].replace(/^\d+/, '')] ?? cells[posCol].replace(/^\d+/, ''),
      caps: Number(cells[capsCol]),
    }))
    .sort((a, b) => b.caps - a.caps)
    .slice(0, 10)
    .map((p, i) => ({
      id: `${idPrefix}-wiki-${i}`,
      rank: i + 1,
      title: p.name,
      subtitle: `${p.position} · ${p.caps} cap${p.caps === 1 ? '' : 's'}`
    }));
}

export function parseEnglandMensSquadWiki(html: string): WidgetItem[] {
  return parseEnglandSquadWiki(html, 'england-men');
}

export function parseEnglandWomensSquadWiki(html: string): WidgetItem[] {
  return parseEnglandSquadWiki(html, 'england-women');
}
