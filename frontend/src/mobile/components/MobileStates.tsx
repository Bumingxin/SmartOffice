import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = '加载中' }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin" />
      <div className="text-sm">{label}</div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-gray-100 text-gray-500">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <div className="font-semibold text-gray-950">{title}</div>
        {description ? <div className="mt-1 text-sm leading-5 text-gray-500">{description}</div> : null}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-lg bg-red-50 text-red-500">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="text-sm leading-5 text-gray-600">{message}</div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="h-11 rounded-lg bg-gray-950 px-5 text-sm font-semibold text-white">
          重试
        </button>
      ) : null}
    </div>
  );
}
