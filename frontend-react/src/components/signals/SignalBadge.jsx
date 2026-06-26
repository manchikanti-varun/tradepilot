import Badge from '../shared/Badge';

export default function SignalBadge({ confidence }) {
  if (!confidence) return null;

  const variant = confidence === 'HIGH' ? 'high'
    : confidence === 'MEDIUM' ? 'medium'
    : confidence === 'LOW' ? 'low'
    : 'conflicting';

  const label = confidence === 'HIGH' ? 'HIGH'
    : confidence === 'MEDIUM' ? 'MEDIUM'
    : confidence === 'LOW' ? 'LOW'
    : 'MODELS DISAGREE';

  return <Badge variant={variant}>{label}</Badge>;
}
