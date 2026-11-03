import elections from '../data/elections.json';
import type { WidgetClosure, WidgetData, WidgetItem } from './scraper';

/**
 * Countries closed for a general (or snap) election, kept in
 * src/data/elections.json. Add and remove entries with `pnpm election`
 * (see scripts/election.mts) rather than by hand, so the outgoing government
 * is recorded correctly.
 *
 * A closed country's card is blurred with the written reason on top. It
 * reopens by itself once both are true:
 *   1. polling day has arrived, and
 *   2. the official website lists a different government from the one
 *      recorded when the country was closed, i.e. the new (or re-elected)
 *      leader's cabinet has been published.
 */
export interface Election {
  /** Widget key, e.g. "uk-government". */
  key: string;
  country: string;
  /** Shown on the card, e.g. "A general election has been called for 6 May 2027." */
  reason: string;
  /** YYYY-MM-DD. The card is closed from this day. */
  closedFrom: string;
  /** YYYY-MM-DD polling day. The card can't reopen before this. */
  electionDate: string;
  /** "Name — Position" for the leader and the ten posts when the country was closed. */
  outgoing: string[];
}

export const ELECTIONS = elections as Election[];

/** The comparable form of a government list. */
export function governmentFingerprint(items: WidgetItem[]): string[] {
  return items.map(i => `${i.title} — ${i.subtitle ?? ''}`);
}

/** Today as YYYY-MM-DD (UTC), comparable with the dates in elections.json. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Whether the official site now lists a new government. Any change to who
 * holds the leader's or the top ten posts counts; an outage or an emptied
 * page does not.
 */
export function hasNewGovernment(election: Election, data: WidgetData): boolean {
  if (data.source === 'error' || data.items.length === 0) return false;
  const current = governmentFingerprint(data.items);
  return current.length !== election.outgoing.length
    || current.some((line, i) => line !== election.outgoing[i]);
}

export type ElectionStatus = 'not-closed' | 'closed' | 'reopened';

export function electionStatus(election: Election | undefined, data: WidgetData, on = today()): ElectionStatus {
  if (!election || on < election.closedFrom) return 'not-closed';
  if (on >= election.electionDate && hasNewGovernment(election, data)) return 'reopened';
  return 'closed';
}

export function findElection(key: string): Election | undefined {
  return ELECTIONS.find(e => e.key === key);
}

/** "2027-05-06" -> "Thursday 6 May 2027" */
export function formatElectionDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

/** Adds the election notice to a government widget's data while its country is closed. */
export function applyElectionClosure(key: string, data: WidgetData, on = today()): WidgetData {
  const election = findElection(key);
  if (electionStatus(election, data, on) !== 'closed' || !election) return data;

  const pollingDay = formatElectionDate(election.electionDate);
  const closed: WidgetClosure = {
    heading: 'Closed for the election',
    reason: election.reason,
    detail: on < election.electionDate
      ? `Polling day: ${pollingDay}. This list reopens once the new government is published on the official website.`
      : `Polling took place on ${pollingDay}. This list reopens once the new government is published on the official website.`
  };
  return { ...data, closed };
}
