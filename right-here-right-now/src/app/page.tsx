import React, { Suspense } from 'react';
import DashboardMasonry from '@/components/DashboardMasonry';
import { WidgetCard, WidgetCardSkeleton } from '@/components/WidgetCard';
import { fetchWidgetData } from '@/lib/scraper';

// Parsers
import { parsePremierLeaguePrimary, parsePremierLeagueBackup } from '@/lib/parsers/premier-league';
import { parseEarthquakesPrimary, parseEarthquakesBackup } from '@/lib/parsers/earthquakes';
import { parseBooksPrimary, parseBooksBackup } from '@/lib/parsers/books';

export default function Home() {
  // Widget Data Promises
  const premierLeagueData = fetchWidgetData({
    primaryUrl: 'https://www.premierleague.com/tables',
    backupUrl: 'https://www.skysports.com/premier-league-table',
    primaryParser: parsePremierLeaguePrimary,
    backupParser: parsePremierLeagueBackup
  });

  const earthquakesData = fetchWidgetData({
    primaryUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
    backupUrl: 'https://www.emsc-csem.org/Earthquake/',
    primaryParser: parseEarthquakesPrimary,
    backupParser: parseEarthquakesBackup,
    isPrimaryJson: true
  });

  const booksData = fetchWidgetData({
    primaryUrl: 'https://www.amazon.co.uk/charts/mostsold/fiction',
    backupUrl: 'https://www.nytimes.com/books/best-sellers/',
    primaryParser: parseBooksPrimary,
    backupParser: parseBooksBackup
  });

  return (
    <main className="min-h-screen p-6 md:p-10 max-w-[1600px] mx-auto">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-neutral-800 pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            Right Here, Right Now.
          </h1>
          <p className="text-[var(--text-muted)] text-lg">
            A real-time snapshot of the world&apos;s culture, sports, tech, and trends.
          </p>
        </div>
        <div className="text-sm font-mono text-[var(--text-muted)]">
          Auto-updates daily.
        </div>
      </header>

      <DashboardMasonry>
        <Suspense fallback={<WidgetCardSkeleton title="Premier League Standings" />}>
          <WidgetCard title="Premier League Standings" dataPromise={premierLeagueData} />
        </Suspense>

        <Suspense fallback={<WidgetCardSkeleton title="Live Earthquakes (Last Hour)" />}>
          <WidgetCard title="Live Earthquakes (Last Hour)" dataPromise={earthquakesData} />
        </Suspense>

        <Suspense fallback={<WidgetCardSkeleton title="Best Selling Books" />}>
          <WidgetCard title="Best Selling Books" dataPromise={booksData} />
        </Suspense>
      </DashboardMasonry>
    </main>
  );
}
