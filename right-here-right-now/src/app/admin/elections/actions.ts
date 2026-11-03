'use server';

import { revalidatePath } from 'next/cache';
import { ADMIN_PATH, isSignedIn, signIn, signOut } from '@/lib/admin-auth';
import { buildElection, formatElectionDate, withElection, withoutElection } from '@/lib/elections';
import { GOVERNMENT_WIDGETS } from '@/lib/governments';
import { readElectionsFile, writeElectionsFile } from '@/lib/github-elections';

export interface ActionResult {
  ok: boolean;
  message: string;
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim();

function widgetFor(key: string) {
  const widget = GOVERNMENT_WIDGETS.find(w => w.key === key);
  if (!widget) throw new Error('Unknown country.');
  return widget;
}

export async function signInAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await signIn(String(formData.get('password') ?? '')))) {
    return { ok: false, message: 'That password isn\'t right.' };
  }
  revalidatePath(ADMIN_PATH);
  return { ok: true, message: 'Signed in.' };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath(ADMIN_PATH);
}

/** Blur a country's card: records the outgoing government and commits elections.json. */
export async function closeCountryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isSignedIn())) return { ok: false, message: 'Your session has ended. Reload the page and sign in again.' };

  try {
    const widget = widgetFor(field(formData, 'key'));
    const election = buildElection(widget, {
      reason: field(formData, 'reason'),
      electionDate: field(formData, 'electionDate'),
      closedFrom: field(formData, 'closedFrom')
    }, await widget.fetchList());

    const file = await readElectionsFile();
    await writeElectionsFile(
      withElection(file.elections, election),
      file.sha,
      `Close ${widget.country} for the ${election.electionDate} election\n\nReason: ${election.reason}\n\nMade from the Right Here, Right Now admin page.`
    );
    revalidatePath(ADMIN_PATH);
    return {
      ok: true,
      message: `${widget.country} is closed for the election on ${formatElectionDate(election.electionDate)}. It goes live once Render finishes redeploying (usually a few minutes).`
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

/** Unblur a country's card straight away by removing its entry. */
export async function reopenCountryAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!(await isSignedIn())) return { ok: false, message: 'Your session has ended. Reload the page and sign in again.' };

  try {
    const widget = widgetFor(field(formData, 'key'));
    const file = await readElectionsFile();
    if (!file.elections.some(e => e.key === widget.key)) {
      return { ok: false, message: `${widget.country} isn't closed.` };
    }
    await writeElectionsFile(
      withoutElection(file.elections, widget.key),
      file.sha,
      `Reopen ${widget.country} after its election\n\nMade from the Right Here, Right Now admin page.`
    );
    revalidatePath(ADMIN_PATH);
    return {
      ok: true,
      message: `${widget.country} is reopened. It goes live once Render finishes redeploying (usually a few minutes).`
    };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
