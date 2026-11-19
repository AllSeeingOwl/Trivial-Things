import React from 'react';

interface DashboardGridProps {
  children: React.ReactNode;
}

// A CSS grid rather than CSS columns: cards read left to right, row by row,
// and every card in a row stretches to the height of the tallest one, so
// short and long lists line up instead of staggering. Pure CSS, so this
// stays a Server Component.
export default function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <div
      data-testid="widget-grid"
      className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 items-stretch"
    >
      {React.Children.map(children, (child) => {
        // Only wrap actual elements (skip nulls from conditional rendering)
        if (!React.isValidElement(child)) return child;
        return <div className="min-w-0">{child}</div>;
      })}
    </div>
  );
}
