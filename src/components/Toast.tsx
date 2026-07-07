import { useEffect } from 'react';

interface Props {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onUndo, onDismiss, duration = 10000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__message">{message}</span>
      <div className="toast__actions">
        {onUndo && (
          <button type="button" className="toast__undo" onClick={onUndo}>
            取り消す
          </button>
        )}
        <button type="button" className="toast__close" onClick={onDismiss} aria-label="閉じる">
          ✕
        </button>
      </div>
    </div>
  );
}
