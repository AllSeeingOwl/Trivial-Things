'use client';

import React from 'react';
import Masonry from 'react-masonry-css';

interface DashboardMasonryProps {
  children: React.ReactNode;
}

// ⚡ Bolt Optimization: Stabilize object reference to prevent re-renders
// Moving breakpointColumnsObj outside the component prevents it from being recreated
// on every render, which avoids triggering unnecessary re-renders in the Masonry child component.
const breakpointColumnsObj = {
  default: 4,
  1536: 4, // 2xl
  1280: 3, // xl
  1024: 2, // lg
  768: 1   // md
};

export default function DashboardMasonry({ children }: DashboardMasonryProps) {
  return (
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="my-masonry-grid"
      columnClassName="my-masonry-grid_column"
    >
      {children}
    </Masonry>
  );
}
