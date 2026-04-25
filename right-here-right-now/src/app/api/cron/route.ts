import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    // Simple protection: Check if CRON_SECRET is defined and matches the auth header.
    // In Vercel, cron jobs automatically send the CRON_SECRET as a Bearer token.
    // Sentinel: Fail securely if the CRON_SECRET is missing from the environment.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const expectedAuthHeader = `Bearer ${cronSecret}`;
    const actualAuthHeader = authHeader || '';

    // Use timing-safe comparison to prevent timing attacks.
    // We hash both strings to ensure they have the same length before comparison.
    const expectedHash = crypto.createHash('sha256').update(expectedAuthHeader).digest();
    const actualHash = crypto.createHash('sha256').update(actualAuthHeader).digest();

    if (!crypto.timingSafeEqual(expectedHash, actualHash)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Revalidate the entire 'widgets' cache tag
    // @ts-expect-error - Next.js 15+ revalidateTag might have updated types, but functionally it works
    revalidateTag('widgets');

    return NextResponse.json({ success: true, message: 'Widgets cache revalidated' }, { status: 200 });
  } catch (error) {
    console.error('Error during cron execution:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
