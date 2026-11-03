/**
 * Close or reopen a country's government widget for a general (or snap) election.
 *
 *   pnpm election list
 *   pnpm election close <key> --date YYYY-MM-DD --reason "..." [--from YYYY-MM-DD]
 *   pnpm election reopen <key>
 *
 * `close` fetches the country's current list from its official website and
 * records it as the outgoing government in src/data/elections.json. The card
 * reopens by itself once polling day has passed and the website lists a
 * different government; `reopen` removes the entry straight away (e.g. a
 * leader re-elected with an unchanged cabinet, or to tidy up afterwards).
 *
 * Commit and deploy src/data/elections.json for a change to go live.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GOVERNMENT_WIDGETS } from '../src/lib/governments';
import { Election, electionStatus, formatElectionDate, governmentFingerprint, today } from '../src/lib/elections';

const ELECTIONS_FILE = fileURLToPath(new URL('../src/data/elections.json', import.meta.url));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function load(): Election[] {
  return JSON.parse(readFileSync(ELECTIONS_FILE, 'utf8')) as Election[];
}

function save(elections: Election[]) {
  writeFileSync(ELECTIONS_FILE, `${JSON.stringify(elections, null, 2)}\n`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

function widgetFor(key: string | undefined) {
  const widget = GOVERNMENT_WIDGETS.find(w => w.key === key);
  if (!widget) {
    fail(`Unknown country key "${key ?? ''}". Choose one of:\n${GOVERNMENT_WIDGETS.map(w => `  ${w.key}  (${w.country})`).join('\n')}`);
  }
  return widget;
}

async function list() {
  const elections = load();
  if (elections.length === 0) {
    console.log('No countries are closed for an election.');
    return;
  }
  for (const election of elections) {
    const widget = widgetFor(election.key);
    const status = electionStatus(election, await widget.fetchList());
    const label = status === 'reopened'
      ? 'REOPENED (new government published; run `pnpm election reopen` to tidy up)'
      : status === 'closed' ? 'CLOSED' : `scheduled to close on ${election.closedFrom}`;
    console.log(`${election.country} [${election.key}]: ${label}`);
    console.log(`  Polling day: ${formatElectionDate(election.electionDate)}`);
    console.log(`  Reason: ${election.reason}\n`);
  }
}

async function close(args: string[]) {
  const widget = widgetFor(args[0]);
  const electionDate = option(args, 'date');
  const reason = option(args, 'reason')?.trim();
  const closedFrom = option(args, 'from') ?? today();

  if (!electionDate || !DATE.test(electionDate)) fail('Give polling day as --date YYYY-MM-DD.');
  if (!DATE.test(closedFrom)) fail('Give --from as YYYY-MM-DD.');
  if (electionDate < closedFrom) fail('Polling day can\'t be before the closing date.');
  if (!reason) fail('Give the written reason shown on the card as --reason "...".');

  const data = await widget.fetchList();
  if (data.source === 'error' || data.items.length === 0) {
    fail(`Couldn't read ${widget.country}'s current government from its website, so the outgoing list can't be recorded. Try again later.`);
  }

  const election: Election = {
    key: widget.key,
    country: widget.country,
    reason,
    closedFrom,
    electionDate,
    outgoing: governmentFingerprint(data.items)
  };
  save([...load().filter(e => e.key !== widget.key), election]);

  console.log(`${widget.country} is closed from ${closedFrom} for the election on ${formatElectionDate(electionDate)}.`);
  console.log('Outgoing government recorded:');
  election.outgoing.forEach(line => console.log(`  ${line}`));
  console.log('\nCommit and deploy src/data/elections.json for this to go live.');
}

function reopen(args: string[]) {
  const widget = widgetFor(args[0]);
  const elections = load();
  if (!elections.some(e => e.key === widget.key)) fail(`${widget.country} isn't closed.`);
  save(elections.filter(e => e.key !== widget.key));
  console.log(`${widget.country} reopened. Commit and deploy src/data/elections.json for this to go live.`);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'list': await list(); break;
  case 'close': await close(args); break;
  case 'reopen': reopen(args); break;
  default:
    fail('Usage:\n  pnpm election list\n  pnpm election close <key> --date YYYY-MM-DD --reason "..." [--from YYYY-MM-DD]\n  pnpm election reopen <key>');
}
