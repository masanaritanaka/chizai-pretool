interface BackButtonProps {
  onClick: () => void;
  /** クラスタ色 — ホバー時の枠線・文字色に使用 */
  clusterColor?: string;
  label?: string;
}

export function BackButton({ onClick, clusterColor, label = '← Home' }: BackButtonProps) {
  return (
    <button
      type="button"
      className="back-button"
      style={{ '--cluster-color': clusterColor } as React.CSSProperties}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
