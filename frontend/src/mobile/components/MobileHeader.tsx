import { ArrowLeft, Circle, RefreshCw } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  isConnected?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  onRefresh?: () => void;
  action?: React.ReactNode;
}

export function MobileHeader({ title, subtitle, isConnected, showBack, onBack, onRefresh, action }: MobileHeaderProps) {
  return (
    <header className="safe-area-top shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3">
        {showBack ? (
          <button
            type="button"
            aria-label="返回"
            onClick={onBack}
            className="grid h-11 w-11 place-items-center rounded-lg text-gray-700 active:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="grid h-11 w-11 place-items-center">
            <div className="h-8 w-8 rounded-lg bg-gray-900 text-center text-sm font-black leading-8 text-white">S</div>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-bold leading-5 text-gray-950">{title}</div>
          {subtitle ? <div className="truncate text-xs text-gray-500">{subtitle}</div> : null}
        </div>
        {typeof isConnected === 'boolean' ? (
          <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Circle className={`h-2.5 w-2.5 fill-current ${isConnected ? 'text-emerald-500' : 'text-red-500'}`} />
            {isConnected ? '在线' : '离线'}
          </div>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            aria-label="刷新"
            onClick={onRefresh}
            className="grid h-11 w-11 place-items-center rounded-lg text-gray-700 active:bg-gray-100"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        ) : null}
        {action}
      </div>
    </header>
  );
}
