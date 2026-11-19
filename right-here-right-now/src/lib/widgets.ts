import { cachedWidgetData, ScraperConfig, WidgetData } from '@/lib/scraper';
import { WIDGET_CATEGORIES } from '@/lib/categories';

// Parsers
import {
  parsePremierLeaguePrimary,
  parsePremierLeagueBackup,
  parseRelegationPrimary,
  parseRelegationBackup,
  premierLeagueStandingsUrl,
  resolveCurrentPremierLeagueUrl
} from '@/lib/parsers/premier-league';
import { parseEarthquakesPrimary, parseEarthquakesBackup } from '@/lib/parsers/earthquakes';
import { parseBooksPrimary, parseBooksBackup } from '@/lib/parsers/books';
import { parseOwgrRankings, parseWikiWomensGolf } from '@/lib/parsers/golf';
import { parseAthleticsMen, parseAthleticsWomen } from '@/lib/parsers/athletics';
import { parseFideTop, parseChessComLeaderboard } from '@/lib/parsers/chess';
import { parseEnglandMensSquad, parseEnglandWomensSquad, parseEnglandMensSquadWiki, parseEnglandWomensSquadWiki } from '@/lib/parsers/england-squad';
import { parseSuperBowlWinners, parseWimbledonGentlemen, parseWimbledonLadies } from '@/lib/parsers/sports-history';
import { WIKIPEDIA_HEADERS, wikipediaHtmlUrl } from '@/lib/parsers/wikipedia';
import { parseAppleMusicUs, parseBillboardHot100, parseSpotifyGlobalWeekly, parseUkNumberOnes } from '@/lib/parsers/music';
import { parseTopAnime, parseKitsuTopAnime, parseEurovisionWinners, parseOscarBestActor, parseOscarBestActress } from '@/lib/parsers/entertainment';
import {
  parsePeopleInSpace,
  parseWikipediaMostRead,
  parseWikipediaTop25,
  resolveWikipediaMostReadUrl,
  wikipediaMostReadUrl,
  parseTrendingCrypto,
  parsePeopleInSpaceCorquaid,
  parseCoinMarketCapTrending
} from '@/lib/parsers/live';
import {
  parsePopes,
  parseNobelPeace,
  parseUkPrimeMinisters,
  parseUsVicePresidents,
  parseRazzieWorstPicture
} from '@/lib/parsers/history';
import {
  parseImdbTop250Mirror,
  parseWeeklyBoxOffice,
  parseNetflixFilms,
  parseNetflixTv,
  parseWhatsOnNetflixFilms,
  parseWhatsOnNetflixTv,
  parseBoxOfficeMojoWeekend
} from '@/lib/parsers/film-tv';
import {
  parseForbesBillionaires,
  parseFortuneGlobal500,
  parseLargestCompaniesWiki,
  parseLatestBreaches,
  parseMostSubscribedYouTube,
  parseMostDislikedYouTube,
  parseBillionairesWiki,
  parseDataBreachesWiki
} from '@/lib/parsers/money-creators';
import { parseSteamMostPlayed, parseSteamStoreMostPlayed, parseSteamWeek, parseSteamBottom, parseSteamPopularNew } from '@/lib/parsers/steam';
import { GOVERNMENT_WIDGETS, fetchGovernment } from '@/lib/governments';

export interface WidgetDefinition {
  key: string;
  title: string;
  category: string;
  config?: ScraperConfig;
  /** For widgets that combine several sources instead of one scraper config. */
  fetchData?: () => Promise<WidgetData>;
}

// ⚡ Bolt Optimization: Stabilize Configuration Objects
// Explicitly defining these static configuration objects outside the component prevents them
// from being allocated in memory on every render, avoiding unnecessary garbage collection
// overhead and maintaining stable references.
const PREMIER_LEAGUE_CONFIG: ScraperConfig = {
  // Fallback season (2026/27) if the current-season lookup fails
  primaryUrl: premierLeagueStandingsUrl(841),
  resolvePrimaryUrl: resolveCurrentPremierLeagueUrl,
  backupUrl: 'https://www.skysports.com/premier-league-table',
  primaryParser: parsePremierLeaguePrimary,
  backupParser: parsePremierLeagueBackup,
  isPrimaryJson: true
};

