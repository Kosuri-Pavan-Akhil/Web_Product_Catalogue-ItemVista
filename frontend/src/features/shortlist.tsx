import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const storageKey = 'itemvista.shortlist';

function readIds(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(value)) {
      return [...new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0))];
    }
  } catch {
    // An unreadable shortlist starts empty.
  }
  return [];
}

const ShortlistContext = createContext<{
  ids: number[];
  toggle: (id: number) => void;
  clear: () => void;
  remove: (productIds: number[]) => void;
  storageError: boolean;
} | null>(null);

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState(readIds);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    function restore() {
      setIds(readIds());
    }
    function sync(event: StorageEvent) {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) restore();
    }
    function restoreOnBack(event: PageTransitionEvent) {
      if (event.persisted) restore();
    }
    window.addEventListener('storage', sync);
    window.addEventListener('pageshow', restoreOnBack);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('pageshow', restoreOnBack);
    };
  }, []);

  function updateIds(next: number[]) {
    // Store IDs only so the shortlist can render the latest catalogue data.
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setIds(next);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }

  function toggle(id: number) {
    updateIds(ids.includes(id) ? ids.filter(savedId => savedId !== id) : [...ids, id]);
  }

  function remove(productIds: number[]) {
    // Delivery is asynchronous. Keep any bookmarks added while the request was pending.
    const saved = readIds();
    const sent = new Set(productIds);
    const remaining = saved.filter(id => !sent.has(id));
    if (remaining.length !== saved.length) updateIds(remaining);
  }

  return <ShortlistContext.Provider value={{ ids, toggle, clear: () => updateIds([]), remove, storageError }}>
    {children}
  </ShortlistContext.Provider>;
}

export function useShortlist() {
  const state = useContext(ShortlistContext);
  if (!state) throw new Error('ShortlistProvider is required');
  return state;
}

export function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </svg>
  );
}

export function ShortlistButton({ id, title }: { id: number; title: string }) {
  const { ids, toggle } = useShortlist();
  const saved = ids.includes(id);
  return (
    <button type="button" className="button outline shortlist-button"
      aria-label={'Bookmark ' + title} aria-pressed={saved}
      title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      onClick={() => toggle(id)}>
      <BookmarkIcon />
    </button>
  );
}