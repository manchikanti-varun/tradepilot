import Card from '../shared/Card';

export default function LossClassification({ classification }) {
  if (!classification) return null;

  return (
    <Card accent="low">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Loss Classification</p>
      <p className="text-xs text-text-primary font-medium">{classification.category || 'Unclassified'}</p>
      {classification.detail && (
        <p className="text-[11px] text-text-secondary mt-1">{classification.detail}</p>
      )}
    </Card>
  );
}
