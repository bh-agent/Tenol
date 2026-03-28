'use client';

import { HeadToHead } from '@/components/stats/head-to-head';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import type { HeadToHeadResult } from '@/lib/queries/h2h';
import { useCallback, useState, useTransition } from 'react';

type PlayerOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

interface H2HSelectorProps {
  players: PlayerOption[];
  clubId: string;
  currentUserId?: string;
}

export function H2HSelector({ players, clubId, currentUserId }: H2HSelectorProps) {
  const [player1Id, setPlayer1Id] = useState(currentUserId || '');
  const [player2Id, setPlayer2Id] = useState('');
  const [result, setResult] = useState<HeadToHeadResult | null>(null);
  const [noMatches, setNoMatches] = useState(false);
  const [isPending, startTransition] = useTransition();

  const player1 = players.find((p) => p.id === player1Id);
  const player2 = players.find((p) => p.id === player2Id);

  const fetchH2H = useCallback(
    async (p1Id: string, p2Id: string) => {
      if (!p1Id || !p2Id || p1Id === p2Id) {
        setResult(null);
        setNoMatches(false);
        return;
      }

      startTransition(async () => {
        try {
          const res = await fetch(
            `/api/clubs/${clubId}/h2h?player1=${p1Id}&player2=${p2Id}`
          );
          if (!res.ok) throw new Error('Failed to fetch');
          const data: HeadToHeadResult = await res.json();
          if (data.totalGames === 0) {
            setResult(null);
            setNoMatches(true);
          } else {
            setResult(data);
            setNoMatches(false);
          }
        } catch {
          setResult(null);
          setNoMatches(false);
        }
      });
    },
    [clubId]
  );

  const handlePlayer1Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setPlayer1Id(newId);
    fetchH2H(newId, player2Id);
  };

  const handlePlayer2Change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setPlayer2Id(newId);
    fetchH2H(player1Id, newId);
  };

  const playerOptions = players.map((p) => ({
    value: p.id,
    label: p.displayName,
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Select
          options={playerOptions}
          value={player1Id}
          onChange={handlePlayer1Change}
          placeholder="선수 1 선택"
        />
        <Select
          options={playerOptions}
          value={player2Id}
          onChange={handlePlayer2Change}
          placeholder="선수 2 선택"
        />
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {!isPending && result && player1 && player2 && (
        <HeadToHead player1={player1} player2={player2} result={result} />
      )}

      {!isPending && noMatches && player1Id && player2Id && player1Id !== player2Id && (
        <Card variant="glass" padding="lg" className="text-center">
          <p className="text-lg mb-1">🎾</p>
          <p className="text-sm text-muted-foreground">
            아직 같이 경기한 적 없어요
          </p>
        </Card>
      )}

      {!isPending && player1Id && player2Id && player1Id === player2Id && (
        <Card variant="glass" padding="lg" className="text-center">
          <p className="text-sm text-muted-foreground">
            다른 선수를 선택해주세요
          </p>
        </Card>
      )}
    </div>
  );
}
