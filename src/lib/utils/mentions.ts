/**
 * Parse #hashtags and @mentions from caption text.
 */

// Regex patterns
// Hashtags: #한글영문숫자_  (supports Korean, alphanumeric, underscores)
const HASHTAG_REGEX = /#([\p{L}\p{N}_]+)/gu;
// Mentions: @display_name (supports Korean, alphanumeric, spaces within)
// We match @followed-by non-whitespace Korean/alpha chars (display names can have spaces, so match greedily until next # or @ or end)
const MENTION_REGEX = /@([\p{L}\p{N}_]+(?:\s[\p{L}\p{N}_]+)*)/gu;

export interface ParsedCaption {
  tags: string[];
  mentions: string[]; // display names to resolve
}

/**
 * Extract hashtags and mentions from caption text.
 */
export function parseCaption(text: string): ParsedCaption {
  const tags: string[] = [];
  const mentions: string[] = [];

  let match: RegExpExecArray | null;

  // Reset regex state
  HASHTAG_REGEX.lastIndex = 0;
  while ((match = HASHTAG_REGEX.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const name = match[1];
    if (!mentions.includes(name)) {
      mentions.push(name);
    }
  }

  return { tags, mentions };
}

/**
 * Render caption text as HTML with styled tags and mentions.
 * Tags: green text
 * Mentions: bold green text with link to profile
 * mentionMap: display_name -> user_id (for linking)
 */
export function renderCaptionParts(
  text: string,
  mentionMap?: Record<string, string>
): { type: 'text' | 'tag' | 'mention'; value: string; userId?: string }[] {
  const parts: { type: 'text' | 'tag' | 'mention'; value: string; userId?: string }[] = [];
  // Combined regex: match either a hashtag or a mention
  const COMBINED_REGEX = /(?:#([\p{L}\p{N}_]+))|(?:@([\p{L}\p{N}_]+(?:\s[\p{L}\p{N}_]+)*))/gu;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  COMBINED_REGEX.lastIndex = 0;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      // Hashtag
      parts.push({ type: 'tag', value: match[1] });
    } else if (match[2] !== undefined) {
      // Mention
      const displayName = match[2];
      const userId = mentionMap?.[displayName];
      parts.push({ type: 'mention', value: displayName, userId });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return parts;
}
