import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';

interface MobileLoginScreenProps {
  onLoginSuccess: () => void;
}

function resolveLoginError(data: any) {
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  return '密码不正确，请重试';
}

export function MobileLoginScreen({ onLoginSuccess }: MobileLoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.success) {
        if (data.token) localStorage.setItem('clawui_auth_token', data.token);
        onLoginSuccess();
      } else {
        setError(resolveLoginError(data));
      }
    } catch {
      setError('无法连接到 SmartOffice 服务');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f4ef] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col justify-center">
        <div className="mb-8">
          <div className="mb-5 grid h-14 w-14 place-items-center rounded-lg bg-gray-950 text-white">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-normal text-gray-950">SmartOffice</h1>
          <p className="mt-2 text-sm leading-6 text-gray-600">移动端控制台</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-800">登录密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              className="h-12 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-gray-950 focus:border-gray-950 focus:bg-white"
              placeholder="输入密码"
              autoFocus
            />
          </label>
          {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
          <button
            type="submit"
            disabled={isLoading || !password}
            className="h-12 w-full rounded-lg bg-gray-950 text-sm font-bold text-white disabled:opacity-45"
          >
            {isLoading ? '验证中...' : '进入'}
          </button>
        </form>
      </div>
    </div>
  );
}
