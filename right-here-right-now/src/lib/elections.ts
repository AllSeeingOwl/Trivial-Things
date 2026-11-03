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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_REASON_LENGTH = 300;

export interface ClosureInput {
  reason: string;
  electionDate: string;
  closedFrom: string;
}

/** Checks a close request; returns the problem in plain words, or null if it's fine. */
export function validateClosure({ reason, electionDate, closedFrom }: ClosureInput): string | null {
  const isRealDate = (d: string) => ISO_DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
  if (!reason.trim()) return 'Write the reason shown on the card.';
  if (reason.length > MAX_REASON_LENGTH) return `Keep the reason to ${MAX_REASON_LENGTH} characters or fewer.`;
  if (!isRealDate(electionDate)) return 'Give polling day as a date (YYYY-MM-DD).';
  if (!isRealDate(closedFrom)) return 'Give the closing date as a date (YYYY-MM-DD).';
  if (electionDate < closedFrom) return 'Polling day can\'t be before the closing date.';
  return null;
}

/**
 * A new entry for elections.json, recording the government currently on the
 * official website as the outgoing one. Throws (with a plain message) if the
 * input is invalid or the current government can't be read.
 */
export function buildElection(
  widget: { key: string; country: string },
  input: ClosureInput,
  current: WidgetData
): Election {
  const problem = validateClosure(input);
  if (problem) throw new Error(problem);
  if (current.source === 'error' || current.items.length === 0) {
    throw new Error(`Couldn't read ${widget.country}'s current government from its website, so the outgoing list can't be recorded. Try again later.`);
  }
  return {
    key: widget.key,
    country: widget.country,
    reason: input.reason.trim(),
    closedFrom: input.closedFrom,
    electionDate: input.electionDate,
    outgoing: governmentFingerprint(current.items)
  };
}

/** Replaces any existing entry for the same country. */
export function withElection(elections: Election[], election: Election): Election[] {
  return [...elections.filter(e => e.key !== election.key), election];
}

export function withoutElection(elections: Election[], key: string): Election[] {
  return elections.filter(e => e.key !== key);
}

/** The exact file contents written to elections.json (by the admin page and `pnpm election`). */
export function serializeElections(elections: Election[]): string {
  return `${JSON.stringify(elections, null, 2)}\n`;
}
