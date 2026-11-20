import { unstable_cache } from 'next/cache';

export interface WidgetItem {
  id: string;
  rank?: string | number;
  title: string;
  subtitle?: string;
  metadata?: string;
}

/** A notice that hides a widget's list, e.g. while a country holds an election. */
export interface WidgetClosure {
  heading: string;
  reason: string;
  detail?: string;
}

export interface WidgetData {
  items: WidgetItem[];
  source: 'primary' | 'backup' | 'error';
  error?: string;
  /** When set, the card is blurred and shows this notice instead of its list. */
  closed?: WidgetClosure;
}

type ScrapeFunction = (html: string) => WidgetItem[];
type JsonFunction = (json: Record<string, unknown>) => WidgetItem[];

export interface ScraperConfig {
  primaryUrl: string;
  /** Optional: compute the primary URL at request time (e.g. look up the current season). Falls back to primaryUrl if it throws. */
  resolvePrimaryUrl?: () => Promise<string>;
  /** Optional: some sources have no usable second source. */
  backupUrl?: string;
  primaryParser: ScrapeFunction | JsonFunction;
  /** Defaults to primaryParser (for a backup URL serving the same format). */
  backupParser?: ScrapeFunction | JsonFunction;
  isPrimaryJson?: boolean;
  isBackupJson?: boolean;
  extraHeaders?: Record<string, string>;
  /** Headers for the backup request instead of extraHeaders (e.g. a Wikipedia backup for a JSON API). */
  backupHeaders?: Record<string, string>;
  /** Rows to keep; defaults to 10. */
  maxItems?: number;
  /**
   * Skip Next.js's fetch cache, which refuses responses over 2MB. Wrap the
   * widget in cachedWidgetData() instead so the parsed rows are cached.
   */
  skipFetchCache?: boolean;
}

async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
  const { timeout = 10000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });

  clearTimeout(id);

  return response;
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const WIDGET_REVALIDATE_SECONDS = 86400;

export async function fetchWidgetData(config: ScraperConfig): Promise<WidgetData> {
  // Use Next.js 15+ fetch options: caching with revalidate tag
  const headers = { ...COMMON_HEADERS, ...config.extraHeaders };
  const fetchOptions: RequestInit = config.skipFetchCache
    ? { headers, cache: 'no-store' }
    : {
        headers,
        next: {
          revalidate: WIDGET_REVALIDATE_SECONDS, // Cache for 24 hours
          tags: ['widgets']  // Allow manual revalidation via cron
        }
      };

  const maxItems = config.maxItems ?? 10;

  try {
    // 1. Try Primary URL
    let primaryUrl = config.primaryUrl;
    if (config.resolvePrimaryUrl) {
      try {
        primaryUrl = await config.resolvePrimaryUrl();
      } catch (resolveError) {
        console.warn(`Could not resolve primary URL, using ${config.primaryUrl}:`, resolveError);
      }
    }
    const primaryRes = await fetchWithTimeout(primaryUrl, fetchOptions);
    if (!primaryRes.ok) throw new Error(`Primary status: ${primaryRes.status}`);

    let items: WidgetItem[] = [];
    if (config.isPrimaryJson) {
      const data = await primaryRes.json();
      items = (config.primaryParser as JsonFunction)(data);
    } else {
      const html = await primaryRes.text();
      items = (config.primaryParser as ScrapeFunction)(html);
    }

    if (items.length > 0) {
      // ⚡ Bolt Optimization: O(1) In-place Array Truncation
      // By mutating the length property directly, we truncate the array in-place,
      // avoiding the memory allocation and garbage collection overhead of `items.slice()`.
      if (items.length > maxItems) items.length = maxItems;
      return { items, source: 'primary' };
    }
    throw new Error('Primary parser returned 0 items');
  } catch (primaryError) {
    console.warn(`Primary URL failed for ${config.primaryUrl}:`, primaryError);

    // 2. Try Backup URL
    try {
      if (!config.backupUrl) throw new Error('No backup source configured');
      const backupParser = config.backupParser ?? config.primaryParser;
      const backupOptions: RequestInit = config.backupHeaders
        ? { ...fetchOptions, headers: { ...COMMON_HEADERS, ...config.backupHeaders } }
        : fetchOptions;
      const backupRes = await fetchWithTimeout(config.backupUrl, backupOptions);
      if (!backupRes.ok) throw new Error(`Backup status: ${backupRes.status}`);

      let items: WidgetItem[] = [];
      if (config.isBackupJson) {
        const data = await backupRes.json();
        items = (backupParser as JsonFunction)(data);
      } else {
        const html = await backupRes.text();
        items = (backupParser as ScrapeFunction)(html);
      }

      if (items.length > 0) {
        // ⚡ Bolt Optimization: O(1) In-place Array Truncation
        // Truncating the array by modifying length avoids intermediate array allocation.
        if (items.length > maxItems) items.length = maxItems;
        return { items, source: 'backup' };
      }
      throw new Error('Backup parser returned 0 items');
    } catch (backupError) {
      console.error(`Backup URL failed for ${config.backupUrl}:`, backupError);

      // 3. Graceful degradation
      return {
        items: [],
        source: 'error',
        error: 'Update Unavailable'
      };
    }
  }
}

/**
 * Caches a widget's parsed rows for 24 hours (tag 'widgets', like the fetch
 * cache), for sources whose pages are too large for the fetch cache. Failed
 * scrapes are not cached, so the next request tries again.
 */
export function cachedWidgetData(key: string, config: ScraperConfig): () => Promise<WidgetData> {
  const cached = unstable_cache(
    async () => {
      const data = await fetchWidgetData({ ...config, skipFetchCache: true });
      if (data.source === 'error') throw new Error(data.error);
      return data;
    },
    ['widget', key],
    { revalidate: WIDGET_REVALIDATE_SECONDS, tags: ['widgets'] }
  );

  return async () => {
    try {
      return await cached();
    } catch {
      return { items: [], source: 'error', error: 'Update Unavailable' };
    }
  };
}
