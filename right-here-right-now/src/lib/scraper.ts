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
  backupUrl: string;
  primaryParser: ScrapeFunction | JsonFunction;
  backupParser: ScrapeFunction | JsonFunction;
  isPrimaryJson?: boolean;
  isBackupJson?: boolean;
  extraHeaders?: Record<string, string>;
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

  try {
    // 1. Try Primary URL
    const primaryRes = await fetchWithTimeout(config.primaryUrl, fetchOptions);
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
      if (items.length > 10) items.length = 10;
      return { items, source: 'primary' };
    }
    throw new Error('Primary parser returned 0 items');
  } catch (primaryError) {
    console.warn(`Primary URL failed for ${config.primaryUrl}:`, primaryError);

    // 2. Try Backup URL
    try {
      const backupRes = await fetchWithTimeout(config.backupUrl, fetchOptions);
      if (!backupRes.ok) throw new Error(`Backup status: ${backupRes.status}`);

      let items: WidgetItem[] = [];
      if (config.isBackupJson) {
        const data = await backupRes.json();
        items = (config.backupParser as JsonFunction)(data);
      } else {
        const html = await backupRes.text();
        items = (config.backupParser as ScrapeFunction)(html);
      }

      if (items.length > 0) {
        // ⚡ Bolt Optimization: O(1) In-place Array Truncation
        // Truncating the array by modifying length avoids intermediate array allocation.
        if (items.length > 10) items.length = 10;
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