// Same feed as the standings widget (Next.js dedupes the cached fetch), bottom 3 rows only
const RELEGATION_CONFIG: ScraperConfig = {
  ...PREMIER_LEAGUE_CONFIG,
  primaryParser: parseRelegationPrimary,
  backupParser: parseRelegationBackup
};

const sports = WIDGET_CATEGORIES.sports;
const entertainment = WIDGET_CATEGORIES.entertainment;
const videoGames = WIDGET_CATEGORIES.videoGames;

// Widgets shown on the "All" page and their own category page, in display order.
export const WIDGETS: WidgetDefinition[] = [
  { key: 'premier-league', title: 'Premier League Standings', category: sports, config: PREMIER_LEAGUE_CONFIG },
  { key: 'relegation', title: 'Premier League Relegation Zone', category: sports, config: RELEGATION_CONFIG },
  {
    key: 'golf-men',
    title: 'Best Male Golfers (OWGR)',
    category: sports,
    config: {
      primaryUrl: 'https://apiweb.owgr.com/api/owgr/rankings/getRankings?regionId=0&pageSize=10&pageNumber=1&countryCode=&sortString=Rank+ASC',
      primaryParser: parseOwgrRankings,
      isPrimaryJson: true
    }
  },
  {
    key: 'golf-women',
    title: 'Best Female Golfers (Rolex Rankings)',
    category: sports,
    // lpga.com and rolexrankings.com render client-side / block scripted requests,
    // so this reads the weekly-updated top 10 on Wikipedia.
    config: {
      primaryUrl: wikipediaHtmlUrl("Women's World Golf Rankings"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("Women's_World_Golf_Rankings")}`,
      primaryParser: parseWikiWomensGolf,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'athletics-men',
    title: 'World Athletics Rankings (Men)',
    category: sports,
    config: {
      primaryUrl: 'https://worldathletics.org/world-rankings/overall-ranking/men',
      primaryParser: parseAthleticsMen
    }
  },
  {
    key: 'athletics-women',
    title: 'World Athletics Rankings (Women)',
    category: sports,
    config: {
      primaryUrl: 'https://worldathletics.org/world-rankings/overall-ranking/women',
      primaryParser: parseAthleticsWomen
    }
  },
  {
    key: 'chess',
    title: 'Top Chess Players (FIDE)',
    category: sports,
    config: {
      primaryUrl: 'https://ratings.fide.com/a_top.php?list=open',
      backupUrl: 'https://api.chess.com/pub/leaderboards',
      primaryParser: parseFideTop,
      backupParser: parseChessComLeaderboard,
      isBackupJson: true
    }
  },
  {
    key: 'england-men',
    title: 'England Men\'s Squad (Most Capped)',
    category: sports,
    // Its Wikipedia backup is ~2MB, too big for the fetch cache, so cache the parsed rows
    fetchData: cachedWidgetData('england-men', {
      primaryUrl: 'https://www.englandfootball.com/england/mens-senior-team/squad',
      backupUrl: 'https://en.wikipedia.org/wiki/England_national_football_team',
      primaryParser: parseEnglandMensSquad,
      backupParser: parseEnglandMensSquadWiki,
      backupHeaders: WIKIPEDIA_HEADERS
    })
  },
  {
    key: 'england-women',
    title: 'England Women\'s Squad (Most Capped)',
    category: sports,
    // Its Wikipedia backup is ~2MB, too big for the fetch cache, so cache the parsed rows
    fetchData: cachedWidgetData('england-women', {
      primaryUrl: 'https://www.englandfootball.com/england/womens-senior-team/squad',
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("England_women's_national_football_team")}`,
      primaryParser: parseEnglandWomensSquad,
      backupParser: parseEnglandWomensSquadWiki,
      backupHeaders: WIKIPEDIA_HEADERS
    })
  },
  {
    key: 'super-bowl',
    title: 'Super Bowl Winners',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of Super Bowl champions'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_Super_Bowl_champions',
      primaryParser: parseSuperBowlWinners,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'wimbledon-gentlemen',
    title: 'Wimbledon Gentlemen\'s Singles Champions',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl("List of Wimbledon gentlemen's singles champions"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("List_of_Wimbledon_gentlemen's_singles_champions")}`,
      primaryParser: parseWimbledonGentlemen,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'wimbledon-ladies',
    title: 'Wimbledon Ladies\' Singles Champions',
    category: sports,
    config: {
      primaryUrl: wikipediaHtmlUrl("List of Wimbledon ladies' singles champions"),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("List_of_Wimbledon_ladies'_singles_champions")}`,
      primaryParser: parseWimbledonLadies,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'earthquakes',
    title: 'Live Earthquakes (Last Hour)',
    category: WIDGET_CATEGORIES.science,
    config: {
      primaryUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
      backupUrl: 'https://www.emsc-csem.org/Earthquake/',
      primaryParser: parseEarthquakesPrimary,
      backupParser: parseEarthquakesBackup,
      isPrimaryJson: true
    }
  },
  {
    key: 'people-in-space',
    title: 'Humans In Space Right Now',
    category: WIDGET_CATEGORIES.science,
    config: {
      primaryUrl: 'https://www.howmanypeopleareinspacerightnow.com/peopleinspace.json',
      backupUrl: 'https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json',
      primaryParser: parsePeopleInSpace,
      backupParser: parsePeopleInSpaceCorquaid,
      isBackupJson: true,
      isPrimaryJson: true,
      // Show everyone aboard, not just the first ten
      maxItems: 30
    }
  },
  {
    key: 'books',
    title: 'Best Selling Fiction (US)',
    category: WIDGET_CATEGORIES.books,
    config: {
      // Circana BookScan weekly chart via Publishers Weekly; Goodreads most-read as backup
      primaryUrl: 'https://www.publishersweekly.com/pw/nielsen/hardcoverfiction.html',
      backupUrl: 'https://www.goodreads.com/book/most_read',
      primaryParser: parseBooksPrimary,
      backupParser: parseBooksBackup
    }
  },
  // Entertainment: music charts, anime and award winners
  {
    key: 'billboard-hot-100',
    title: 'US Billboard Hot 100',
    category: entertainment,
    // The chart page is ~4MB, over the fetch cache's 2MB limit, so cache the parsed rows
    fetchData: cachedWidgetData('billboard-hot-100', {
      primaryUrl: 'https://www.billboard.com/charts/hot-100/',
      // Backup: Apple Music's US top songs (the wish-list's suggested backup), via kworb
      backupUrl: 'https://kworb.net/charts/apple_s/us.html',
      primaryParser: parseBillboardHot100,
      backupParser: parseAppleMusicUs
    })
  },
  {
    key: 'uk-number-ones',
    title: 'UK Number One Singles (Latest)',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of UK singles chart number ones of the 2020s'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_UK_singles_chart_number_ones_of_the_2020s',
      primaryParser: parseUkNumberOnes,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'spotify-global',
    title: 'Most Streamed Songs (Spotify Global, Weekly)',
    category: entertainment,
    config: {
      primaryUrl: 'https://kworb.net/spotify/country/global_weekly.html',
      backupUrl: 'https://kworb.net/spotify/country/global_daily.html',
      primaryParser: parseSpotifyGlobalWeekly
    }
  },
  // Films & TV
  {
    key: 'box-office',
    title: 'Films Of The Week (US Box Office)',
    category: entertainment,
    config: {
      primaryUrl: 'https://www.the-numbers.com/weekly-box-office-chart',
      backupUrl: 'https://www.boxofficemojo.com/weekend/chart/',
      // Redirects to the latest weekend's chart
      primaryParser: parseWeeklyBoxOffice,
      backupParser: parseBoxOfficeMojoWeekend
    }
  },
  {
    key: 'netflix-films',
    title: 'Top On Netflix: Films',
    category: entertainment,
    config: {
      // Netflix's official global weekly Top 10 (tab-separated)
      primaryUrl: 'https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv',
      backupUrl: 'https://www.whats-on-netflix.com/most-popular/',
      primaryParser: parseNetflixFilms,
      backupParser: parseWhatsOnNetflixFilms
    }
  },
  {
    key: 'netflix-tv',
    title: 'Top On Netflix: TV',
    category: entertainment,
    config: {
      primaryUrl: 'https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv',
      backupUrl: 'https://www.whats-on-netflix.com/most-popular/',
      primaryParser: parseNetflixTv,
      backupParser: parseWhatsOnNetflixTv
    }
  },
  {
    key: 'imdb-top-250',
    title: 'IMDb Top 250 Movies',
    category: entertainment,
    config: {
      // IMDb blocks scripted requests; this Letterboxd list mirrors the chart in order
      primaryUrl: 'https://letterboxd.com/dave/list/imdb-top-250/',
      primaryParser: parseImdbTop250Mirror
    }
  },
  {
    key: 'top-anime',
    title: 'Top Anime Series (MyAnimeList)',
    category: entertainment,
    config: {
      primaryUrl: 'https://myanimelist.net/topanime.php',
      backupUrl: 'https://kitsu.io/api/edge/anime?sort=ratingRank&page%5Blimit%5D=10',
      primaryParser: parseTopAnime,
      backupParser: parseKitsuTopAnime,
      isBackupJson: true
    }
  },
  {
    key: 'eurovision',
    title: 'Eurovision Song Contest Winners',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of Eurovision Song Contest winners'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_Eurovision_Song_Contest_winners',
      primaryParser: parseEurovisionWinners,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'oscar-best-actor',
    title: 'Best Actor Oscar Winners',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('Academy Award for Best Actor'),
      backupUrl: 'https://en.wikipedia.org/wiki/Academy_Award_for_Best_Actor',
      primaryParser: parseOscarBestActor,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'oscar-best-actress',
    title: 'Best Actress Oscar Winners',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('Academy Award for Best Actress'),
      backupUrl: 'https://en.wikipedia.org/wiki/Academy_Award_for_Best_Actress',
      primaryParser: parseOscarBestActress,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'razzie-worst-picture',
    title: 'Razzie Winners: Worst Picture',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('Golden Raspberry Award for Worst Picture'),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent('Golden_Raspberry_Award_for_Worst_Picture')}`,
      primaryParser: parseRazzieWorstPicture,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  // Creators
  {
    key: 'youtube-most-subscribed',
    title: 'YouTube Most Subscribed Channels',
    category: entertainment,
    config: {
      // Social Blade blocks scripted requests; Wikipedia's list is updated monthly
      primaryUrl: wikipediaHtmlUrl('List of most-subscribed YouTube channels'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_most-subscribed_YouTube_channels',
      primaryParser: parseMostSubscribedYouTube,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'youtube-most-disliked',
    title: 'Most Disliked YouTube Videos',
    category: entertainment,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of most-disliked YouTube videos'),
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_most-disliked_YouTube_videos',
      primaryParser: parseMostDislikedYouTube,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  // Video Games: Steam charts via Steam250, with Steam's own chart as a backup
  {
    key: 'steam-most-played',
    title: 'Most Played Steam Games (Live)',
    category: videoGames,
    config: {
      primaryUrl: 'https://steam250.com/most_played',
      backupUrl: 'https://store.steampowered.com/charts/mostplayed',
      primaryParser: parseSteamMostPlayed,
      backupParser: parseSteamStoreMostPlayed
    }
  },
  {
    key: 'steam-week',
    title: 'Video Games Of The Week (Steam, Last 7 Days)',
    category: videoGames,
    config: {
      primaryUrl: 'https://steam250.com/7day',
      backupUrl: 'https://store.steampowered.com/search/results/?query&start=0&count=100&filter=popularnew&infinite=1',
      primaryParser: parseSteamWeek,
      backupParser: parseSteamPopularNew,
      isBackupJson: true
    }
  },
  {
    key: 'steam-bottom',
    title: 'Worst Rated Steam Games',
    category: videoGames,
    config: {
      primaryUrl: 'https://steam250.com/bottom100',
      primaryParser: parseSteamBottom
    }
  },
  {
    key: 'wikipedia-most-read',
    title: 'Most Read Wikipedia Pages (Yesterday)',
    category: WIDGET_CATEGORIES.news,
    config: {
      // Fallback (yesterday at build time) if the date lookup fails
      primaryUrl: wikipediaMostReadUrl(),
      resolvePrimaryUrl: resolveWikipediaMostReadUrl,
      backupUrl: wikipediaHtmlUrl('Wikipedia:Top 25 Report'),
      primaryParser: parseWikipediaMostRead,
      backupParser: parseWikipediaTop25,
      isPrimaryJson: true,
      extraHeaders: { ...WIKIPEDIA_HEADERS, Accept: 'application/json, text/html;q=0.9' }
    }
  },
  // Business & Tech
  {
    key: 'richest-people',
    title: 'Richest People In The World',
    category: WIDGET_CATEGORIES.businessTech,
    // Its Wikipedia backup is ~2MB, too big for the fetch cache, so cache the parsed rows
    fetchData: cachedWidgetData('richest-people', {
      // The data feed behind forbes.com/real-time-billionaires (the page itself refuses scripts)
      primaryUrl: 'https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?limit=10',
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent("The_World's_Billionaires")}`,
      primaryParser: parseForbesBillionaires,
      backupParser: parseBillionairesWiki,
      backupHeaders: WIKIPEDIA_HEADERS,
      isPrimaryJson: true,
      extraHeaders: { Accept: 'application/json' }
    })
  },
  {
    key: 'global-500',
    title: 'Top Companies (Fortune Global 500)',
    category: WIDGET_CATEGORIES.businessTech,
    config: {
      primaryUrl: 'https://fortune.com/ranking/global500/',
      backupUrl: wikipediaHtmlUrl('List of largest companies by revenue'),
      primaryParser: parseFortuneGlobal500,
      backupParser: parseLargestCompaniesWiki,
      // Wikimedia asks for a descriptive User-Agent; Fortune accepts it too
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'data-breaches',
    title: 'Latest Data Breaches (Have I Been Pwned)',
    category: WIDGET_CATEGORIES.businessTech,
    // Its Wikipedia backup is ~2MB, too big for the fetch cache, so cache the parsed rows
    fetchData: cachedWidgetData('data-breaches', {
      primaryUrl: 'https://haveibeenpwned.com/api/v3/breaches',
      backupUrl: 'https://en.wikipedia.org/wiki/List_of_data_breaches',
      primaryParser: parseLatestBreaches,
      backupParser: parseDataBreachesWiki,
      backupHeaders: WIKIPEDIA_HEADERS,
      isPrimaryJson: true,
      extraHeaders: { Accept: 'application/json' }
    })
  },
  {
    key: 'trending-crypto',
    title: 'Trending Cryptocurrencies',
    category: WIDGET_CATEGORIES.businessTech,
    config: {
      primaryUrl: 'https://api.coingecko.com/api/v3/search/trending',
      backupUrl: 'https://api.coinmarketcap.com/data-api/v3/topsearch/rank',
      primaryParser: parseTrendingCrypto,
      backupParser: parseCoinMarketCapTrending,
      isBackupJson: true,
      isPrimaryJson: true,
      extraHeaders: { Accept: 'application/json' }
    }
  },
  // History: office-holders and prize winners, newest first
  {
    key: 'popes',
    title: 'Roman Catholic Popes',
    category: WIDGET_CATEGORIES.history,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of popes'),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent('List_of_popes')}`,
      primaryParser: parsePopes,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'nobel-peace',
    title: 'Nobel Peace Prize Winners',
    category: WIDGET_CATEGORIES.history,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of Nobel Peace Prize laureates'),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent('List_of_Nobel_Peace_Prize_laureates')}`,
      primaryParser: parseNobelPeace,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'uk-prime-ministers',
    title: 'UK Prime Ministers',
    category: WIDGET_CATEGORIES.history,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of prime ministers of the United Kingdom'),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent('List_of_prime_ministers_of_the_United_Kingdom')}`,
      primaryParser: parseUkPrimeMinisters,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  {
    key: 'us-vice-presidents',
    title: 'US Vice Presidents',
    category: WIDGET_CATEGORIES.history,
    config: {
      primaryUrl: wikipediaHtmlUrl('List of vice presidents of the United States'),
      backupUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent('List_of_vice_presidents_of_the_United_States')}`,
      primaryParser: parseUsVicePresidents,
      extraHeaders: WIKIPEDIA_HEADERS
    }
  },
  // News: each country's head of government and ten highest-ranking posts
  ...GOVERNMENT_WIDGETS.map(g => ({
    key: g.key,
    title: g.title,
    category: WIDGET_CATEGORIES.news,
    fetchData: () => fetchGovernment(g)
  })),
];
