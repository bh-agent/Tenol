import type { ClubRole } from '@/types';

export type ClubPermission =
  | 'club.edit'           // 클럽 소개 변경
  | 'member.manage'       // 멤버 제명/수락
  | 'match.create'        // 게임 생성
  | 'draw.manage'         // 대진표 작성
  | 'result.input'        // 경기 결과 입력
  | 'media.upload'        // 미디어 업로드
  | 'guest.manage';       // 게스트 관리

/** @deprecated Use ClubPermission instead */
export type Permission = ClubPermission;

/** 역할별 기본 권한 */
const defaultPermissions: Record<string, ClubPermission[]> = {
  owner: ['club.edit', 'member.manage', 'match.create', 'draw.manage', 'result.input', 'media.upload', 'guest.manage'],
  admin: ['member.manage', 'match.create', 'draw.manage', 'result.input', 'media.upload', 'guest.manage'],
  member: ['match.create', 'draw.manage', 'result.input', 'media.upload'],
  guest: [],
};

// Backward-compatible alias
const ROLE_PERMISSIONS = defaultPermissions;

/**
 * 특정 역할이 해당 권한을 가지고 있는지 확인
 * role이 null이면 게스트(비회원)로 간주
 */
export function hasPermission(role: ClubRole | null | undefined, permission: ClubPermission): boolean {
  const effectiveRole = role || 'guest';
  return ROLE_PERMISSIONS[effectiveRole]?.includes(permission) ?? false;
}

/**
 * 역할의 모든 권한 목록 반환
 */
export function getPermissions(role: ClubRole | null | undefined): ClubPermission[] {
  const effectiveRole = role || 'guest';
  return ROLE_PERMISSIONS[effectiveRole] || [];
}

/**
 * 역할별 기본 권한 목록 반환
 */
export function getDefaultPermissions(): Record<string, ClubPermission[]> {
  return { ...defaultPermissions };
}

/**
 * 역할이 상위 역할인지 확인
 */
export function isHigherRole(role: ClubRole, targetRole: ClubRole): boolean {
  const hierarchy: Record<ClubRole, number> = { owner: 0, admin: 1, member: 2 };
  return hierarchy[role] < hierarchy[targetRole];
}

/**
 * 권한 이름 한국어 매핑
 */
export function getPermissionLabel(permission: ClubPermission): string {
  const labels: Record<ClubPermission, string> = {
    'club.edit': '클럽 소개 변경',
    'member.manage': '멤버 관리',
    'match.create': '게임 생성',
    'draw.manage': '대진표 작성',
    'result.input': '경기 결과 입력',
    'media.upload': '미디어 업로드',
    'guest.manage': '게스트 관리',
  };
  return labels[permission];
}

/**
 * 모든 권한 목록 반환
 */
export function getAllPermissions(): ClubPermission[] {
  return ['club.edit', 'member.manage', 'match.create', 'draw.manage', 'result.input', 'media.upload', 'guest.manage'];
}
