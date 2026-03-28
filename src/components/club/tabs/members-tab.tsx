'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MemberAchievementBadges } from '@/components/stats/achievement-badges';
import { formatRole } from '@/lib/utils/format';
import { MemberManageActions } from '@/components/club/member-manage-actions';
import type { ClubRole } from '@/types';
import type { Achievement } from '@/lib/queries/achievements';
import { Crown, Shield } from 'lucide-react';
import Link from 'next/link';

interface MembersTabProps {
  clubId: string;
  members: any[];
  myRole: ClubRole | null;
  canManageMembers: boolean;
  /** Map of user_id -> their achievements in this club */
  achievementsByUser?: Record<string, Achievement[]>;
}

export function MembersTab({ clubId, members, myRole, canManageMembers, achievementsByUser = {} }: MembersTabProps) {
  const rolePriority = { owner: 0, admin: 1, member: 2 };
  const sorted = [...members].sort(
    (a: any, b: any) =>
      (rolePriority[a.role as keyof typeof rolePriority] ?? 2) -
      (rolePriority[b.role as keyof typeof rolePriority] ?? 2)
  );

  const formatJoinDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const roleVariant = (role: string): 'primary' | 'success' | 'default' => {
    if (role === 'owner') return 'primary';
    if (role === 'admin') return 'success';
    return 'default';
  };

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground mb-3">총 {members.length}명</p>

      <div className="stagger">
        {sorted.map((member: any) => (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-elevated transition-colors"
          >
            <Link href={`/profile/${member.profiles?.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar
                src={member.profiles?.avatar_url}
                alt={member.profiles?.display_name}
                fallback={member.profiles?.display_name}
                size="lg"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground truncate hover:text-primary transition-colors">
                    {member.profiles?.display_name}
                  </span>
                  {member.profiles?.id && achievementsByUser[member.profiles.id]?.length > 0 && (
                    <MemberAchievementBadges
                      achievements={achievementsByUser[member.profiles.id]}
                    />
                  )}
                  <Badge variant={roleVariant(member.role)}>
                    <span className="flex items-center gap-1">
                      {member.role === 'owner' && <Crown className="w-3 h-3 text-yellow-500" />}
                      {member.role === 'admin' && <Shield className="w-3 h-3 text-emerald-500" />}
                      {formatRole(member.role)}
                    </span>
                  </Badge>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  {member.profiles?.ntrp_level && (
                    <span className="text-xs text-primary font-medium">
                      NTRP {member.profiles.ntrp_level}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatJoinDate(member.joined_at)} 가입
                  </span>
                </div>
              </div>
            </Link>

            {/* 관리 버튼 - 회장/운영진만, 회장은 대상 제외 */}
            {canManageMembers && member.role !== 'owner' && (
              <MemberManageActions
                clubId={clubId}
                targetUserId={member.profiles?.id}
                currentRole={member.role}
                myRole={myRole!}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
