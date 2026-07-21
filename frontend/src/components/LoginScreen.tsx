import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const AUTH_INVALID_PASSWORD_ERROR_CODE = 'auth.invalidPassword';

interface LoginErrorResponse {
  errorCode?: string;
  errorParams?: Record<string, string | number | boolean | null> | null;
  errorDetail?: string | null;
  message?: string;
  error?: string;
}

function resolveLoginErrorMessage(data: LoginErrorResponse, t: (key: string, options?: any) => string): string {
  const detail = typeof data.errorDetail === 'string' && data.errorDetail.trim() ? data.errorDetail.trim() : '';

  if (data.errorCode) {
    const translated = t(data.errorCode, (data.errorParams || {}) as any);
    if (translated !== data.errorCode) {
      return detail ? `${translated}: ${detail}` : translated;
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error.trim();
  }

  if (detail) {
    return detail;
  }

  return t(AUTH_INVALID_PASSWORD_ERROR_CODE);
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        if (data.token) {
          localStorage.setItem('clawui_auth_token', data.token);
        }
        onLoginSuccess();
      } else {
        setError(resolveLoginErrorMessage(data, t));
      }
    } catch {
      setError(t('auth.connectionFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'deep-space-bg star-field relative' : 'bg-gray-50'}`}>
      {isDark && <div className="star-trails" />}
      <div className="w-full max-w-sm mx-4 relative z-10">
        <div className="mb-8 flex justify-center">
          <div className={isDark ? 'neon-title-plate rounded-xl px-6 py-4' : ''}>
            <div className={`text-2xl font-black tracking-tighter leading-tight mb-1 ${isDark ? 'neon-title-text' : 'text-gray-900'}`}>SmartOffice</div>
            <div className={`text-2xl font-bold tracking-widest uppercase leading-tight ${isDark ? 'neon-text-cyan' : 'text-gray-400'}`}>MingYuan</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`rounded-2xl p-6 space-y-5 ${isDark ? 'dark-glass neon-border-dual' : 'bg-white border border-gray-200'}`}>
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-600' : 'text-gray-700'}`}>请输入登录密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}
              placeholder="输入密码..."
              autoFocus
              className={`block w-full px-4 py-3 rounded-xl border transition-all text-sm ${isDark ? 'border-gray-400 bg-gray-200 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-cyan-400' : 'border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'}`}
            />
          </div>

          {error && (
            <div className={`text-sm text-red-500 font-medium px-3 py-2 rounded-lg ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className={`w-full py-3 text-sm font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isDark ? 'neon-btn-gradient' : 'text-white bg-blue-600 hover:bg-blue-700'}`}
          >
            {isLoading ? '验证中...' : '登 录'}
          </button>
        </form>
      </div>
    </div>
  );
}
