import { useEffect, useState } from 'react';

interface Props {
  label: string;
  color?: string;
}

/**
 * AI呼び出し中に表示する疑似プログレスバー。
 * 0→80% は加速→減速で増加し、80%以降は (99-p)*0.015 の漸近曲線で 99% に近づく。
 * 100% には到達しない（完了時に親がアンマウントする）。
 */
export function LoadingBar({ label, color = '#4F46E5' }: Props) {
  const [pct, setPct] = useState(2);

  useEffect(() => {
    const id = setInterval(() => {
      setPct(p => {
        if (p < 80) {
          const step = p < 35 ? 4.5 : p < 60 ? 2.5 : 1.0;
          return Math.min(p + step, 80);
        }
        // 80% 以降は 99 に漸近（決して到達しない）
        return p + (99 - p) * 0.015;
      });
    }, 350);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="loading-bar-wrap">
      <div className="loading-bar-header">
        <span
          className="loading-bar-spinner"
          style={{ borderTopColor: color }}
          aria-hidden="true"
        />
        <span className="loading-bar-label">{label}</span>
        <span className="loading-bar-pct">{Math.round(pct)}%</span>
      </div>
      <div className="loading-bar-track">
        <div
          className="loading-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
