import { Zap, AlertTriangle, Minus } from 'lucide-react';
import Badge from '../shared/Badge';

export default function SignalBadge({ confidence }) {
  if (!confidence) return null;

  const config = {
    HIGH: { variant: 'high', label: 'HIGH', icon: Zap },
    MEDIUM: { variant: 'medium', label: 'MEDIUM', icon: Zap },
    LOW: { variant: 'low', label: 'LOW', icon: AlertTriangle },
  };

  const { variant, label, icon: Icon } = config[confidence] || config.LOW;

  return (
    <Badge variant={variant}>
      <Icon size={9} className="mr-0.5" />
      {label}
    </Badge>
  );
}
