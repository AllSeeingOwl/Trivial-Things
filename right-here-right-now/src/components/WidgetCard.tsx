import React from 'react';
import { WidgetData } from '@/lib/scraper';

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
        {data.source === 'backup' && (
          <span
            className="text-xs bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded-full border border-yellow-600/30 cursor-help"
            title="Data loaded from secondary source. Primary source is currently unavailable."
          >
            Backup Source
          </span>
        )}
      </div>

      <div className="p-4 flex-grow">
        {data.source === 'error' ? (
          <div className="flex flex-col items-center justify-center h-48 text-center" role="alert" aria-live="assertive">
            <span className="text-3xl mb-2" aria-hidden="true">⚠️</span>
            <p className="text-[var(--error)] font-medium mb-1">{data.error}</p>
            <p className="text-xs text-[var(--text-muted)]">Please try again later</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.items.map((item, idx) => (
              <li key={item.id} className="flex items-start">
                <span className="text-[var(--text-muted)] font-mono font-bold w-6 text-right mr-3 mt-0.5">
                  {item.rank ?? idx + 1}.
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
        )}
      </div>
    </div>
  );
}

export function WidgetCardSkeleton({ title }: { title: string }) {
  return (
    <div className="bg-[var(--card-background)] border border-[var(--card-border)] rounded-xl shadow-lg overflow-hidden flex flex-col h-full animate-pulse" role="status" aria-busy="true" aria-label={`Loading ${title}`}>
      <div className="bg-[#202020] p-4 border-b border-[var(--card-border)]">
        <h3 className="font-bold text-lg text-transparent bg-gray-700 rounded w-1/2">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
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
