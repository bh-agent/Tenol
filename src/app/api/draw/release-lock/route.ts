import { releaseDrawLock } from '@/lib/actions/draw-lock';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { matchId } = await request.json();
    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'matchId required' }, { status: 400 });
    }
    await releaseDrawLock(matchId);
    return NextResponse.json({ ok: true });
  } catch {
    // Best-effort - don't fail loudly
    return NextResponse.json({ ok: true });
  }
}
