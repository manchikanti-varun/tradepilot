import { AlertTriangle } from 'lucide-react';
import Card from '../shared/Card';

export default function LossClassification({ classification }) {
  if (!classification) return null;

  return (
    <Card accent="low">
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-sell/12 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle size={13} className="text-sell" />
        </div>
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-0.5">Loss Classification</p>
          <p className="text-xs text-text-primary font-semibold">{classification.category || 'Unclassified'}</p>
          {classification.detail && (
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">{classification.detail}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
