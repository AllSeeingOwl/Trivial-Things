'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';

export default function FilterButtons() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 mb-8 mt-6">
      {CATEGORIES.map((cat) => {
        const isActive = pathname === cat.path;
        return (
          <Link
            key={cat.id}
            href={cat.path}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
              isActive
                ? 'bg-white text-black border-white'
                : 'bg-[#171717] text-[#a3a3a3] border-[#262626] hover:text-white hover:border-gray-500'
            }`}
          >
            {cat.label}
          </Link>
        );
      })}
    </div>
  );
}
