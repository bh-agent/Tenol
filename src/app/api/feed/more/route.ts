import { getMoreFeed } from '@/lib/queries/feed';
import { logError } from '@/lib/logger';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const offset = parseInt(searchParams.get('offset') ?? '30', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const excludeIds = searchParams.get('excludeIds')?.split(',').filter(Boolean) ?? [];

    const feed = await getMoreFeed(offset, limit, excludeIds);
    return Response.json({ feed });
  } catch (error) {
    logError('api', 'Feed more failed', { error, path: '/api/feed/more' });
    return Response.json({ feed: [] }, { status: 500 });
  }
}
