import React, { Suspense } from 'react';
import Link from 'next/link';
import DashboardGrid from '@/components/DashboardGrid';
import { WidgetCard, WidgetCardSkeleton } from '@/components/WidgetCard';
import { fetchWidgetData, ScraperConfig, WidgetData } from '@/lib/scraper';
import { CATEGORIES, WIDGET_CATEGORIES } from '@/lib/categories';
import { WIDGETS, WidgetDefinition } from '@/lib/widgets';
import { fetchWrestlingData1, fetchWrestlingData2 } from '@/lib/parsers/wrestling';

interface WidgetGridProps {
  categoryFilter?: string;
}

interface LoadedWidget {
  key: string;
  title: string;
  dataPromise: Promise<WidgetData>;
}

function load(w: WidgetDefinition): LoadedWidget {
  return {
    key: w.key,
    title: w.title,
    dataPromise: w.fetchData ? w.fetchData() : fetchWidgetData(w.config as ScraperConfig),
  };
}

function Cards({ widgets }: { widgets: LoadedWidget[] }) {
  return (
    <DashboardGrid>
      {widgets.map(w => (
        <Suspense key={w.key} fallback={<WidgetCardSkeleton title={w.title} />}>
          <WidgetCard title={w.title} dataPromise={w.dataPromise} />
        </Suspense>
      ))}
    </DashboardGrid>
  );
}

/**
 * The "All" page: one section per category, in tab order, so the page reads
 * as labelled blocks rather than one long mixed grid.
 */
function AllSections() {
  const sections = CATEGORIES
    .filter(cat => cat.id !== 'all')
    .map(cat => ({ ...cat, widgets: WIDGETS.filter(w => w.category === cat.id).map(load) }))
    .filter(section => section.widgets.length > 0);

  return (
    <div className="space-y-12">
      {sections.map(section => (
        <section key={section.id} aria-labelledby={`section-${section.id}`}>
          <div className="flex items-baseline justify-between gap-4 mb-4 pb-2 border-b border-[var(--card-border)]">
            <h2 id={`section-${section.id}`} className="text-xl font-bold">
              {section.label}
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                {section.widgets.length} widget{section.widgets.length === 1 ? '' : 's'}
              </span>
            </h2>
            <Link
              href={section.path}
              className="text-sm text-[var(--text-muted)] hover:text-white whitespace-nowrap rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Open tab <span aria-hidden="true">→</span>
              <span className="sr-only"> {section.label}</span>
            </Link>
          </div>
          <Cards widgets={section.widgets} />
        </section>
      ))}
    </div>
  );
}

export default function WidgetGrid({ categoryFilter = 'all' }: WidgetGridProps) {
  if (categoryFilter === 'all') return <AllSections />;

  const widgets = WIDGETS.filter(w => w.category === categoryFilter).map(load);

  // After the promotion cards, the Wrestling tab adds two cards of individual
  // championships and tournaments (one page per row), kept off the All tab
  if (categoryFilter === WIDGET_CATEGORIES.wrestling) {
    widgets.push(
      { key: 'wrestling-more-1', title: 'More Championships (Part 1)', dataPromise: fetchWrestlingData1() },
      { key: 'wrestling-more-2', title: 'More Championships & NJPW Tournaments (Part 2)', dataPromise: fetchWrestlingData2() },
    );
  }

  if (widgets.length === 0) {
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

  return <Cards widgets={widgets} />;
}
