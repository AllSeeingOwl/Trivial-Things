import React, { Suspense } from 'react';
import Link from 'next/link';
import DashboardMasonry from '@/components/DashboardMasonry';
import { WidgetCard, WidgetCardSkeleton } from '@/components/WidgetCard';
import { fetchWidgetData, ScraperConfig } from '@/lib/scraper';
import { WIDGET_CATEGORIES } from '@/lib/categories';

// Parsers
import {
  parsePremierLeaguePrimary,
  parsePremierLeagueBackup,
  parseRelegationPrimary,
  parseRelegationBackup,
  premierLeagueStandingsUrl,
  resolveCurrentPremierLeagueUrl
} from '@/lib/parsers/premier-league';
import { parseEarthquakesPrimary, parseEarthquakesBackup } from '@/lib/parsers/earthquakes';
import { parseBooksPrimary, parseBooksBackup } from '@/lib/parsers/books';
import { parseOwgrRankings, parseWikiWomensGolf } from '@/lib/parsers/golf';
import { parseAthleticsMen, parseAthleticsWomen } from '@/lib/parsers/athletics';
import { parseFideTop, parseChessComLeaderboard } from '@/lib/parsers/chess';
import { parseEnglandMensSquad, parseEnglandWomensSquad } from '@/lib/parsers/england-squad';
import { parseSuperBowlWinners, parseWimbledonGentlemen, parseWimbledonLadies } from '@/lib/parsers/sports-history';
import { WIKIPEDIA_HEADERS, wikipediaHtmlUrl } from '@/lib/parsers/wikipedia';
import { fetchWrestlingData1, fetchWrestlingData2 } from '@/lib/parsers/wrestling';

interface WidgetGridProps {
  categoryFilter?: string;
}

interface WidgetDefinition {
  key: string;
  title: string;
  category: string;
  config: ScraperConfig;
}

// ⚡ Bolt Optimization: Stabilize Configuration Objects
// Explicitly defining these static configuration objects outside the component prevents them
// from being allocated in memory on every render, avoiding unnecessary garbage collection
// overhead and maintaining stable references.
const PREMIER_LEAGUE_CONFIG: ScraperConfig = {
  // Fallback season (2026/27) if the current-season lookup fails
  primaryUrl: premierLeagueStandingsUrl(841),
  resolvePrimaryUrl: resolveCurrentPremierLeagueUrl,
  backupUrl: 'https://www.skysports.com/premier-league-table',
  primaryParser: parsePremierLeaguePrimary,
  backupParser: parsePremierLeagueBackup,
  isPrimaryJson: true
};

// Same feed as the standings widget (Next.js dedupes the cached fetch), bottom 3 rows only
const RELEGATION_CONFIG: ScraperConfig = {
  ...PREMIER_LEAGUE_CONFIG,
  primaryParser: parseRelegationPrimary,
  backupParser: parseRelegationBackup
};

const sports = WIDGET_CATEGORIES.sports;

