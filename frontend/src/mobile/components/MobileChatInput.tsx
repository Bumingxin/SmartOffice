import { Paperclip, Send, Square } from 'lucide-react';
import { useRef, useState } from 'react';

interface MobileChatInputProps {
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  onSend: (message: string, files: File[]) => Promise<void> | void;
  onStop?: () => Promise<void> | void;
}

export function MobileChatInput({ disabled, isSending, placeholder = '输入消息', onSend, onStop }: MobileChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const canSend = !disabled && !isSending && (message.trim().length > 0 || files.length > 0);

  const submit = async () => {
    if (!canSend) return;
    const text = message;
    const selectedFiles = files;
    setMessage('');
    setFiles([]);
    await onSend(text, selectedFiles);
  };

  return (
    <footer className="safe-area-bottom shrink-0 border-t border-gray-200 bg-white">
      {files.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2">
          {files.map((file, index) => (
            <button
              key={`${file.name}-${index}`}
              type="button"
              onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
              className="shrink-0 rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-600"
            >
              {file.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-2 px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
        />
        <button
          type="button"
          aria-label="添加附件"
          onClick={() => fileInputRef.current?.click()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <textarea
          value={message}
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-950 focus:border-gray-950 focus:bg-white"
        />
        {isSending ? (
          <button
            type="button"
            aria-label="停止"
            onClick={() => void onStop?.()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-red-500 text-white"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="发送"
            disabled={!canSend}
            onClick={() => void submit()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-950 text-white disabled:opacity-35"
          >
            <Send className="h-5 w-5" />
          </button>
        )}
      </div>
    </footer>
  );
}
