'use client';

import React, { useActionState, useState } from 'react';
import {
  ActionResult,
  closeCountryAction,
  reopenCountryAction,
  signInAction,
  signOutAction
} from './actions';

const MAX_REASON_LENGTH = 300;

const inputClass = 'w-full bg-[#111] border border-[var(--card-border)] rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
const primaryButton = 'px-4 py-2 rounded-full text-sm font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
const secondaryButton = 'px-4 py-2 rounded-full text-sm font-medium border border-[var(--card-border)] hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';

function ResultMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? 'status' : 'alert'}
      className={`text-sm mt-3 ${result.ok ? 'text-green-400' : 'text-[var(--error)]'}`}
    >
      {result.message}
    </p>
  );
}

export function SignInForm() {
  const [result, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="max-w-sm space-y-3">
      <label htmlFor="admin-password" className="block text-sm font-medium">Admin password</label>
      <input id="admin-password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <ResultMessage result={result} />
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className={secondaryButton}>Sign out</button>
    </form>
  );
}

function Switch({ on, label, onToggle, disabled }: { on: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${on ? 'bg-sky-500' : 'bg-gray-600'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export interface SavedClosure {
  reason: string;
  closedFrom: string;
  electionDate: string;
  /** Human-readable dates. */
  closedFromLabel: string;
  electionDateLabel: string;
  /** Plain-words status, e.g. "Blurred on the site" or "New government published; reopens automatically". */
  statusLabel: string;
}

interface CountryControlProps {
  widgetKey: string;
  country: string;
  title: string;
  saved: SavedClosure | null;
  /** The saved state differs from what's deployed (Render is redeploying, or auto-deploy is off). */
  awaitingDeploy: boolean;
  today: string;
  /** Saving is unavailable (e.g. no GitHub token). */
  readOnly: boolean;
}

export function CountryControl({ widgetKey, country, title, saved, awaitingDeploy, today, readOnly }: CountryControlProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [closedFrom, setClosedFrom] = useState(today);
  // The latest close/reopen outcome, whichever happened last.
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);

  const [, closeAction, closing] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await closeCountryAction(prev, formData);
    setLastResult(result);
    if (result.ok) setPanelOpen(false);
    return result;
  }, null);
  const [, reopenAction, reopening] = useActionState(async (prev: ActionResult | null, formData: FormData) => {
    const result = await reopenCountryAction(prev, formData);
    setLastResult(result);
    if (result.ok) setPanelOpen(false);
    return result;
  }, null);

  const isClosed = saved !== null;
  const formId = `close-${widgetKey}`;

  return (
    <section className="bg-[var(--card-background)] border border-[var(--card-border)] rounded-xl p-5" aria-labelledby={`${formId}-heading`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${formId}-heading`} className="font-bold text-lg">{country}</h2>
          <p className="text-xs text-[var(--text-muted)]">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${isClosed ? 'text-sky-400' : 'text-[var(--text-muted)]'}`} aria-hidden="true">
            {isClosed ? 'Blurred' : 'Showing'}
          </span>
          <Switch
            on={isClosed}
            label={isClosed ? `Unblur ${country}` : `Blur ${country} for an election`}
            onToggle={() => setPanelOpen(open => !open)}
            disabled={readOnly}
          />
        </div>
      </div>

      {awaitingDeploy && (
        <p className="text-xs mt-3 text-yellow-500">
          Saved. The public page changes once Render finishes redeploying.
        </p>
      )}

      {saved && (
        <dl className="mt-4 text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-[var(--text-muted)]">Reason</dt><dd>{saved.reason}</dd>
          <dt className="text-[var(--text-muted)]">Polling day</dt><dd>{saved.electionDateLabel}</dd>
          <dt className="text-[var(--text-muted)]">Closed from</dt><dd>{saved.closedFromLabel}</dd>
          <dt className="text-[var(--text-muted)]">Status</dt><dd>{saved.statusLabel}</dd>
        </dl>
      )}

      {panelOpen && !isClosed && (
        <form action={closeAction} className="mt-4 space-y-3 border-t border-[var(--card-border)] pt-4">
          <input type="hidden" name="key" value={widgetKey} />
          <div>
            <label htmlFor={`${formId}-reason`} className="block text-sm font-medium mb-1">Reason shown on the card</label>
            <textarea
              id={`${formId}-reason`}
              name="reason"
              required
              maxLength={MAX_REASON_LENGTH}
              rows={2}
              placeholder="e.g. Parliament has been dissolved and a general election called for 6 May 2027."
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-closed-from`} className="block text-sm font-medium mb-1">Blur from</label>
              <input
                id={`${formId}-closed-from`}
                name="closedFrom"
                type="date"
                required
                value={closedFrom}
                onChange={e => setClosedFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${formId}-election-date`} className="block text-sm font-medium mb-1">Polling day</label>
              <input id={`${formId}-election-date`} name="electionDate" type="date" required min={closedFrom} className={inputClass} />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            The current government is recorded as the outgoing one. The card unblurs by itself once polling day has passed and
            the official website lists a new government.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={closing} className={primaryButton}>
              {closing ? 'Saving…' : `Blur ${country}`}
            </button>
            <button type="button" onClick={() => setPanelOpen(false)} className={secondaryButton}>Cancel</button>
          </div>
        </form>
      )}

      {panelOpen && isClosed && (
        <form action={reopenAction} className="mt-4 space-y-3 border-t border-[var(--card-border)] pt-4">
          <input type="hidden" name="key" value={widgetKey} />
          <p className="text-sm">
            Unblur {country} now? Normally it unblurs by itself once the new government is published, so you only need this if,
            for example, the leader was re-elected with the same cabinet.
          </p>
          <div className="flex gap-2">
            <button type="submit" disabled={reopening} className={primaryButton}>
              {reopening ? 'Saving…' : `Unblur ${country}`}
            </button>
            <button type="button" onClick={() => setPanelOpen(false)} className={secondaryButton}>Cancel</button>
          </div>
        </form>
      )}

      <ResultMessage result={lastResult} />
    </section>
  );
}
