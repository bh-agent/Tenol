'use client';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { updateProfile, updateProfileAvatar } from '@/lib/actions/profile';
import { NTRP_LEVELS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { Settings, HelpCircle, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Profile } from '@/types';

const NTRP_GUIDE = [
  { level: '1.0~1.5', desc: '테니스를 처음 시작하거나 경험이 거의 없는 단계' },
  { level: '2.0', desc: '포핸드/백핸드 기초 스트로크 가능, 서브 넣기 시작' },
  { level: '2.5', desc: '랠리를 이어갈 수 있지만 일관성이 부족한 단계' },
  { level: '3.0', desc: '기본 스트로크에 방향성 생기고, 복식 기본 포지션 이해' },
  { level: '3.5', desc: '중급 수준의 샷 일관성, 다양한 스핀 시도 가능' },
  { level: '4.0', desc: '안정적인 스트로크와 전략적 플레이, 발리/서브 안정적' },
  { level: '4.5', desc: '파워와 컨트롤을 겸비, 다양한 전술 구사 가능' },
  { level: '5.0', desc: '고급 기술 보유, 시합 경험 풍부, 강한 무기 보유' },
  { level: '5.5~6.0', desc: '선수급 수준, 지역/전국 대회 입상 실력' },
  { level: '6.5~7.0', desc: '프로 및 국가대표급 선수' },
];

// 년월 옵션 생성
function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: { value: string; label: string }[] = [];
  for (let y = currentYear; y >= 1970; y--) {
    years.push({ value: String(y), label: `${y}년` });
  }
  return years;
}

function generateMonthOptions() {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: `${i + 1}월`,
  }));
}

interface ProfileEditButtonProps {
  profile: Profile;
}

export function ProfileEditButton({ profile }: ProfileEditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNtrpGuide, setShowNtrpGuide] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 기존 tennis_start_date에서 년/월 파싱 ("2023-05-01" → year: "2023", month: "05")
  const existingYear = profile.tennis_start_date?.substring(0, 4) || '';
  const existingMonth = profile.tennis_start_date?.substring(5, 7) || '';

  const [startYear, setStartYear] = useState(existingYear);
  const [startMonth, setStartMonth] = useState(existingMonth);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      alert('이미지 파일(JPEG, PNG, GIF, WebP)만 업로드 가능합니다');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('5MB 이하의 이미지만 가능합니다');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const fileExt = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
      const fileName = `avatars/${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('club-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('club-media')
        .getPublicUrl(fileName);

      await updateProfileAvatar(urlData.publicUrl);
      setAvatarPreview(urlData.publicUrl);
      router.refresh();
    } catch {
      alert('프로필 사진 업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    // 년월을 합쳐서 전달
    if (startYear && startMonth) {
      formData.set('tennis_start_date', `${startYear}-${startMonth}`);
    } else {
      formData.set('tennis_start_date', '');
    }

    await updateProfile(formData);
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
      >
        <Settings className="w-5 h-5 text-foreground" />
      </button>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="프로필 수정">
        <div className="space-y-5">
          {/* Avatar Change */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-full">
                <Avatar
                  src={avatarPreview || profile.avatar_url}
                  alt={profile.display_name}
                  fallback={profile.display_name}
                  size="xl"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
              >
                <Camera className="w-4 h-4 text-black" />
              </button>
            </div>
            {uploading && (
              <p className="text-xs text-muted-foreground mt-2">업로드 중...</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-4">
            <Input
              id="display_name"
              name="display_name"
              label="닉네임"
              defaultValue={profile.display_name}
              required
            />
            <Input
              id="bio"
              name="bio"
              label="자기소개"
              defaultValue={profile.bio || ''}
              placeholder="한 줄로 나를 소개해보세요"
            />

            {/* NTRP with help button */}
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <label className="text-sm font-medium text-foreground">NTRP 레벨</label>
                <button
                  type="button"
                  onClick={() => setShowNtrpGuide(true)}
                  className="p-0.5 rounded-full hover:bg-surface-elevated transition-colors"
                >
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <Select
                id="ntrp_level"
                name="ntrp_level"
                options={NTRP_LEVELS.map((l) => ({ ...l }))}
                defaultValue={profile.ntrp_level?.toString() || ''}
                placeholder="선택해주세요"
              />
            </div>

            {/* Tennis Start - Year & Month */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                테니스 시작 시기
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  id="start_year"
                  options={generateYearOptions()}
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  placeholder="년도"
                />
                <Select
                  id="start_month"
                  options={generateMonthOptions()}
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  placeholder="월"
                />
              </div>
            </div>

            <Button type="submit" fullWidth>
              저장
            </Button>
          </form>
        </div>
      </Modal>

      {/* NTRP Guide Modal */}
      <Modal isOpen={showNtrpGuide} onClose={() => setShowNtrpGuide(false)} title="NTRP 기준표">
        <p className="text-xs text-muted-foreground mb-4">
          NTRP(National Tennis Rating Program)는 테니스 실력을 1.0~7.0으로 나타내는 국제 기준입니다.
        </p>
        <div className="space-y-3">
          {NTRP_GUIDE.map((item) => (
            <div key={item.level} className="flex gap-3">
              <span className="text-sm font-bold text-primary whitespace-nowrap min-w-[70px]">
                {item.level}
              </span>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          fullWidth
          className="mt-4"
          onClick={() => setShowNtrpGuide(false)}
        >
          닫기
        </Button>
      </Modal>
    </>
  );
}
