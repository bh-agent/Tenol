import { getMoreFeed } from '@/lib/queries/feed';
import { getSuggestedUsers } from '@/lib/queries/follow';
import { logError } from '@/lib/logger';

/**
 * @deprecated Use /api/feed/more instead. Kept for backwards compatibility.
 */
export async function GET() {
  try {
    const [feed, suggestedUsers] = await Promise.all([
      getMoreFeed(0, 50),
      getSuggestedUsers(),
    ]);

    return Response.json({ feed, suggestedUsers });
  } catch (error) {
    logError('api', 'Feed discover failed', { error, path: '/api/feed/discover' });
    return Response.json({ feed: [], suggestedUsers: [] }, { status: 500 });
  }
}
