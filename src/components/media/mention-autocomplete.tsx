'use client';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type MentionSource = 'recent_match' | 'following' | 'club_member' | 'search';

interface MentionUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
  source: MentionSource;
}

interface MentionAutocompleteProps {
  query: string;
  clubId?: string;
  isOpen: boolean;
  onSelect: (user: { id: string; display_name: string }) => void;
  onClose: () => void;
  position?: 'above' | 'below';
}

const SOURCE_LABELS: Record<MentionSource, { text: string; className: string }> = {
  recent_match: {
    text: '최근 경기',
    className: 'bg-emerald-500/15 text-emerald-400',
  },
  following: {
    text: '팔로잉',
    className: 'bg-blue-500/15 text-blue-400',
  },
  club_member: {
    text: '클럽 멤버',
    className: 'bg-white/[0.08] text-[#999]',
  },
  search: {
    text: '검색',
    className: 'bg-white/[0.08] text-[#999]',
  },
};

export function MentionAutocomplete({
  query,
  clubId,
  isOpen,
  onSelect,
  onClose,
  position = 'above',
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch suggestions
  useEffect(() => {
    if (!isOpen) {
      setUsers([]);
      setSelectedIndex(0);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (clubId) params.set('clubId', clubId);

        const res = await fetch(`/api/mentions?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users ?? []);
          setSelectedIndex(0);
        }
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, query ? 200 : 0); // Instant for empty query, debounced for typed queries

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, query, clubId]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || users.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = users[selectedIndex];
        if (selected) {
          onSelect({ id: selected.id, display_name: selected.display_name });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, users, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    const item = items[selectedIndex] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-50',
        'bg-[#141414] border border-white/[0.08] rounded-xl shadow-xl',
        'max-h-[280px] overflow-hidden',
        'animate-fade-in',
        position === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      )}
    >
      <div ref={listRef} className="overflow-y-auto max-h-[280px] overscroll-contain">
        {loading && users.length === 0 ? (
          // Loading skeleton
          <div className="p-2 space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-white/[0.06] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-white/[0.06] rounded" />
                </div>
                <div className="h-4 w-14 bg-white/[0.06] rounded-full" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center py-6 px-4">
            {loading ? (
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            ) : (
              <span className="text-sm text-white/40">
                일치하는 사용자가 없어요
              </span>
            )}
          </div>
        ) : (
          // Results
          <div className="p-1">
            {users.map((user, index) => {
              const sourceLabel = SOURCE_LABELS[user.source];
              return (
                <button
                  key={user.id}
                  type="button"
                  onMouseDown={(e) => {
                    // Use mouseDown instead of click to fire before blur
                    e.preventDefault();
                    onSelect({ id: user.id, display_name: user.display_name });
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg',
                    'text-left transition-colors duration-100',
                    'min-h-[44px]', // Touch-friendly
                    index === selectedIndex
                      ? 'bg-[#1C1C1C]'
                      : 'hover:bg-[#1C1C1C]'
                  )}
                >
                  <Avatar
                    src={user.avatar_url}
                    alt={user.display_name}
                    fallback={user.display_name}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white font-medium truncate block">
                      {user.display_name}
                    </span>
                    {user.ntrp_level != null && (
                      <span className="text-[11px] text-white/40">
                        NTRP {user.ntrp_level}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                      sourceLabel.className
                    )}
                  >
                    {sourceLabel.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
