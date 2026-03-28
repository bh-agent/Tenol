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
          <div className="w-16 h-16 rounded-2xl bg-primary-dim flex items-center justify-center mx-auto mb-5">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <p className="text-lg font-semibold text-foreground mb-1.5">아직 사진이 없어요</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            {canUpload
              ? '첫 번째 사진을 올려보세요! 클럽 활동의 순간을 함께 나눠요.'
              : '멤버들이 사진을 올리면 여기에 표시됩니다.'}
          </p>
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
