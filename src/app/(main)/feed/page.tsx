export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { RefreshButton } from '@/components/ui/refresh-button';
import { FeedTabs } from '@/components/feed/feed-tabs';
import { getFollowingFeed } from '@/lib/queries/follow';
import { Suspense } from 'react';

export default async function FeedPage() {
  const followingFeed = await getFollowingFeed();

  return (
    <>
      <TopBar
        title="테놀"
        className="[&_h1]:text-gradient [&_h1]:font-bold"
        rightAction={
          <div className="flex items-center gap-0.5">
            <RefreshButton />
            <Suspense fallback={null}>
              <NotificationBell />
            </Suspense>
          </div>
        }
      />

      <FeedTabs followingFeed={followingFeed} />
    </>
  );
}
