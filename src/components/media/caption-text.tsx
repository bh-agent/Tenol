'use client';

import Link from 'next/link';
import { renderCaptionParts } from '@/lib/utils/mentions';

interface CaptionTextProps {
  text: string;
  /** Map of display_name -> user_id for mention linking */
  mentionMap?: Record<string, string>;
  className?: string;
}

/**
 * Renders caption text with styled #tags and @mentions.
 * - #tags: green text
 * - @mentions: bold green text, linked to profile
 * - Regular text: normal foreground color
 */
export function CaptionText({ text, mentionMap, className }: CaptionTextProps) {
  const parts = renderCaptionParts(text, mentionMap);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'tag') {
          return (
            <span key={i} className="text-primary cursor-pointer hover:text-primary/80 transition-colors">
              #{part.value}
            </span>
          );
        }

        if (part.type === 'mention') {
          if (part.userId) {
            return (
              <Link
                key={i}
                href={`/profile/${part.userId}`}
                className="font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                @{part.value}
              </Link>
            );
          }
          // Unresolved mention (no userId found)
          return (
            <span key={i} className="font-semibold text-primary">
              @{part.value}
            </span>
          );
        }

        // Regular text
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}
