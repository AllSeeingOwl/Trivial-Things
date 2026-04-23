'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';

export default function FilterButtons() {
  const pathname = usePathname();

  return (
    <nav aria-label="Category filters" className="flex flex-wrap gap-2 mt-4">
      {CATEGORIES.map((cat) => {
        const isActive = pathname === cat.path;
        return (
          <Link
            key={cat.id}
            href={cat.path}
            aria-current={isActive ? 'page' : undefined}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              isActive
                ? 'bg-white text-black border-white'
                : 'bg-[#171717] text-[#a3a3a3] border-[#262626] hover:text-white hover:border-gray-500'
            }`}
          >
            {cat.label}
          </Link>
        );
      })}
    </nav>
  );
}
