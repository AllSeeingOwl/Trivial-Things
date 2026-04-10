import React, { Suspense } from 'react';
import DashboardMasonry from '@/components/DashboardMasonry';
import { WidgetCard, WidgetCardSkeleton } from '@/components/WidgetCard';
import { fetchWidgetData } from '@/lib/scraper';
import { WIDGET_CATEGORIES } from '@/lib/categories';

// Parsers
import { parsePremierLeaguePrimary, parsePremierLeagueBackup } from '@/lib/parsers/premier-league';
import { parseEarthquakesPrimary, parseEarthquakesBackup } from '@/lib/parsers/earthquakes';
import { parseBooksPrimary, parseBooksBackup } from '@/lib/parsers/books';

interface WidgetGridProps {
  categoryFilter?: string;
}

export default function WidgetGrid({ categoryFilter = 'all' }: WidgetGridProps) {
  // We only fetch and display widgets that match the category filter

  const showPremierLeague = categoryFilter === 'all' || categoryFilter === WIDGET_CATEGORIES.premierLeague;
  const premierLeagueData = showPremierLeague ? fetchWidgetData({
    primaryUrl: 'https://www.premierleague.com/tables',
    backupUrl: 'https://www.skysports.com/premier-league-table',
    primaryParser: parsePremierLeaguePrimary,
    backupParser: parsePremierLeagueBackup
  }) : null;

  const showEarthquakes = categoryFilter === 'all' || categoryFilter === WIDGET_CATEGORIES.earthquakes;
  const earthquakesData = showEarthquakes ? fetchWidgetData({
    primaryUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    backupUrl: 'https://www.emsc-csem.org/Earthquake/',
    primaryParser: parseEarthquakesPrimary,
    backupParser: parseEarthquakesBackup,
    isPrimaryJson: true
  }) : null;

  const showBooks = categoryFilter === 'all' || categoryFilter === WIDGET_CATEGORIES.books;
  const booksData = showBooks ? fetchWidgetData({
    primaryUrl: 'https://www.amazon.co.uk/charts/mostsold/fiction',
    backupUrl: 'https://www.nytimes.com/books/best-sellers/',
    primaryParser: parseBooksPrimary,
    backupParser: parseBooksBackup
  }) : null;

  // Check if we have any widgets to show for this category
  if (!showPremierLeague && !showEarthquakes && !showBooks) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <span className="text-4xl mb-4 text-gray-600">🏗️</span>
        <h3 className="text-xl font-medium mb-2">No widgets yet</h3>
        <p className="text-[var(--text-muted)]">Check back later for updates to this category.</p>
      </div>
    );
  }

  return (
    <DashboardMasonry>
      {showPremierLeague && premierLeagueData && (
        <Suspense fallback={<WidgetCardSkeleton title="Premier League Standings" />}>
          <WidgetCard title="Premier League Standings" dataPromise={premierLeagueData} />
        </Suspense>
      )}

      {showEarthquakes && earthquakesData && (
        <Suspense fallback={<WidgetCardSkeleton title="Live Earthquakes (Last Hour)" />}>
          <WidgetCard title="Live Earthquakes (Last Hour)" dataPromise={earthquakesData} />
        </Suspense>
      )}

      {showBooks && booksData && (
        <Suspense fallback={<WidgetCardSkeleton title="Best Selling Books" />}>
          <WidgetCard title="Best Selling Books" dataPromise={booksData} />
        </Suspense>
      )}
    </DashboardMasonry>
  );
}
