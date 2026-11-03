import { fetchWidgetData, WidgetData } from './scraper';
import { applyElectionClosure } from './elections';
import {
  GOVERNMENT_LIST_LENGTH,
  parseUkGovernment, UK_MINISTERS_URL,
  fetchUsGovernment,
  parseCanadaGovernment, CANADA_CABINET_URL,
  parseGermanyGovernment, GERMANY_CABINET_URL,
  parseJapanGovernment, resolveJapanMinistersUrl, JAPAN_MINISTERS_FALLBACK_URL,
  parseItalyGovernment, ITALY_GOVERNMENT_URL,
  parseSpainGovernment, SPAIN_GOVERNMENT_URL
} from './parsers/government';

/**
 * The News page's government widgets: each country's head of government and
 * the ten highest-ranking posts, read from official government sites in the
 * order they publish. Shared by the page and by `pnpm election`.
 */
export interface GovernmentWidget {
  key: string;
  country: string;
  title: string;
  /** The live list, without any election closure applied. */
  fetchList: () => Promise<WidgetData>;
}

export const GOVERNMENT_WIDGETS: GovernmentWidget[] = [
  {
    key: 'uk-government',
    country: 'United Kingdom',
    title: 'UK Prime Minister & Top 10 Cabinet Posts',
    // GOV.UK lists the Cabinet in official order of precedence
    fetchList: () => fetchWidgetData({
      primaryUrl: UK_MINISTERS_URL,
      primaryParser: parseUkGovernment,
      isPrimaryJson: true,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
  {
    key: 'us-government',
    country: 'United States',
    title: 'US President & Top 10 Posts',
    // Vice President, Speaker, then cabinet secretaries in line-of-succession order
    // (whitehouse.gov and house.gov)
    fetchList: fetchUsGovernment
  },
  {
    key: 'canada-government',
    country: 'Canada',
    title: 'Canadian Prime Minister & Top 10 Cabinet Posts',
    fetchList: () => fetchWidgetData({
      primaryUrl: CANADA_CABINET_URL,
      primaryParser: parseCanadaGovernment,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
  {
    key: 'germany-government',
    country: 'Germany',
    title: 'German Chancellor & Top 10 Cabinet Posts',
    fetchList: () => fetchWidgetData({
      primaryUrl: GERMANY_CABINET_URL,
      primaryParser: parseGermanyGovernment,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
  {
    key: 'japan-government',
    country: 'Japan',
    title: 'Japanese Prime Minister & Top 10 Cabinet Posts',
    fetchList: () => fetchWidgetData({
      primaryUrl: JAPAN_MINISTERS_FALLBACK_URL,
      resolvePrimaryUrl: resolveJapanMinistersUrl,
      primaryParser: parseJapanGovernment,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
  {
    key: 'italy-government',
    country: 'Italy',
    title: 'Italian Prime Minister & Top 10 Government Posts',
    fetchList: () => fetchWidgetData({
      primaryUrl: ITALY_GOVERNMENT_URL,
      primaryParser: parseItalyGovernment,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
  {
    key: 'spain-government',
    country: 'Spain',
    title: 'Spanish Prime Minister & Top 10 Government Posts',
    fetchList: () => fetchWidgetData({
      primaryUrl: SPAIN_GOVERNMENT_URL,
      primaryParser: parseSpainGovernment,
      maxItems: GOVERNMENT_LIST_LENGTH
    })
  },
];

/** The widget's data, closed with the election notice if its country is mid-election. */
export async function fetchGovernment(widget: GovernmentWidget): Promise<WidgetData> {
  return applyElectionClosure(widget.key, await widget.fetchList());
}
