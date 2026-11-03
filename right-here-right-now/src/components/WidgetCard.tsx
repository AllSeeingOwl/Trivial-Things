import React from 'react';
import { WidgetClosure, WidgetData, WidgetItem } from '@/lib/scraper';

interface WidgetCardProps {
  title: string;
  dataPromise: Promise<WidgetData>;
}

export async function WidgetCard({ title, dataPromise }: WidgetCardProps) {
  // We await the data promise here inside the Server Component
  const data = await dataPromise;

  return (
    <div className="bg-[var(--card-background)] border border-[var(--card-border)] rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
      <div className="bg-[#202020] p-4 border-b border-[var(--card-border)] flex justify-between items-center">
        <h3 className="font-bold text-lg">{title}</h3>
        {data.closed && (
          <span className="text-xs bg-sky-600/20 text-sky-400 px-2 py-1 rounded-full border border-sky-600/30 whitespace-nowrap ml-2">
            Election
          </span>
        )}
        {!data.closed && data.source === 'backup' && (
          <span
            className="text-xs bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded-full border border-yellow-600/30 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202020]"
            title="Data loaded from secondary source. Primary source is currently unavailable."
            tabIndex={0}
            role="status"
            aria-label="Backup Source: Data loaded from secondary source. Primary source is currently unavailable."
          >
            Backup Source
          </span>
        )}
      </div>

      <div className="p-4 flex-grow">
        {data.closed ? (
          <ClosedNotice closure={data.closed} items={data.items} />
        ) : data.source === 'error' ? (
          <div className="flex flex-col items-center justify-center h-48 text-center" role="alert" aria-live="assertive">
            <span className="text-3xl mb-2" aria-hidden="true">⚠️</span>
            <p className="text-[var(--error)] font-medium mb-1">{data.error}</p>
            <p className="text-xs text-[var(--text-muted)]">Please try again later</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center" role="status">
            <span className="text-3xl mb-2 text-gray-500" aria-hidden="true">📭</span>
            <p className="text-sm font-medium text-[var(--text-muted)]">No items currently available</p>
          </div>
        ) : (
          <ItemList items={data.items} />
        )}
      </div>
    </div>
  );
}

function ItemList({ items }: { items: WidgetItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={item.id} className="flex items-start">
          <span className="text-[var(--text-muted)] font-mono font-bold w-6 text-right mr-3 mt-0.5">
            {/* Symbol ranks (e.g. ★ for a head of government) take no trailing dot */}
            {typeof item.rank === 'string' && !/\d/.test(item.rank) ? item.rank : `${item.rank ?? idx + 1}.`}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" title={item.title}>
              {item.title}
            </p>
            {item.subtitle && (
              <p className="text-xs text-[var(--text-muted)] truncate" title={item.subtitle}>
                {item.subtitle}
              </p>
            )}
            {item.metadata && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.metadata}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Stand-in rows to blur when a closed widget has no list to show
// (e.g. the official site has been emptied during the election).
const PLACEHOLDER_ROWS = Array.from({ length: 6 }, (_, i) => i);

/**
 * Shown instead of the list while a widget is closed, e.g. for a general
 * election. The last list (or placeholder rows) is blurred behind the notice
 * and hidden from assistive technology, which reads the notice instead.
 */
function ClosedNotice({ closure, items }: { closure: WidgetClosure; items: WidgetItem[] }) {
  return (
    <div className="relative min-h-72">
      <div className="blur-sm opacity-40 select-none pointer-events-none" aria-hidden="true" inert>
        {items.length > 0 ? (
          <ItemList items={items} />
        ) : (
          <div className="space-y-4">
            {PLACEHOLDER_ROWS.map(i => (
              <div key={i} className="flex items-start">
                <div className="w-4 h-4 bg-gray-700 rounded mr-3 mt-0.5"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-2" role="status">
        <div className="bg-[#161616]/95 border border-[var(--card-border)] rounded-lg p-5 text-center max-w-sm shadow-xl">
          <span className="text-3xl block mb-2" aria-hidden="true">🗳️</span>
          <p className="font-bold mb-2">{closure.heading}</p>
          <p className="text-sm mb-2">{closure.reason}</p>
          {closure.detail && (
            <p className="text-xs text-[var(--text-muted)]">{closure.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ⚡ Bolt Optimization: Stabilize Array Reference
// Pre-defining the array outside the component prevents it from being allocated and
// garbage collected on every single render cycle of the skeleton, reducing overhead.
const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

export function WidgetCardSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-[var(--card-background)] border border-[var(--card-border)] rounded-xl shadow-lg overflow-hidden flex flex-col h-full animate-pulse" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
      <div className="bg-[#202020] p-4 border-b border-[var(--card-border)]">
        <h3 className="font-bold text-lg text-transparent bg-gray-700 rounded w-1/2">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {SKELETON_ROWS.map((i) => (
          <div key={i} className="flex items-start">
            <div className="w-4 h-4 bg-gray-700 rounded mr-3 mt-0.5"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-800 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
