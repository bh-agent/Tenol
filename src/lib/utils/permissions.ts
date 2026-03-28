import type { ClubRole } from '@/types';

export type Permission =
  | 'club.edit'           // 클럽 소개 변경
  | 'member.manage'       // 멤버 제명/수락
  | 'match.create'        // 게임 생성
  | 'draw.manage'         // 대진표 작성
  | 'result.input';       // 경기 결과 입력

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: ['club.edit', 'member.manage', 'match.create', 'draw.manage', 'result.input'],
  admin: ['member.manage', 'match.create', 'draw.manage', 'result.input'],
  member: ['match.create', 'draw.manage', 'result.input'],
  guest: [],
};

/**
 * 특정 역할이 해당 권한을 가지고 있는지 확인
 * role이 null이면 게스트(비회원)로 간주
 */
export function hasPermission(role: ClubRole | null | undefined, permission: Permission): boolean {
  const effectiveRole = role || 'guest';
  return ROLE_PERMISSIONS[effectiveRole]?.includes(permission) ?? false;
}

/**
 * 역할의 모든 권한 목록 반환
 */
export function getPermissions(role: ClubRole | null | undefined): Permission[] {
  const effectiveRole = role || 'guest';
  return ROLE_PERMISSIONS[effectiveRole] || [];
}

/**
 * 권한 이름 한국어 매핑
 */
export function getPermissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    'club.edit': '클럽 소개 변경',
    'member.manage': '멤버 관리',
    'match.create': '게임 생성',
    'draw.manage': '대진표 작성',
    'result.input': '경기 결과 입력',
  };
  return labels[permission];
}
