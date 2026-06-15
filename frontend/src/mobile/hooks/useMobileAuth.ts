import { useEffect, useState } from 'react';
import { fetchJsonWithTimeout } from './useConnectionStatus';

export function useMobileAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let disposed = false;

    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('clawui_auth_token');
        const url = token ? `/api/auth/check?token=${encodeURIComponent(token)}` : '/api/auth/check';
        const data = await fetchJsonWithTimeout<{ loginRequired?: boolean }>(url);
        if (disposed) return;
        if (data.loginRequired) {
          localStorage.removeItem('clawui_auth_token');
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      } catch {
        if (!disposed) setIsAuthenticated((current) => current ?? true);
      }
    };

    void checkAuth();
    const timer = window.setInterval(checkAuth, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return { isAuthenticated, setIsAuthenticated };
}
