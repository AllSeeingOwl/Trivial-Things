import React from 'react';

interface DashboardMasonryProps {
  children: React.ReactNode;
}

// ⚡ Bolt Optimization: Remove Client-Side Masonry Library
// Replacing the heavy, JS-driven `react-masonry-css` library with pure CSS columns allows us
// to remove the `'use client'` directive. This converts DashboardMasonry into a 100% Server Component,
// drastically reducing the client-side JavaScript bundle size and eliminating layout thrashing on resize.
export default function DashboardMasonry({ children }: DashboardMasonryProps) {
  return (
    <div className="columns-1 md:columns-1 lg:columns-2 xl:columns-3 2xl:columns-4 gap-6 space-y-6">
      {React.Children.map(children, (child) => {
        // Ensure we only wrap actual elements (to avoid wrapping nulls from conditional rendering)
        if (!React.isValidElement(child)) return child;
        return <div className="break-inside-avoid">{child}</div>;
      })}
    </div>
  );
}
