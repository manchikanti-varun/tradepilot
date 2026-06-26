import { useState } from 'react';
import MorningBrief from '../components/brief/MorningBrief';
import NewsFeed from '../components/news/NewsFeed';
import CoachPanel from '../components/coach/CoachPanel';
import SignalHistory from '../components/signals/SignalHistory';

const TABS = [
  { id: 'brief', label: 'BRIEF' },
  { id: 'news', label: 'NEWS' },
  { id: 'coach', label: 'COACH' },
  { id: 'log', label: 'LOG' },
];

export default function RightPanel() {
  const [activeTab, setActiveTab] = useState('brief');

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="flex border-b border-border-dim">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2.5 text-center text-[10px] uppercase tracking-wider font-medium transition-colors duration-100 ${
              activeTab === id
                ? 'text-info border-b-2 border-info'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'brief' && <MorningBrief />}
        {activeTab === 'news' && <NewsFeed compact />}
        {activeTab === 'coach' && <CoachPanel />}
        {activeTab === 'log' && <SignalHistory />}
      </div>
    </div>
  );
}
