'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { updateProfile, updateProfileAvatar } from '@/lib/actions/profile';
import { NTRP_LEVELS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Camera, Pencil, HelpCircle, Calendar } from 'lucide-react';
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

function formatTennisCareer(startDate: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (totalMonths < 1) return '시작한 지 얼마 안 됨';
  if (totalMonths < 12) return `구력 ${totalMonths}개월`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `구력 ${y}년 ${m}개월` : `구력 ${y}년`;
}

interface ProfileHeaderProps {
  profile: Profile;
}

export function ProfileHeader({ profile: initialProfile }: ProfileHeaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState(initialProfile);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNtrpGuide, setShowNtrpGuide] = useState(false);
  const [editGender, setEditGender] = useState<string>(profile.gender || '');

  const existingYear = profile.tennis_start_date?.substring(0, 4) || '';
  const existingMonth = profile.tennis_start_date?.substring(5, 7) || '';
  const [startYear, setStartYear] = useState(existingYear);
  const [startMonth, setStartMonth] = useState(existingMonth);

  // 프로필 사진 변경
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('5MB 이하의 이미지만 가능합니다');
      return;
    }

    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${profile.id}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('club-media')
        .upload(fileName, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('club-media')
        .getPublicUrl(fileName);

      await updateProfileAvatar(urlData.publicUrl);
      setProfile((p) => ({ ...p, avatar_url: urlData.publicUrl }));
      router.refresh();
    } catch {
      alert('프로필 사진 업로드에 실패했습니다');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 프로필 정보 저장
  const handleSubmit = async (formData: FormData) => {
    if (startYear && startMonth) {
      formData.set('tennis_start_date', `${startYear}-${startMonth}`);
    } else {
      formData.set('tennis_start_date', '');
    }
    if (editGender) {
      formData.set('gender', editGender);
    }
    await updateProfile(formData);
    setProfile((p) => ({ ...p, gender: (editGender as 'M' | 'F') || p.gender }));
    setShowEdit(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-col items-center text-center">
        {/* 프로필 사진 + 카메라 버튼 */}
        <div className="relative">
          <div className="ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-full">
            <Avatar
              src={profile.avatar_url}
              alt={profile.display_name}
              fallback={profile.display_name}
              size="xl"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
          >
            <Camera className="w-4 h-4 text-black" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        {avatarUploading && (
          <p className="text-xs text-muted-foreground mt-1">업로드 중...</p>
        )}

        {/* 실명 + 닉네임 + 수정 버튼 */}
        <p className="text-xs text-muted-foreground mt-3">
          {profile.real_name || '익명'}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <h2 className="text-xl font-bold text-foreground">{profile.display_name}</h2>
          <button
            onClick={() => setShowEdit(true)}
            className="p-1 rounded-full hover:bg-surface-elevated transition-colors"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {profile.bio && (
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{profile.bio}</p>
        )}

        {/* Info Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
          {profile.gender && (
            <Badge variant="outline">{profile.gender === 'M' ? '남성' : '여성'}</Badge>
          )}
          {profile.ntrp_level && (
            <Badge variant="primary">NTRP {profile.ntrp_level}</Badge>
          )}
          {profile.tennis_start_date && (
            <Badge variant="outline">
              <Calendar className="w-3 h-3 mr-1" />
              {formatTennisCareer(profile.tennis_start_date)}
            </Badge>
          )}
          {!profile.ntrp_level && !profile.tennis_start_date && (
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              + 상세 정보 입력하기
            </button>
          )}
        </div>
      </div>

      {/* 프로필 수정 모달 */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="프로필 수정">
        <form action={handleSubmit} className="space-y-4">
          <Input
            id="display_name"
            name="display_name"
            label="닉네임"
            defaultValue={profile.display_name}
            required
          />
          <div>
            <Input
              id="real_name"
              name="real_name"
              label="실명"
              defaultValue={profile.real_name || ''}
              placeholder="실명을 입력해주세요"
            />
            <p className="text-xs text-muted-foreground mt-1">
              대진표에서 실명(닉네임) 형태로 표시됩니다
            </p>
          </div>
          <Input
            id="bio"
            name="bio"
            label="자기소개"
            defaultValue={profile.bio || ''}
            placeholder="한 줄로 나를 소개해보세요"
          />

          {/* Gender Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              성별
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditGender('M')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200',
                  editGender === 'M'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setEditGender('F')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200',
                  editGender === 'F'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                여성
              </button>
            </div>
          </div>

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
      </Modal>

      {/* NTRP 기준표 모달 */}
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
        <Button variant="secondary" fullWidth className="mt-4" onClick={() => setShowNtrpGuide(false)}>
          닫기
        </Button>
      </Modal>
    </>
  );
}
