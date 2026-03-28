'use client';

import { MultiUpload } from '@/components/media/multi-upload';
import { PostCard } from '@/components/media/post-card';
import { Modal } from '@/components/ui/modal';
import { saveClubMedia } from '@/lib/actions/media';
import { createClient } from '@/lib/supabase/client';
import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface FeedTabProps {
  clubId: string;
  media: any[];
  canUpload: boolean;
}

export function FeedTab({ clubId, media: initialMedia, canUpload }: FeedTabProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showUploadModal, setShowUploadModal] = useState(false);

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
    setShowUploadModal(false);
    router.refresh();
  };

  const handleChange = () => router.refresh();

  return (
    <div className="relative min-h-[50vh]">
      {/* Vertical card feed */}
      {initialMedia.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
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
        <div className="space-y-4">
          {initialMedia.map((item: any, index: number) => (
            <div
              key={item.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
            >
              <PostCard
                post={item}
                currentUserId={currentUserId}
                isAdmin={canUpload}
                onDelete={() => handleChange()}
                onUpdate={() => handleChange()}
              />
            </div>
          ))}
        </div>
      )}

      {/* Floating camera FAB */}
      {canUpload && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all duration-200"
          aria-label="사진 올리기"
        >
          <Camera className="w-6 h-6 text-black" />
        </button>
      )}

      {/* Upload modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="사진 올리기"
      >
        <MultiUpload
          storagePath={clubId}
          onUpload={handleUpload}
        />
      </Modal>
    </div>
  );
}
