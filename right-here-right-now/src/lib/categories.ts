export const CATEGORIES = [
  { id: 'all', label: 'All', path: '/' },
  { id: 'sports', label: 'Sports', path: '/sports' },
  { id: 'entertainment', label: 'Entertainment', path: '/entertainment' },
  { id: 'books', label: 'Books', path: '/books' },
  { id: 'video-games', label: 'Video Games', path: '/video-games' },
  { id: 'news', label: 'News', path: '/news' },
  { id: 'business-tech', label: 'Business & Tech', path: '/business-tech' },
  { id: 'science', label: 'Science', path: '/science' },
  { id: 'wrestling', label: 'Wrestling', path: '/wrestling' },
];

export const WIDGET_CATEGORIES = {
  sports: 'sports',
  entertainment: 'entertainment',
  videoGames: 'video-games',
  science: 'science',
  books: 'books',
  news: 'news',
  businessTech: 'business-tech',
  wrestling: 'wrestling',
} as const;
