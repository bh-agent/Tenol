export const APP_NAME = '테놀';
export const APP_DESCRIPTION = '테니스 치며 놀자! 테니스 클럽 운영 앱';

export const NTRP_LEVELS = [
  { value: '1.0', label: '1.0 - 입문' },
  { value: '1.5', label: '1.5' },
  { value: '2.0', label: '2.0 - 초급' },
  { value: '2.5', label: '2.5' },
  { value: '3.0', label: '3.0 - 중하급' },
  { value: '3.5', label: '3.5' },
  { value: '4.0', label: '4.0 - 중급' },
  { value: '4.5', label: '4.5' },
  { value: '5.0', label: '5.0 - 중상급' },
  { value: '5.5', label: '5.5' },
  { value: '6.0', label: '6.0 - 상급' },
  { value: '6.5', label: '6.5' },
  { value: '7.0', label: '7.0 - 프로' },
] as const;

export const MATCH_FORMATS = [
  { value: 'doubles', label: '복식' },
  { value: 'singles', label: '단식' },
  { value: 'mixed_doubles', label: '혼합 복식' },
] as const;

export const DRAW_TYPES = [
  { value: 'random', label: '랜덤' },
  { value: 'ntrp_balanced', label: 'NTRP 밸런스' },
  { value: 'mixed_gender', label: '혼성' },
  { value: 'manual', label: '수동' },
] as const;

export const NEW_DRAW_TYPES = [
  { value: 'mixed_doubles', label: '혼복 (남녀 1명씩)' },
  { value: 'mens_doubles', label: '남복 (남성 복식)' },
  { value: 'womens_doubles', label: '여복 (여성 복식)' },
  { value: 'free', label: '성별 무관' },
] as const;
