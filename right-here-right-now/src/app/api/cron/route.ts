import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');

    // Simple protection: Check if CRON_SECRET is defined and matches the auth header.
    // In Vercel, cron jobs automatically send the CRON_SECRET as a Bearer token.
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
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
