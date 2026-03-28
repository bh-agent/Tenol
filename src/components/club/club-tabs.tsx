'use client';

import { cn } from '@/lib/utils/cn';
import { Camera, Swords, Users } from 'lucide-react';
import { useState } from 'react';
import { FeedTab } from './tabs/feed-tab';
import { MatchesTab } from './tabs/matches-tab';
import { MembersTab } from './tabs/members-tab';
import type { ClubRole } from '@/types';

interface ClubTabsProps {
  clubId: string;
  matches: any[];
  members: any[];
  media: any[];
  myRole: ClubRole | null;
  canCreateMatch: boolean;
  canManageMembers: boolean;
}

const tabs = [
  { key: 'feed', label: '사진', icon: Camera },
  { key: 'matches', label: '경기', icon: Swords },
  { key: 'members', label: '멤버', icon: Users },
] as const;

export function ClubTabs({
  clubId,
  matches,
  members,
  media,
  myRole,
  canCreateMatch,
  canManageMembers,
}: ClubTabsProps) {
  const [activeTab, setActiveTab] = useState<string>('feed');

  // 게스트(myRole === null)는 업로드 불가
  const canUpload = myRole !== null;

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex border-b border-border sticky top-14 bg-background/95 backdrop-blur-sm z-20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 py-4">
        {activeTab === 'feed' && (
          <FeedTab clubId={clubId} media={media} canUpload={canUpload} />
        )}
        {activeTab === 'matches' && (
          <MatchesTab clubId={clubId} matches={matches} canCreateMatch={canCreateMatch} />
        )}
        {activeTab === 'members' && (
          <MembersTab
            clubId={clubId}
            members={members}
            myRole={myRole}
            canManageMembers={canManageMembers}
          />
        )}
      </div>
    </div>
  );
}
