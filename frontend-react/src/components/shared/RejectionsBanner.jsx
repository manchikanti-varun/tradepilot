import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { historyApi } from '../../api/history';

export default function RejectionsBanner() {
  const [rejections, setRejections] = useState(null);

  useEffect(() => {
    historyApi.rejections().then(setRejections).catch(() => {});
  }, []);

  if (!rejections || rejections.total_rejected === 0) return null;

  return (
    <div className="px-4 py-1">
      <div className="flex items-center gap-2 bg-watch/10 border border-watch/25 rounded-md px-3 py-2">
        <Zap size={12} className="text-watch shrink-0" />
        <span className="text-[11px] text-text-secondary">{rejections.headline}</span>
      </div>
    </div>
  );
}
