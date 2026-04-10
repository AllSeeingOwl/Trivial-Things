'use client';

import React from 'react';
import Masonry from 'react-masonry-css';

interface DashboardMasonryProps {
  children: React.ReactNode;
}

export default function DashboardMasonry({ children }: DashboardMasonryProps) {
  const breakpointColumnsObj = {
    default: 4,
    1536: 4, // 2xl
    1280: 3, // xl
    1024: 2, // lg
    768: 1   // md
  };

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
