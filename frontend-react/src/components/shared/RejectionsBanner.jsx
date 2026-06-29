import { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { historyApi } from '../../api/history';

export default function RejectionsBanner() {
  const [rejections, setRejections] = useState(null);

  useEffect(() => {
    historyApi.rejections().then(setRejections).catch(() => {});
  }, []);

  if (!rejections || rejections.total_rejected === 0) return null;

  return (
    <div className="px-4 py-1">
      <div className="flex items-center gap-2.5 bg-watch/8 border border-watch/20 rounded-xl px-4 py-2.5">
        <Filter size={13} className="text-watch shrink-0" />
        <span className="text-[11px] text-text-secondary leading-relaxed">{rejections.headline}</span>
      </div>
    </div>
  );
}
