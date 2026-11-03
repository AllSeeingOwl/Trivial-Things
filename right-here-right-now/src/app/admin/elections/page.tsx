import React from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { isAdminEnabled, isSignedIn } from '@/lib/admin-auth';
import { Election, ELECTIONS, electionStatus, formatElectionDate, today } from '@/lib/elections';
import { GOVERNMENT_WIDGETS } from '@/lib/governments';
import { isGitHubConfigured, readElectionsFile } from '@/lib/github-elections';
import { CountryControl, SavedClosure, SignInForm, SignOutButton } from './controls';

export const metadata: Metadata = {
  title: 'Election controls · Right Here, Right Now',
  robots: { index: false, follow: false }
};

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Election controls</h1>
      {children}
    </div>
  );
}

const sameEntry = (a?: Election, b?: Election) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default async function ElectionAdminPage() {
  // Settings and sign-in are checked on every request, never baked in at build time.
  await connection();

  if (!isAdminEnabled()) {
    return (
      <Panel>
        <p className="text-[var(--text-muted)]">
          The admin page is switched off. Set an <code>ADMIN_PASSWORD</code> environment variable on the Render service to turn it on.
        </p>
      </Panel>
    );
  }

  if (!(await isSignedIn())) {
    return (
      <Panel>
        <p className="text-[var(--text-muted)] mb-6">Sign in to blur or unblur a country&apos;s government list.</p>
        <SignInForm />
      </Panel>
    );
  }

  // What's saved on GitHub may be ahead of what's deployed while Render redeploys.
  let saved: Election[] = ELECTIONS;
  let problem = '';
  if (!isGitHubConfigured()) {
    problem = 'Saving is unavailable: set a GITHUB_TOKEN environment variable on the Render service (see the README). Showing what is currently deployed.';
  } else {
    try {
      saved = (await readElectionsFile()).elections;
    } catch (error) {
      problem = `${(error as Error).message} Showing what is currently deployed.`;
    }
  }

  const on = today();
  const rows = await Promise.all(GOVERNMENT_WIDGETS.map(async widget => {
    const entry = saved.find(e => e.key === widget.key);
    let closure: SavedClosure | null = null;
    if (entry) {
      const status = electionStatus(entry, await widget.fetchList(), on);
      closure = {
        reason: entry.reason,
        closedFrom: entry.closedFrom,
        electionDate: entry.electionDate,
        closedFromLabel: formatElectionDate(entry.closedFrom),
        electionDateLabel: formatElectionDate(entry.electionDate),
        statusLabel: status === 'reopened'
          ? 'New government published; the card has unblurred by itself. Switch off to tidy up.'
          : status === 'closed'
            ? 'Blurred on the site'
            : `Will blur from ${formatElectionDate(entry.closedFrom)}`
      };
    }
    return {
      widget,
      closure,
      awaitingDeploy: !sameEntry(entry, ELECTIONS.find(e => e.key === widget.key))
    };
  }));

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <p className="text-[var(--text-muted)] text-sm max-w-xl">
          Switch a country on to blur its card on the News page for a general or snap election. Each change is saved to the
          repository on GitHub, and Render publishes it when it redeploys (usually a few minutes).
        </p>
        <SignOutButton />
      </div>

      {problem && (
        <p role="alert" className="text-sm text-yellow-500 border border-yellow-600/30 bg-yellow-600/10 rounded-lg p-3 mb-6">
          {problem}
        </p>
      )}

      <div className="space-y-4">
        {rows.map(({ widget, closure, awaitingDeploy }) => (
          <CountryControl
            key={widget.key}
            widgetKey={widget.key}
            country={widget.country}
            title={widget.title}
            saved={closure}
            awaitingDeploy={awaitingDeploy}
            today={on}
            readOnly={problem !== ''}
          />
        ))}
      </div>
    </Panel>
  );
}
