import { Loader2 } from 'lucide-react';

export default function Spinner({ size = 18, className = '' }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-info ${className}`}
    />
  );
}
