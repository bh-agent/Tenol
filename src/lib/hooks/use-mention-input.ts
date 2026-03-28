'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

interface MentionUser {
  id: string;
  display_name: string;
}

interface UseMentionInputReturn {
  isAutocompleteOpen: boolean;
  autocompleteQuery: string;
  handleSelect: (user: MentionUser) => void;
  handleClose: () => void;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean; // returns true if event was consumed
}

/**
 * Detects "@mention" patterns in an input/textarea and manages autocomplete state.
 *
 * - Triggers when "@" is typed after start-of-text or a space
 * - Extracts the query text between "@" and the cursor
 * - On select, replaces "@partialQuery" with "@displayName "
 */
export function useMentionInput(
  inputRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  onValueChange: (value: string) => void
): UseMentionInputReturn {
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const mentionStartIndex = useRef<number | null>(null);

  const detectMention = useCallback((value: string, cursorPos: number) => {
    // Walk backward from cursor to find '@'
    let atIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      const char = value[i];
      // Stop if we hit whitespace before finding @
      if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
        break;
      }
      if (char === '@') {
        // Valid mention trigger: @ at start of text or after whitespace
        if (i === 0 || /\s/.test(value[i - 1])) {
          atIndex = i;
        }
        break;
      }
    }

    if (atIndex >= 0) {
      const query = value.slice(atIndex + 1, cursorPos);
      mentionStartIndex.current = atIndex;
      setAutocompleteQuery(query);
      setIsAutocompleteOpen(true);
    } else {
      mentionStartIndex.current = null;
      setIsAutocompleteOpen(false);
      setAutocompleteQuery('');
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      // Schedule detection after React state update
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          detectMention(value, el.selectionStart ?? value.length);
        }
      });
    },
    [inputRef, detectMention]
  );

  const handleSelect = useCallback(
    (user: MentionUser) => {
      const el = inputRef.current;
      if (!el || mentionStartIndex.current === null) return;

      const value = el.value;
      const start = mentionStartIndex.current;
      const cursorPos = el.selectionStart ?? value.length;

      // Replace @query with @displayName + space
      const before = value.slice(0, start);
      const after = value.slice(cursorPos);
      const mention = `@${user.display_name} `;
      const newValue = before + mention + after;

      onValueChange(newValue);

      // Reset state
      setIsAutocompleteOpen(false);
      setAutocompleteQuery('');
      mentionStartIndex.current = null;

      // Restore cursor position after the mention
      requestAnimationFrame(() => {
        const newCursorPos = before.length + mention.length;
        el.setSelectionRange(newCursorPos, newCursorPos);
        el.focus();
      });
    },
    [inputRef, onValueChange]
  );

  const handleClose = useCallback(() => {
    setIsAutocompleteOpen(false);
    setAutocompleteQuery('');
    mentionStartIndex.current = null;
  }, []);

  // Handle keyboard events - returns true if event was consumed by autocomplete
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isAutocompleteOpen) return false;

      if (e.key === 'Escape') {
        handleClose();
        return true;
      }

      // Arrow keys and Enter are handled by the autocomplete component itself
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        return true;
      }

      return false;
    },
    [isAutocompleteOpen, handleClose]
  );

  // Close autocomplete when clicking outside
  useEffect(() => {
    if (!isAutocompleteOpen) return;

    const handleClick = (e: MouseEvent) => {
      const el = inputRef.current;
      if (el && !el.contains(e.target as Node)) {
        // Allow a small delay for the autocomplete click to register
        setTimeout(() => {
          handleClose();
        }, 150);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isAutocompleteOpen, inputRef, handleClose]);

  return {
    isAutocompleteOpen,
    autocompleteQuery,
    handleSelect,
    handleClose,
    handleInputChange,
    handleKeyDown,
  };
}
