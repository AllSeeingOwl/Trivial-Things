import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Password sign-in for the admin page. The password is the ADMIN_PASSWORD
 * environment variable; when it isn't set the admin page is switched off.
 * A signed, time-limited, httpOnly cookie keeps the session; changing the
 * password signs everyone out.
 */
const COOKIE_NAME = 'rhrn_admin';
const SESSION_SECONDS = 8 * 60 * 60;
export const ADMIN_PATH = '/admin/elections';

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? '';
}

export function isAdminEnabled(): boolean {
  return adminPassword().length > 0;
}

function sign(issuedAt: string): string {
  return crypto.createHmac('sha256', adminPassword()).update(`rhrn-admin-session:${issuedAt}`).digest('hex');
}

/** Constant-time comparison of two strings of any length. */
function safeEqual(a: string, b: string): boolean {
  const hash = (s: string) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

export async function isSignedIn(): Promise<boolean> {
  if (!isAdminEnabled()) return false;
  const value = (await cookies()).get(COOKIE_NAME)?.value ?? '';
  const [issuedAt, signature] = value.split('.');
  if (!issuedAt || !signature || !/^\d+$/.test(issuedAt)) return false;
  const ageSeconds = (Date.now() - Number(issuedAt)) / 1000;
  if (ageSeconds < 0 || ageSeconds > SESSION_SECONDS) return false;
  return safeEqual(signature, sign(issuedAt));
}

/** Checks the password and, if right, starts a session. Call only from a Server Action. */
export async function signIn(password: string): Promise<boolean> {
  if (!isAdminEnabled() || password.length > 500 || !safeEqual(password, adminPassword())) {
    // Slow down guessing.
    await new Promise(resolve => setTimeout(resolve, 1000));
    return false;
  }
  const issuedAt = String(Date.now());
  (await cookies()).set(COOKIE_NAME, `${issuedAt}.${sign(issuedAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_SECONDS
  });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete({ name: COOKIE_NAME, path: '/admin' });
}
