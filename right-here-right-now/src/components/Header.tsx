'use client';

import React, { useEffect, useState } from 'react';
import FilterButtons from './FilterButtons';

export default function Header() {
  const [portalUrl, setPortalUrl] = useState('https://trivial-things.onrender.com');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.') || h.startsWith('10.')) {
        setPortalUrl(`http://${h}:8080`);
      }
    }
  }, []);

  return (
    <header className="mb-6 border-b border-neutral-800 pb-4">
      <nav className="mb-6 -mx-6 -mt-6 md:-mx-10 md:-mt-10 bg-neutral-900 text-white px-6 py-3 flex justify-between items-center text-sm border-b border-neutral-800" aria-label="Portal Navigation">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-100">Right Here Right Now Portal</span>
          <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full text-xs border border-neutral-700">Standalone Service</span>
        </div>
        <a href={portalUrl} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-semibold transition">
          ← Back to Central Portal
        </a>
      </nav>

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
