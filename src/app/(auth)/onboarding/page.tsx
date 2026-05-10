'use client';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RegionPicker } from '@/components/ui/region-picker';
import { completeOnboarding, uploadOnboardingAvatar } from '@/lib/actions/profile';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Camera, ChevronLeft, ChevronRight, MapPin, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const NTRP_OPTIONS = [
  { value: '1.0', label: '1.0 - 입문' },
  { value: '1.5', label: '1.5 - 초보' },
  { value: '2.0', label: '2.0 - 초급' },
  { value: '2.5', label: '2.5 - 초중급' },
  { value: '3.0', label: '3.0 - 중급' },
  { value: '3.5', label: '3.5 - 중상급' },
  { value: '4.0', label: '4.0 - 상급' },
  { value: '4.5', label: '4.5 - 고급' },
  { value: '5.0', label: '5.0 - 프로급' },
];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Identity
  const [displayName, setDisplayName] = useState('');
  const [realName, setRealName] = useState('');
  const [gender, setGender] = useState<string>('');

  // Apple 로그인 시 이름 자동 채우기
  useEffect(() => {
    const prefill = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata;
      if (meta?.full_name && !displayName) setDisplayName(meta.full_name);
      else if (meta?.name && !displayName) setDisplayName(meta.name);
      if (meta?.avatar_url && !avatarUrl) setAvatarUrl(meta.avatar_url);
    };
    prefill();
  }, []);

  // Step 2: Tennis info
  const [region, setRegion] = useState('');
  const [ntrp, setNtrp] = useState('');

  // Step 3: Profile
  const [bio, setBio] = useState('');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하의 이미지만 가능합니다');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증 필요');

      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('club-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from('club-media')
        .getPublicUrl(fileName);

      await uploadOnboardingAvatar(urlData.publicUrl);
      setAvatarUrl(urlData.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!displayName.trim()) {
        setError('닉네임을 입력해주세요');
        return;
      }
      if (!realName.trim()) {
        setError('실명을 입력해주세요');
        return;
      }
      if (!gender) {
        setError('성별을 선택해주세요');
        return;
      }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.set('display_name', displayName);
      formData.set('real_name', realName);
      formData.set('gender', gender);
      formData.set('region', region);
      formData.set('bio', bio);
      formData.set('ntrp_level', ntrp);
      await completeOnboarding(formData);
      router.push('/clubs');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background:
            'radial-gradient(circle, rgba(0,230,118,0.3) 0%, transparent 70%)',
        }}
      />

      {/* Welcome message */}
      <div className="relative z-10 px-6 pt-10 pb-1 text-center">
        <h2 className="text-lg font-bold text-gradient">테놀에 오신 것을 환영합니다!</h2>
      </div>

      {/* Progress */}
      <div className="relative z-10 px-6 pt-4 pb-4">
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i + 1 === step
                  ? 'w-8 bg-primary'
                  : i + 1 < step
                    ? 'w-4 bg-primary/40'
                    : 'w-4 bg-border'
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mb-1">
          {step} / {TOTAL_STEPS}
        </p>
      </div>

      {/* Content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-6">
        <div className="w-full max-w-sm">
          {/* ── Step 1: Identity (필수) ── */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-foreground mb-1 text-center">
                반가워요! <span className="text-gradient">테놀</span>에 오신 걸 환영해요
              </h1>
              <p className="text-muted-foreground text-sm mb-8 text-center">
                기본 정보를 알려주세요
              </p>

              <div className="space-y-5 stagger">
                <Input
                  id="display_name"
                  name="display_name"
                  label="닉네임"
                  placeholder="테놀에서 사용할 이름"
                  required
                  autoFocus
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-surface border-border focus:border-primary"
                />

                <div>
                  <Input
                    id="real_name"
                    name="real_name"
                    label="실명"
                    placeholder="대진표에 표시될 이름"
                    required
                    value={realName}
                    onChange={(e) => setRealName(e.target.value)}
                    className="bg-surface border-border focus:border-primary"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    대진표에서 실명(닉네임) 형태로 표시됩니다
                  </p>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    성별 <span className="text-destructive">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('M')}
                      className={cn(
                        'h-12 rounded-xl border text-sm font-medium transition-all duration-200',
                        gender === 'M'
                          ? 'border-primary bg-primary/10 text-primary glow-primary-sm'
                          : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      남성
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('F')}
                      className={cn(
                        'h-12 rounded-xl border text-sm font-medium transition-all duration-200',
                        gender === 'F'
                          ? 'border-primary bg-primary/10 text-primary glow-primary-sm'
                          : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      )}
                    >
                      여성
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Tennis Info (선택) ── */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-foreground mb-1 text-center">
                테니스 정보를 알려주세요
              </h1>
              <p className="text-muted-foreground text-sm mb-8 text-center">
                클럽 탐색과 매칭에 활용됩니다
              </p>

              <div className="space-y-6 stagger">
                {/* Region */}
                <RegionPicker
                  value={region}
                  onChange={setRegion}
                  label="활동 지역"
                  placeholder="주로 테니스를 치는 지역"
                />

                {/* NTRP */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    NTRP 레벨
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {NTRP_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setNtrp(option.value)}
                        className={cn(
                          'h-12 rounded-xl border text-sm font-medium transition-all duration-200',
                          ntrp === option.value
                            ? 'border-primary bg-primary/10 text-primary glow-primary-sm'
                            : 'border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        )}
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                  {ntrp && (
                    <p className="mt-2 text-xs text-primary/80 text-center animate-fade-in">
                      {NTRP_OPTIONS.find((o) => o.value === ntrp)?.label}
                    </p>
                  )}
                </div>

                {/* NTRP guide */}
                <div className="rounded-xl bg-surface-elevated/50 border border-border p-3 space-y-1.5">
                  <p className="text-xs font-medium text-foreground mb-1">레벨 가이드</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <p className="text-[11px] text-muted-foreground"><span className="text-primary font-medium">1.0-2.0</span> 입문자</p>
                    <p className="text-[11px] text-muted-foreground"><span className="text-primary font-medium">2.5-3.0</span> 초급</p>
                    <p className="text-[11px] text-muted-foreground"><span className="text-primary font-medium">3.5-4.0</span> 중급</p>
                    <p className="text-[11px] text-muted-foreground"><span className="text-primary font-medium">4.5-5.0</span> 상급</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Profile (선택) ── */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-foreground mb-1 text-center">
                프로필을 꾸며보세요
              </h1>
              <p className="text-muted-foreground text-sm mb-8 text-center">
                사진과 자기소개를 추가해주세요
              </p>

              <div className="space-y-6 stagger">
                {/* Avatar */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                      'relative w-28 h-28 rounded-full flex items-center justify-center',
                      'border-2 border-dashed transition-all duration-200',
                      avatarUrl
                        ? 'border-primary/40'
                        : 'border-primary/30 hover:border-primary/60 bg-surface'
                    )}
                  >
                    {avatarUrl ? (
                      <Avatar src={avatarUrl} alt="프로필" fallback="?" size="xl" className="w-full h-full" />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <Camera className="w-7 h-7 text-primary/60" />
                        <span className="text-xs text-muted-foreground">사진 추가</span>
                      </div>
                    )}
                    {avatarUrl && (
                      <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <Camera className="w-4 h-4 text-black" />
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  {uploading && (
                    <p className="text-xs text-primary mt-3 animate-pulse">업로드 중...</p>
                  )}
                  <p className="text-xs text-subtle mt-2">선택사항 - 나중에 추가할 수 있어요</p>
                </div>

                <Input
                  id="bio"
                  name="bio"
                  label="자기소개 (선택)"
                  placeholder="한 줄로 나를 소개해보세요"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-surface border-border focus:border-primary"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-sm text-destructive text-center animate-fade-in">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Bottom action area */}
      <div className="relative z-10 px-6 pb-10 pt-6 w-full max-w-sm mx-auto">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleBack}
              className="w-14 px-0 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              size="lg"
              fullWidth
              onClick={handleNext}
              className="glow-primary"
            >
              {step === 1 ? '다음' : '다음'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              fullWidth
              loading={submitting}
              onClick={handleSubmit}
              className="glow-primary"
            >
              시작하기
            </Button>
          )}
        </div>

        {/* 건너뛰기 (Step 2, 3만) */}
        {step >= 2 && (
          <button
            type="button"
            onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
            disabled={submitting}
            className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            건너뛰기
          </button>
        )}

        <p className="mt-4 text-xs text-subtle text-center">
          프로필은 나중에 언제든 수정할 수 있어요
        </p>
      </div>
    </div>
  );
}
