import type { IdeaStatus } from '../engines/research/idea04Db';

const STATUS_LABEL: Record<IdeaStatus, string> = {
  draft: '下書き',
  researching: '調査中',
  consulted: '専門家相談済',
  archived: 'アーカイブ',
};

interface Props {
  status: IdeaStatus;
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
