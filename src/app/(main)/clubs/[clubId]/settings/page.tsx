'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TopBar } from '@/components/layout/top-bar';
import { ClubAvatar } from '@/components/club/club-avatar';
import { updateClub, updateClubLogo } from '@/lib/actions/clubs';
import { createClient } from '@/lib/supabase/client';
import { Settings, AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';

export default function ClubSettingsPage() {
  const params = useParams();
  const clubId = params.clubId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clubName, setClubName] = useState('');

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const path = `logos/${clubId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('club-media')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('club-media')
        .getPublicUrl(path);

      await updateClubLogo(clubId, publicUrl);
      setLogoUrl(publicUrl);
    } catch {
      alert('로고 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    await updateClub(clubId, formData);
  };

  return (
    <>
      <TopBar title="클럽 설정" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-6 space-y-6 animate-fade-in">
        {/* Logo Upload */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">클럽 프로필 사진</h3>
              <p className="text-xs text-muted-foreground">클럽을 대표하는 사진을 설정합니다</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="relative group"
            >
              <ClubAvatar
                logoUrl={logoUrl}
                name={clubName || '클'}
                size="xl"
                className="transition-opacity group-hover:opacity-75"
              />
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              클릭하여 사진 변경 (최대 5MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </Card>

        {/* Settings Form */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">클럽 정보</h3>
              <p className="text-xs text-muted-foreground">클럽의 기본 정보를 수정합니다</p>
            </div>
          </div>

          <form action={handleSubmit} className="space-y-4">
            <Input
              id="name"
              name="name"
              label="클럽 이름"
              required
              onChange={(e) => setClubName(e.target.value)}
            />
            <Input
              id="description"
              name="description"
              label="클럽 소개"
            />
            <Input
              id="region"
              name="region"
              label="활동 지역"
            />
            <Input
              id="main_court"
              name="main_court"
              label="주요 활동 테니스장"
            />
            <div className="pt-4">
              <Button type="submit" fullWidth size="lg">
                저장
              </Button>
            </div>
          </form>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30 bg-destructive/5" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">위험 구역</h3>
              <p className="text-xs text-muted-foreground">이 작업은 되돌릴 수 없습니다</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            클럽을 삭제하면 모든 경기 기록, 멤버 정보, 통계 데이터가 영구적으로 삭제됩니다.
          </p>
          <Button variant="destructive" fullWidth>
            클럽 삭제
          </Button>
        </Card>
      </div>
    </>
  );
}
