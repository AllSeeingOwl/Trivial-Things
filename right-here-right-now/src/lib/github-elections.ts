import 'server-only';
import { Election, serializeElections } from './elections';

/**
 * Reads and commits src/data/elections.json through the GitHub contents API,
 * so the admin page's changes are saved in the repository and Render's
 * auto-deploy publishes them.
 *
 * Environment (set on the Render service):
 *   GITHUB_TOKEN   fine-grained token with "Contents: Read and write" on the repo
 *   GITHUB_REPO    owner/name, default AllSeeingOwl/Trivial-Things
 *   GITHUB_BRANCH  branch Render deploys from, default main
 *   GITHUB_API_URL optional, default https://api.github.com (GitHub Enterprise, or a local mock for testing)
 */
const ELECTIONS_PATH = 'right-here-right-now/src/data/elections.json';

function settings() {
  return {
    token: process.env.GITHUB_TOKEN ?? '',
    repo: process.env.GITHUB_REPO || 'AllSeeingOwl/Trivial-Things',
    branch: process.env.GITHUB_BRANCH || 'main',
    apiUrl: (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/+$/, '')
  };
}

export function isGitHubConfigured(): boolean {
  return settings().token.length > 0;
}

export interface ElectionsFile {
  elections: Election[];
  /** Blob SHA, required by GitHub to update the file without overwriting someone else's change. */
  sha: string;
}

function contentsUrl() {
  const { apiUrl, repo } = settings();
  return `${apiUrl}/repos/${repo}/contents/${ELECTIONS_PATH}`;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RightHereRightNow-admin'
  };
}

async function gitHubError(res: Response, doing: string): Promise<Error> {
  if (res.status === 401) return new Error(`GitHub rejected the token while ${doing}. Check GITHUB_TOKEN on Render.`);
  if (res.status === 403 || res.status === 404) {
    return new Error(`GitHub refused access while ${doing}. Check the token can read and write "Contents" on the repository, and that GITHUB_REPO and GITHUB_BRANCH are right.`);
  }
  if (res.status === 409 || res.status === 422) {
    return new Error('The elections file changed on GitHub while you were editing. Reload the page and try again.');
  }
  return new Error(`GitHub returned ${res.status} while ${doing}. Try again shortly.`);
}

/** The current file on the deploy branch (may be ahead of what's deployed). */
export async function readElectionsFile(): Promise<ElectionsFile> {
  const { token, branch } = settings();
  if (!token) throw new Error('GITHUB_TOKEN isn\'t set on the server.');

  const res = await fetch(`${contentsUrl()}?ref=${encodeURIComponent(branch)}`, {
    headers: headers(token),
    cache: 'no-store'
  });
  if (!res.ok) throw await gitHubError(res, 'reading the elections file');

  const body = await res.json() as { content?: string; sha?: string };
  if (!body.sha || typeof body.content !== 'string') throw new Error('GitHub returned an unexpected response for the elections file.');
  const elections = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')) as Election[];
  return { elections, sha: body.sha };
}

/** Commits a new version of the file. `sha` must be the version the change was based on. */
export async function writeElectionsFile(elections: Election[], sha: string, message: string): Promise<void> {
  const { token, branch } = settings();
  if (!token) throw new Error('GITHUB_TOKEN isn\'t set on the server.');

  const res = await fetch(contentsUrl(), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      message,
      content: Buffer.from(serializeElections(elections), 'utf8').toString('base64'),
      sha,
      branch
    })
  });
  if (!res.ok) throw await gitHubError(res, 'saving the elections file');
}
