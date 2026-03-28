import { getDiscoverFeed, getSuggestedUsers } from '@/lib/queries/follow';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [feed, suggestedUsers] = await Promise.all([
      getDiscoverFeed(),
      getSuggestedUsers(),
    ]);

    return NextResponse.json({ feed, suggestedUsers });
  } catch {
    return NextResponse.json({ feed: [], suggestedUsers: [] }, { status: 500 });
  }
}
