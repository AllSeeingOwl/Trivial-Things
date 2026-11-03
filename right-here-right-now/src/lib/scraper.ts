export interface WidgetItem {
  id: string;
  rank?: string | number;
  title: string;
  subtitle?: string;
  metadata?: string;
}

export interface WidgetData {
  items: WidgetItem[];
  source: 'primary' | 'backup' | 'error';
  error?: string;
}

export type ScrapeFunction = (html: string) => WidgetItem[];
export type JsonFunction = (json: Record<string, unknown>) => WidgetItem[];

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
  /** Rows to keep; defaults to 10. */
  maxItems?: number;
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

export async function fetchWidgetData(config: ScraperConfig): Promise<WidgetData> {
  // Use Next.js 15+ fetch options: caching with revalidate tag
  const fetchOptions: RequestInit = {
    headers: { ...COMMON_HEADERS, ...config.extraHeaders },
    next: {
      revalidate: 86400, // Cache for 24 hours
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
      const backupRes = await fetchWithTimeout(config.backupUrl, fetchOptions);
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
