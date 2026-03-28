import { getMoreFeed } from '@/lib/queries/feed';
import { getSuggestedUsers } from '@/lib/queries/follow';

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
  } catch {
    return Response.json({ feed: [], suggestedUsers: [] }, { status: 500 });
  }
}
