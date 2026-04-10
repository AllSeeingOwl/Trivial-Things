import React from 'react';
import { notFound } from 'next/navigation';
import WidgetGrid from '@/components/WidgetGrid';
import { CATEGORIES } from '@/lib/categories';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export function generateStaticParams() {
  return CATEGORIES.filter(cat => cat.id !== 'all').map((cat) => ({
    category: cat.id,
  }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = await params;
  const { category } = resolvedParams;

  // Validate that the category exists
  const isValidCategory = CATEGORIES.some(cat => cat.id === category && cat.id !== 'all');

  if (!isValidCategory) {
    notFound();
  }

  return (
    <>
      <WidgetGrid categoryFilter={category} />
    </>
  );
}
