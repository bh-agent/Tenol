import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  getPermissions,
  isHigherRole,
  getAllPermissions,
  getPermissionLabel,
  type ClubPermission,
} from './permissions';

// RBAC 권한 해석은 보안의 핵심이다. 역할별 권한 경계가 의도치 않게
// 바뀌면(특히 member가 관리 권한을 얻으면) 심각한 권한 상승 버그가 된다.

describe('hasPermission — 역할 경계', () => {
  it('owner는 모든 권한을 가진다', () => {
    for (const p of getAllPermissions()) {
      expect(hasPermission('owner', p)).toBe(true);
    }
  });

  it('admin은 club.edit을 제외한 모든 권한을 가진다', () => {
    expect(hasPermission('admin', 'club.edit')).toBe(false);
    for (const p of getAllPermissions().filter((x) => x !== 'club.edit')) {
      expect(hasPermission('admin', p)).toBe(true);
    }
  });

  it('member는 운영 권한(멤버/게스트 관리, 클럽 수정)을 가지지 않는다', () => {
    const forbidden: ClubPermission[] = ['club.edit', 'member.manage', 'guest.manage'];
    for (const p of forbidden) {
      expect(hasPermission('member', p)).toBe(false);
    }
    // 일반 멤버가 가져야 하는 권한
    const allowed: ClubPermission[] = ['match.create', 'draw.manage', 'result.input', 'media.upload'];
    for (const p of allowed) {
      expect(hasPermission('member', p)).toBe(true);
    }
  });

  it('비회원(null/undefined)은 어떤 권한도 가지지 않는다', () => {
    for (const role of [null, undefined] as const) {
      for (const p of getAllPermissions()) {
        expect(hasPermission(role, p)).toBe(false);
      }
    }
  });
});

describe('getPermissions', () => {
  it('역할별 권한 수가 위계와 일치한다 (owner > admin > member > guest)', () => {
    const owner = getPermissions('owner').length;
    const admin = getPermissions('admin').length;
    const member = getPermissions('member').length;
    const guest = getPermissions(null).length;
    expect(owner).toBeGreaterThan(admin);
    expect(admin).toBeGreaterThan(member);
    expect(member).toBeGreaterThan(guest);
    expect(guest).toBe(0);
  });
});

describe('isHigherRole', () => {
  it('owner가 admin·member보다 상위다', () => {
    expect(isHigherRole('owner', 'admin')).toBe(true);
    expect(isHigherRole('owner', 'member')).toBe(true);
  });
  it('admin이 member보다 상위다', () => {
    expect(isHigherRole('admin', 'member')).toBe(true);
  });
  it('하위 역할은 상위 역할보다 높지 않다', () => {
    expect(isHigherRole('member', 'owner')).toBe(false);
    expect(isHigherRole('admin', 'owner')).toBe(false);
    expect(isHigherRole('member', 'admin')).toBe(false);
  });
});

describe('getPermissionLabel / getAllPermissions 일관성', () => {
  it('모든 권한에 비어있지 않은 한국어 라벨이 있다', () => {
    for (const p of getAllPermissions()) {
      const label = getPermissionLabel(p);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('getAllPermissions에 중복이 없다', () => {
    const all = getAllPermissions();
    expect(new Set(all).size).toBe(all.length);
  });
});
