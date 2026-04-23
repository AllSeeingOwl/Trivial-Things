import React from 'react';
import FilterButtons from './FilterButtons';

export default function Header() {
  return (
    <header className="mb-6 border-b border-neutral-800 pb-2">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">
            Right Here, Right Now.
          </h1>
          <p className="text-[var(--text-muted)] text-lg">
            A real-time snapshot of the world&apos;s culture, sports, tech, and trends.
          </p>
          <FilterButtons />
        </div>
        <div
          className="text-sm font-mono text-[var(--text-muted)] flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-full border border-neutral-800 cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          title="Content is automatically refreshed every 24 hours"
          tabIndex={0}
          role="status"
          aria-label="System status: Auto-updates daily"
        >
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Auto-updates daily.
        </div>
      </div>
    </header>
  );
}
