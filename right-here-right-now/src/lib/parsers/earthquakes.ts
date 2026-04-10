import * as cheerio from 'cheerio';
import { WidgetItem } from '../scraper';

export function parseEarthquakesPrimary(json: Record<string, unknown>): WidgetItem[] {
  const items: WidgetItem[] = [];
  const features = (json.features as Record<string, unknown>[]) || [];

  features.slice(0, 10).forEach((feature: Record<string, unknown>, i: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = feature.properties as Record<string, any>;
    items.push({
      id: `eq-primary-${feature.id || i}`,
      rank: i + 1,
      title: (props.title || props.place) as string,
      subtitle: `Magnitude: ${props.mag}`,
      metadata: new Date(props.time as number).toLocaleString()
    });
  });

  return items;
}

export function parseEarthquakesBackup(html: string): WidgetItem[] {
  // EMSC parsing is quite difficult since it relies on JS or heavily nested tables.
  // We'll write a simple fallback that returns a dummy error, demonstrating fallback resilience
  // Alternatively we can use cheerio but EMSC is very structure-heavy.
  const $ = cheerio.load(html);
  const items: WidgetItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('#tbody-events tr.normalEvent').each((i: number, el: any) => {
    if (i >= 10) return false;

    // Quick approximation for EMSC
    const mag = $(el).find('td.tabev6').text().trim();
    const region = $(el).find('td.tb_region').text().trim();
    const time = $(el).find('td.tabev1').text().trim();

    if (region) {
      items.push({
        id: `eq-backup-${i}`,
        rank: i + 1,
        title: region,
        subtitle: `Magnitude: ${mag}`,
        metadata: time
      });
    }
  });

  return items;
}
