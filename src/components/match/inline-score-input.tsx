'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { submitScore } from '@/lib/actions/games';
import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

type GameData = {
  id: string;
  score_team_a: number | null;
  score_team_b: number | null;
};

interface InlineScoreInputProps {
  game: GameData;
  teamAName: string;
  teamBName: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function InlineScoreInput({
  game,
  teamAName,
  teamBName,
  onSaved,
  onCancel,
}: InlineScoreInputProps) {
  const [scoreA, setScoreA] = useState(game.score_team_a ?? 0);
  const [scoreB, setScoreB] = useState(game.score_team_b ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await submitScore(game.id, scoreA, scoreB);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '점수 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border/50 px-3 py-3 animate-fade-in">
      <div className="flex items-center gap-3">
        {/* Team A */}
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1.5 truncate">
            {teamAName}
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setScoreA(Math.max(0, scoreA - 1))}
              className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <span
              className={cn(
                'w-10 text-center text-xl font-bold tabular-nums',
                scoreA > scoreB ? 'text-primary' : 'text-foreground'
              )}
            >
              {scoreA}
            </span>
            <button
              onClick={() => setScoreA(scoreA + 1)}
              className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <span className="text-muted-foreground text-sm font-medium mt-4">vs</span>

        {/* Team B */}
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1.5 truncate">
            {teamBName}
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setScoreB(Math.max(0, scoreB - 1))}
              className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
            >
              <Minus className="w-4 h-4 text-muted-foreground" />
            </button>
            <span
              className={cn(
                'w-10 text-center text-xl font-bold tabular-nums',
                scoreB > scoreA ? 'text-primary' : 'text-foreground'
              )}
            >
              {scoreB}
            </span>
            <button
              onClick={() => setScoreB(scoreB + 1)}
              className="w-11 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive text-center mt-2">{error}</p>
      )}

      <div className="flex gap-2 mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="flex-1"
        >
          취소
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          loading={saving}
          className="flex-1"
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
