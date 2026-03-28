export const dynamic = 'force-dynamic';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { getClubMembers, getMyRole } from '@/lib/queries/clubs';
import { formatRole } from '@/lib/utils/format';
import { hasPermission } from '@/lib/utils/permissions';
import { Users, Crown, Shield } from 'lucide-react';
import { MemberManageActions } from '@/components/club/member-manage-actions';

export default async function MembersPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const [members, myRole] = await Promise.all([
    getClubMembers(clubId),
    getMyRole(clubId),
  ]);

  const canManageMembers = hasPermission(myRole, 'member.manage');

  const rolePriority = { owner: 0, admin: 1, member: 2 };
  const sorted = [...members].sort(
    (a: any, b: any) => (rolePriority[a.role as keyof typeof rolePriority] ?? 2) - (rolePriority[b.role as keyof typeof rolePriority] ?? 2)
  );

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-3 h-3" />;
    if (role === 'admin') return <Shield className="w-3 h-3" />;
    return null;
  };

  return (
    <>
      <TopBar title="멤버 목록" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">멤버 목록</h2>
            <p className="text-sm text-muted-foreground">{members.length}명의 멤버</p>
          </div>
        </div>

        {/* Member list */}
        <div className="space-y-2 stagger">
          {sorted.map((member: any) => (
            <Card
              key={member.id}
              padding="sm"
              className="hover:border-primary/25 transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  src={member.profiles?.avatar_url}
                  alt={member.profiles?.display_name}
                  fallback={member.profiles?.display_name}
                  size="md"
                  active={member.role === 'owner'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {member.profiles?.display_name}
                    </span>
                    <Badge
                      variant={member.role === 'owner' ? 'primary' : member.role === 'admin' ? 'success' : 'default'}
                    >
                      <span className="flex items-center gap-1">
                        {getRoleIcon(member.role)}
                        {formatRole(member.role)}
                      </span>
                    </Badge>
                  </div>
                  {member.profiles?.ntrp_level && (
                    <span className="text-xs text-muted-foreground">
                      NTRP <span className="text-primary font-medium">{member.profiles.ntrp_level}</span>
                    </span>
                  )}
                </div>

                {canManageMembers && member.role !== 'owner' && (
                  <MemberManageActions
                    clubId={clubId}
                    targetUserId={member.profiles?.id}
                    currentRole={member.role}
                    myRole={myRole!}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
