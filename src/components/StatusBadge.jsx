export default function StatusBadge({ status, overdue }) {
  const cls = status === 'paid' ? 'paid' : status === 'sent' ? 'sent' : 'draft';
  return (
    <span className={`badge ${cls}${overdue ? ' overdue' : ''}`}>
      {overdue ? 'Overdue' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
