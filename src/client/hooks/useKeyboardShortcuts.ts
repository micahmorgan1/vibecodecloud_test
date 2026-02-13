import { useEffect } from 'react';

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (IGNORED_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

const defaultShortcuts: Record<string, () => void> = {
  '/': () => {
    const searchInput = document.querySelector<HTMLElement>('[data-search-input]');
    if (searchInput) searchInput.focus();
  },
  'ctrl+k': () => {
    const searchInput = document.querySelector<HTMLElement>('[data-search-input]');
    if (searchInput) searchInput.focus();
  },
  'Escape': () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
  },
};

export default function useKeyboardShortcuts(
  shortcuts?: Record<string, () => void>
): void {
  useEffect(() => {
    const merged = { ...defaultShortcuts, ...shortcuts };

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableElement(document.activeElement)) {
        // Still allow Escape when focused on an editable element
        if (e.key === 'Escape') {
          merged['Escape']?.();
          return;
        }
        return;
      }

      // Build a normalized key string
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      parts.push(e.key);
      const combo = parts.join('+');

      const handler = merged[combo] || merged[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
