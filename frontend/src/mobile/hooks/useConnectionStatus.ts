import { useState, useEffect, useRef, useCallback } from 'react';

const CONNECTION_STATUS_STORAGE_KEY = 'clawui_mobile_connection_status';
const CONNECTION_STATUS_STORAGE_TTL_MS = 30 * 1000;
const POLL_CONNECTED_MS = 10000;
const POLL_DISCONNECTED_MS = 2000;
const REQUEST_TIMEOUT_MS = 8000;

async function fetchWithTimeout<T>(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return await res.json() as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useConnectionStatus() {
  const failureCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const latestRef = useRef(false);

  const [isConnected, setIsConnected] = useState<boolean>(() => {
    try {
      const raw = window.sessionStorage.getItem(CONNECTION_STATUS_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if ((Date.now() - (parsed?.checkedAt || 0)) > CONNECTION_STATUS_STORAGE_TTL_MS) return false;
      return parsed?.connected === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    latestRef.current = isConnected;
    try {
      window.sessionStorage.setItem(CONNECTION_STATUS_STORAGE_KEY, JSON.stringify({
        connected: isConnected,
        checkedAt: Date.now(),
      }));
    } catch {}
  }, [isConnected]);

  const checkStatus = useCallback(async () => {
    try {
      const data = await fetchWithTimeout<{ connected?: boolean }>('/api/gateway/status');
      if (data.connected) {
        failureCountRef.current = 0;
        if (retryTimerRef.current !== null) {
          window.clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        setIsConnected(true);
        return;
      }
    } catch {}

    if (!latestRef.current) {
      failureCountRef.current = 0;
      setIsConnected(false);
      return;
    }

    failureCountRef.current += 1;
    if (failureCountRef.current >= 2) {
      failureCountRef.current = 0;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    if (retryTimerRef.current === null) {
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void checkStatus();
      }, 1500);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    const timer = window.setInterval(() => {
      void checkStatus();
    }, isConnected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS);

    const handleFocus = () => void checkStatus();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkStatus();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(timer);
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isConnected, checkStatus]);

  return { isConnected, checkStatus };
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  return fetchWithTimeout<T>(input, init, timeoutMs);
}
