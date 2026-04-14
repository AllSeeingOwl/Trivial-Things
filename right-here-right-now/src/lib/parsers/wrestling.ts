import * as cheerio from 'cheerio';
import { WidgetData, WidgetItem } from '../scraper';

// Define the configurations for wrestling widgets

const WRESTLING_URLS_1 = [
  { url: 'https://www.cagematch.net/en/?id=5&nr=145', name: 'IWGP Heavyweight Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1576', name: 'Wonder Of Stardom Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=4380', name: 'DDT Iron Man Heavy Metal Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=311', name: 'Open The Dream Gate Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1789', name: 'WWE NXT Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=24', name: 'Triple Crown Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=121', name: 'ROH World Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=2964', name: 'Princess Of Princess Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=2827', name: 'RevPro Undisputed British Cruiserweight Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=3796', name: 'GCW World Championship' },
];

const WRESTLING_URLS_2 = [
  { url: 'https://www.cagematch.net/en/?id=5&nr=4370', name: "AEW Women's World Championship" },
  { url: 'https://www.cagematch.net/en/?id=5&nr=650', name: 'TNA Knockouts World Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=1501', name: 'EVE Championship' },
  { url: 'https://www.cagematch.net/en/?id=5&nr=181', name: 'TNA X-Division Championship' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-best-of-the-super-juniors', name: 'NJPW Best of the Super Juniors' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-g1-climax', name: 'NJPW G1 Climax' },
  { url: 'https://www.thesmackdownhotel.com/tournaments/njpw-world-tag-league', name: 'NJPW World Tag League' },
];

async function fetchWithTimeout(resource: string, options: RequestInit & { timeout?: number } = {}) {
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

async function fetchWrestlingItems(urls: { url: string; name: string }[]): Promise<WidgetItem[]> {
  const fetchOptions: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    headers: COMMON_HEADERS,
    next: {
      revalidate: 86400, // 24 hours
      tags: ['widgets']
    }
  };

  const promises = urls.map(async (itemConfig, idx) => {
    try {
      const res = await fetchWithTimeout(itemConfig.url, fetchOptions);
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const html = await res.text();
      const $ = cheerio.load(html);

      let championName = 'Unknown';
      if (itemConfig.url.includes('cagematch.net')) {
        championName = $('.TableContents tr').eq(1).find('.TextBold a').first().text().trim();
        if (!championName) championName = $('.TableContents tr').eq(1).find('a').first().text().trim();
      } else if (itemConfig.url.includes('thesmackdownhotel.com')) {
        championName = $('table tbody tr').first().find('.reign-info h3 a').text().trim();
      }

      if (!championName) {
         championName = 'N/A';
      }

      return {
        id: `wrestling-${itemConfig.name.replace(/\s+/g, '-').toLowerCase()}-${idx}`,
        rank: idx + 1,
        title: itemConfig.name,
        subtitle: championName,
      };
    } catch (e) {
      console.error(`Failed fetching ${itemConfig.url}:`, e);
      return {
        id: `wrestling-${itemConfig.name.replace(/\s+/g, '-').toLowerCase()}-${idx}`,
        rank: idx + 1,
        title: itemConfig.name,
        subtitle: 'Update Unavailable',
      };
    }
  });

  return Promise.all(promises);
}

export async function fetchWrestlingData1(): Promise<WidgetData> {
  const items = await fetchWrestlingItems(WRESTLING_URLS_1);
  return { items, source: 'primary' };
}

export async function fetchWrestlingData2(): Promise<WidgetData> {
  const items = await fetchWrestlingItems(WRESTLING_URLS_2);
  return { items, source: 'primary' };
}
