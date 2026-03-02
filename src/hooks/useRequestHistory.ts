import { useState, useCallback, useEffect } from 'react';

export interface RequestHistoryItem {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  } | null;
}

const MAX_HISTORY_ITEMS = 50;

const getHistoryKey = (workspaceId?: string) =>
  `api-request-history:${workspaceId || 'default'}`;

const parseHistory = (raw: string | null): RequestHistoryItem[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: RequestHistoryItem) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch {
    return [];
  }
};

export function useRequestHistory(workspaceId?: string) {
  const storageKey = getHistoryKey(workspaceId);
  const [history, setHistory] = useState<RequestHistoryItem[]>(() => {
    const stored = localStorage.getItem(storageKey);
    return parseHistory(stored);
  });

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    setHistory(parseHistory(stored));
  }, [storageKey]);

  const addToHistory = useCallback((item: Omit<RequestHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: RequestHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });

    return newItem;
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
  }, [storageKey]);

  return {
    history,
    addToHistory,
    clearHistory,
    removeFromHistory,
  };
}
