import { getMoreFeed } from '@/lib/queries/feed';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const offset = parseInt(searchParams.get('offset') ?? '30', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

    const feed = await getMoreFeed(offset, limit);
    return Response.json({ feed });
  } catch {
    return Response.json({ feed: [] }, { status: 500 });
  }
}
