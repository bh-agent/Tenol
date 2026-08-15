'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RegionPicker } from '@/components/ui/region-picker';
import { Modal } from '@/components/ui/modal';
import { TopBar } from '@/components/layout/top-bar';
import { ClubAvatar } from '@/components/club/club-avatar';
import { updateClub, updateClubLogo, deleteClub } from '@/lib/actions/clubs';
import { useToast } from '@/components/ui/toast-provider';
import { createClient } from '@/lib/supabase/client';
import { isRedirectError } from '@/lib/utils/redirect-error';
import { Settings, AlertTriangle, Camera, Loader2, RefreshCw } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function ClubSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const clubId = params.clubId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubDescription, setClubDescription] = useState('');
  const [clubRegion, setClubRegion] = useState('');
  const [clubMainCourt, setClubMainCourt] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // Load existing club data
  const loadClubData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const supabase = createClient();
      const { data: club } = await supabase
        .from('clubs')
        .select('name, description, region, main_court, logo_url')
        .eq('id', clubId)
        .maybeSingle();

      if (club) {
        setClubName(club.name || '');
        setClubDescription(club.description || '');
        setClubRegion(club.region || '');
        setClubMainCourt(club.main_court || '');
        setLogoUrl(club.logo_url || null);
      } else {
        setLoadFailed(true);
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadClubData();
  }, [loadClubData]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다');
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
      toast.error('로고 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    setSaveError('');
    try {
      await updateClub(clubId, formData);
    } catch (e) {
      // redirect() 신호는 다시 던져 Next가 페이지 이동을 처리하게 한다
      if (isRedirectError(e)) throw e;
      setSaveError(e instanceof Error ? e.message : '클럽 정보 수정에 실패했습니다');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmName !== clubName) {
      toast.error('클럽 이름이 일치하지 않습니다');
      return;
    }
    setDeleting(true);
    try {
      await deleteClub(clubId);
    } catch (e) {
      // onClick 핸들러는 transition 밖이라 redirect()를 Next가 처리하지 못함 → 직접 이동
      if (isRedirectError(e)) {
        toast.success('클럽이 삭제되었습니다');
        router.replace('/clubs');
        return;
      }
      toast.error(e instanceof Error ? e.message : '클럽 삭제에 실패했습니다');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title="클럽 설정" backHref={`/clubs/${clubId}`} />
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
        </div>
      </>
    );
  }

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
              defaultValue={clubName}
              key={`name-${clubName}`}
              onChange={(e) => setClubName(e.target.value)}
            />
            <Input
              id="description"
              name="description"
              label="클럽 소개"
              defaultValue={clubDescription}
              key={`desc-${clubDescription}`}
            />
            <RegionPicker
              value={clubRegion}
              onChange={setClubRegion}
              name="region"
            />
            <Input
              id="main_court"
              name="main_court"
              label="주요 활동 테니스장"
              defaultValue={clubMainCourt}
              key={`court-${clubMainCourt}`}
            />
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            {loadFailed && (
              <p className="text-sm text-warning">클럽 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.</p>
            )}
            <div className="pt-4">
              <Button type="submit" fullWidth size="lg" loading={saving} disabled={loadFailed}>
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
          <Button variant="destructive" fullWidth onClick={() => setShowDeleteModal(true)}>
            클럽 삭제
          </Button>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="클럽 삭제 확인">
        <p className="text-sm text-muted-foreground mb-4">
          이 작업은 되돌릴 수 없습니다. 삭제를 확인하려면 클럽 이름을 정확히 입력해주세요.
        </p>
        <p className="text-sm font-semibold text-foreground mb-3">
          클럽 이름: <span className="text-destructive">{clubName}</span>
        </p>
        <Input
          id="delete_confirm"
          label="클럽 이름 입력"
          placeholder={clubName}
          value={deleteConfirmName}
          onChange={(e) => setDeleteConfirmName(e.target.value)}
        />
        <div className="flex gap-3 mt-5">
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmName('');
            }}
            fullWidth
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || deleteConfirmName !== clubName}
            loading={deleting}
            fullWidth
          >
            {deleting ? '삭제 중...' : '삭제하기'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
