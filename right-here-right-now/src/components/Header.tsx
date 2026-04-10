import React from 'react';
import FilterButtons from './FilterButtons';

export default function Header() {
  return (
    <header className="mb-6 border-b border-neutral-800 pb-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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
      </div>
      <FilterButtons />
    </header>
  );
}