// Widgets shown on the "All" page and their own category page, in display order.
const WIDGETS: WidgetDefinition[] = [
  { key: 'premier-league', title: 'Premier League Standings', category: sports, config: PREMIER_LEAGUE_CONFIG },
  { key: 'relegation', title: 'Premier League Relegation Zone', category: sports, config: RELEGATION_CONFIG },
  {
    key: 'golf-men',
    title: 'Best Male Golfers (OWGR)',
    category: sports,
    config: {
      primaryUrl: 'https://apiweb.owgr.com/api/owgr/rankings/getRankings?regionId=0&pageSize=10&pageNumber=1&countryCode=&sortString=Rank+ASC',
      primaryParser: parseOwgrRankings,
      isPrimaryJson: true
    }
  },
  {
    key: 'golf-women',
    title: 'Best Female Golfers (Rolex Rankings)',
    category: sports,
    // lpga.com and rolexrankings.com render client-side / block scripted requests,
    // so this reads the weekly-updated top 10 on Wikipedia.
    config: {
      primaryUrl: wikipediaHtmlUrl("Women's World Golf Rankings"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("Women's_World_Golf_Rankings")}`,
      primaryParser: parseWikiWomensGolf,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'athletics-men',
    title: 'World Athletics Rankings (Men)',
    category: sports,
    config: {
      primaryUrl: 'https://worldathletics.org/world-rankings/overall-ranking/men',
      primaryParser: parseAthleticsMen
    }
  },
  {
    key: 'athletics-women',
    title: 'World Athletics Rankings (Women)',
    category: sports,
    config: {
      primaryUrl: 'https://worldathletics.org/world-rankings/overall-ranking/women',
      primaryParser: parseAthleticsWomen
    }
  },
  {
    key: 'chess',
    title: 'Top Chess Players (FIDE)',
    category: sports,
    config: {
      primaryUrl: 'https://ratings.fide.com/a_top.php?list=open',
      backupUrl: 'https://api.chess.com/pub/leaderboards',
      primaryParser: parseFideTop,
      backupParser: parseChessComLeaderboard,
      isBackupJson: true
    }
  },
  {
    key: 'england-men',
    title: 'England Men\'s Squad (Most Capped)',
    category: sports,
    config: {
      primaryUrl: 'https://www.englandfootball.com/england/mens-senior-team/squad',
      primaryParser: parseEnglandMensSquad
    }
  },
  {
    key: 'england-women',
    title: 'England Women\'s Squad (Most Capped)',
    category: sports,
    config: {
      primaryUrl: 'https://www.englandfootball.com/england/womens-senior-team/squad',
      primaryParser: parseEnglandWomensSquad
    }
  },
  {
    key: 'super-bowl',
    title: 'Super Bowl Winners',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of Super Bowl champions'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_Super_Bowl_champions',
      primaryParser: parseSuperBowlWinners,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'wimbledon-gentlemen',
    title: 'Wimbledon Gentlemen\'s Singles Champions',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl("List of Wimbledon gentlemen's singles champions"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("List_of_Wimbledon_gentlemen's_singles_champions")}`,
      primaryParser: parseWimbledonGentlemen,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'wimbledon-ladies',
    title: 'Wimbledon Ladies\' Singles Champions',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl("List of Wimbledon ladies' singles champions"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("List_of_Wimbledon_ladies'_singles_champions")}`,
      primaryParser: parseWimbledonLadies,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'earthquakes',
    title: 'Live Earthquakes (Last Hour)',
    category: WIDGET_CATEGORIES.science,
    config: {
      primaryUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
      backupUrl: 'https://www.emsc-csem.org/Earthquake/',
      primaryParser: parseEarthquakesPrimary,
      backupParser: parseEarthquakesBackup,
      isPrimaryJson: true
    }
  },
  {
    key: 'books',
    title: 'Best Selling Fiction (US)',
    category: WIDGET_CATEGORIES.books,
    config: {
      // Circana BookScan weekly chart via Publishers Weekly; Goodreads most-read as backup
      primaryUrl: 'https://www.publishersweekly.com/pw/nielsen/hardcoverfiction.html',
      backupUrl: 'https://www.goodreads.com/book/most_read',
      primaryParser: parseBooksPrimary,
      backupParser: parseBooksBackup
    }
  },
];

export default function WidgetGrid({ categoryFilter = 'all' }: WidgetGridProps) {
  // We only fetch and display widgets that match the category filter
  const visibleWidgets = WIDGETS
    .filter(w => categoryFilter === 'all' || categoryFilter === w.category)
    .map(w => ({ ...w, dataPromise: fetchWidgetData(w.config) }));

  // Wrestling is only shown on its own category page
  const showWrestling = categoryFilter === WIDGET_CATEGORIES.wrestling;
  const wrestlingData1 = showWrestling ? fetchWrestlingData1() : null;
  const wrestlingData2 = showWrestling ? fetchWrestlingData2() : null;

  // Check if we have any widgets to show for this category
  if (visibleWidgets.length === 0 && !showWrestling) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" role="status">
        <span className="text-4xl mb-4 text-gray-600" aria-hidden="true">🏗️</span>
        <h3 className="text-xl font-medium mb-2">No widgets yet</h3>
        <p className="text-[var(--text-muted)] mb-6">Check back later for updates to this category.</p>
        <Link
          href="/"
          className="px-6 py-2 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          View all widgets
        </Link>
      </div>
    );
  }

  return (
    <DashboardMasonry>
      {visibleWidgets.map(w => (
        <Suspense key={w.key} fallback={<WidgetCardSkeleton title={w.title} />}>
          <WidgetCard title={w.title} dataPromise={w.dataPromise} />
        </Suspense>
      ))}

      {showWrestling && wrestlingData1 && (
        <Suspense fallback={<WidgetCardSkeleton title="Wrestling Championships (Part 1)" />}>
          <WidgetCard title="Wrestling Championships (Part 1)" dataPromise={wrestlingData1} />
        </Suspense>
      )}

      {showWrestling && wrestlingData2 && (
        <Suspense fallback={<WidgetCardSkeleton title="Wrestling Championships (Part 2)" />}>
          <WidgetCard title="Wrestling Championships (Part 2)" dataPromise={wrestlingData2} />
        </Suspense>
      )}
    </DashboardMasonry>
  );
}
