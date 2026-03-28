'use client';

import { MultiUpload } from '@/components/media/multi-upload';
import { PostCard } from '@/components/media/post-card';
import { saveClubMedia } from '@/lib/actions/media';
import { createClient } from '@/lib/supabase/client';
import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface FeedTabProps {
  clubId: string;
  media: any[];
  canUpload: boolean;
}

export function FeedTab({ clubId, media: initialMedia, canUpload }: FeedTabProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  const handleUpload = async (
    files: { url: string; type: 'image' | 'video' }[],
    caption: string | null
  ) => {
    await saveClubMedia(clubId, files, caption);
    router.refresh();
  };

  const handleChange = () => router.refresh();

  return (
    <div className="space-y-4">
      {canUpload && (
        <MultiUpload
          storagePath={clubId}
          onUpload={handleUpload}
        />
      )}

      {initialMedia.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-3">
            <Camera className="w-8 h-8 opacity-50" />
          </div>
          <p className="font-medium">아직 올린 사진이 없어요</p>
          {canUpload && (
            <p className="text-xs mt-1 text-muted-foreground">클럽 활동 사진을 공유해보세요!</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 stagger">
          {initialMedia.map((item: any) => (
            <PostCard
              key={item.id}
              post={item}
              currentUserId={currentUserId}
              isAdmin={canUpload}
              onDeleted={handleChange}
              onUpdated={handleChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
