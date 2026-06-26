import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, History, MessageSquare, Send, X, Tag } from 'lucide-react';
import { historyApi } from '../api/history';
import SectionLabel from '../components/shared/SectionLabel';
import MonoNumber from '../components/shared/MonoNumber';
import Badge from '../components/shared/Badge';
import { SkeletonCard } from '../components/shared/Skeleton';
import ErrorState from '../components/shared/ErrorState';
import EmptyState from '../components/shared/EmptyState';
import { formatCurrency } from '../api/client';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [trades, setTrades] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState(null);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const res = await historyApi.list(100);
      setTrades(res.trades || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTrades(); }, []);

  const handleExport = () => {
    window.open(historyApi.exportUrl(), '_blank');
  };

  const filtered = trades ? trades.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'win') return t.exit_price && t.exit_price > t.entry_price;
    if (filter === 'loss') return t.exit_price && t.exit_price <= t.entry_price;
    return true;
  }) : [];

  // Summary
  const wins = trades ? trades.filter((t) => t.exit_price && t.exit_price > t.entry_price).length : 0;
  const losses = trades ? trades.filter((t) => t.exit_price && t.exit_price <= t.entry_price).length : 0;
  const total = trades?.length || 0;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : '—';

  if (error && !trades) return <div className="p-4"><ErrorState message="Failed to load history" onRetry={fetchTrades} /></div>;

  const openTradeDetail = (trade) => {
    setSelectedTrade(trade);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <SectionLabel>Trade History</SectionLabel>
          {total > 0 && <span className="text-[10px] font-mono text-text-muted">{total}</span>}
        </div>
        {total > 0 && (
          <button onClick={handleExport} className="flex items-center gap-1 px-2 py-1 rounded bg-overlay border border-border-dim text-[10px] text-text-secondary hover:text-text-primary">
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {/* Summary Bar */}
      {total > 0 && (
        <div className="flex items-center gap-4 mb-3 py-2 px-3 bg-surface border border-border-dim rounded-lg text-[10px]">
          <span className="text-text-muted">Trades: <span className="font-mono text-text-primary">{total}</span></span>
          <span className="text-text-muted">Wins: <span className="font-mono text-buy">{wins}</span></span>
          <span className="text-text-muted">Losses: <span className="font-mono text-sell">{losses}</span></span>
          <span className="text-text-muted">WR: <span className="font-mono text-text-primary">{winRate}%</span></span>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1 mb-3">
        {['all', 'win', 'loss'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium ${
              filter === f ? 'bg-info/15 text-info' : 'bg-overlay text-text-muted'
            }`}
          >
            {f === 'all' ? 'All' : f === 'win' ? 'Wins' : 'Losses'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && !trades ? <SkeletonCard /> : filtered.length === 0 ? (
        <EmptyState icon={History} title="No trades yet" subtitle="Report your first trade to see history" />
      ) : (
        <div className="space-y-1">
          {filtered.map((trade) => {
            const pnl = trade.exit_price && trade.entry_price ? (trade.exit_price - trade.entry_price) * trade.qty : null;
            const isWin = pnl !== null && pnl > 0;
            return (
              <button key={trade.id} onClick={() => openTradeDetail(trade)}
                className="w-full flex items-center justify-between bg-surface border border-border-dim rounded-lg px-3 py-2.5 text-left hover:border-border-mid transition-colors duration-100">
                <div>
                  <span className="text-xs font-mono font-medium text-text-primary">{trade.ticker}</span>
                  <span className="text-[9px] text-text-muted ml-2">{trade.entry_time?.slice(0, 10)}</span>
                  <span className="text-[9px] text-text-muted ml-2">Qty {trade.qty}</span>
                </div>
                <div className="flex items-center gap-2">
                  {pnl !== null ? (
                    <MonoNumber value={formatCurrency(pnl)} color={isWin ? 'buy' : 'sell'} className="text-[11px] font-medium" />
                  ) : (
                    <Badge variant="info">OPEN</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Links */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <QuickLink label="Performance Stats" sublabel="Charts & breakdown" path="/stats" />
          <QuickLink label="Reality Check" sublabel="You vs Nifty" path="/reality" />
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}
    </div>
  );
}


function QuickLink({ label, sublabel, path }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(path)}
      className="bg-surface border border-border-dim rounded-lg p-3 text-left hover:border-border-mid transition-colors duration-100">
      <p className="text-xs font-medium text-text-primary">{label}</p>
      <p className="text-[9px] text-text-muted mt-0.5">{sublabel}</p>
    </button>
  );
}

function TradeDetailModal({ trade, onClose }) {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(true);

  useEffect(() => {
    historyApi.notes(trade.id)
      .then((res) => setNotes(res.notes || []))
      .catch(() => {})
      .finally(() => setLoadingNotes(false));
  }, [trade.id]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await historyApi.addNote(trade.id, noteText.trim(), noteTags.trim() || null);
    setNoteText('');
    setNoteTags('');
    const res = await historyApi.notes(trade.id);
    setNotes(res.notes || []);
  };

  const pnl = trade.exit_price && trade.entry_price ? (trade.exit_price - trade.entry_price) * trade.qty : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[1001] flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-lg bg-elevated border-t border-border-dim rounded-t-xl p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-mono font-semibold text-text-primary">{trade.ticker}</h3>
            <p className="text-[10px] text-text-muted">{trade.entry_time?.slice(0, 10)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded bg-overlay">
            <X size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Trade Details */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <DetailCell label="Entry" value={`₹${trade.entry_price?.toFixed(2)}`} />
          <DetailCell label="Exit" value={trade.exit_price ? `₹${trade.exit_price.toFixed(2)}` : 'Open'} />
          <DetailCell label="Qty" value={trade.qty} />
          <DetailCell label="P&L" value={pnl !== null ? formatCurrency(pnl) : '—'} color={pnl > 0 ? 'text-buy' : pnl < 0 ? 'text-sell' : ''} />
        </div>

        {/* Journal Section */}
        <div className="border-t border-border-dim pt-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={13} className="text-conflicting" />
            <span className="text-xs font-medium text-text-primary">Trade Journal</span>
          </div>

          {/* Add Note */}
          <div className="mb-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this trade..."
              className="w-full bg-surface border border-border-dim rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-border-mid resize-none h-16 placeholder:text-text-muted"
            />
            <div className="flex gap-2 mt-2">
              <div className="flex-1 flex items-center gap-1">
                <Tag size={10} className="text-text-muted" />
                <input
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  placeholder="Tags: momentum, mistake..."
                  className="flex-1 bg-surface border border-border-dim rounded-lg px-2 py-1.5 text-[10px] text-text-primary outline-none placeholder:text-text-muted"
                />
              </div>
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="px-3 py-1.5 bg-info text-white rounded-lg text-[10px] font-medium disabled:opacity-30 flex items-center gap-1"
              >
                <Send size={10} /> Add
              </button>
            </div>
          </div>

          {/* Existing Notes */}
          {loadingNotes ? (
            <p className="text-[10px] text-text-muted text-center py-3">Loading notes...</p>
          ) : notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="bg-surface border border-border-dim rounded-lg p-2.5">
                  <p className="text-[11px] text-text-secondary">{n.note}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {n.tags && <span className="text-[9px] bg-conflicting/15 text-conflicting px-1.5 py-0.5 rounded">{n.tags}</span>}
                    <span className="text-[9px] text-text-muted">{n.created_at?.slice(0, 16)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-text-muted text-center py-3">No notes yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailCell({ label, value, color = '' }) {
  return (
    <div className="bg-surface border border-border-dim rounded-lg p-2.5">
      <p className="text-[9px] text-text-muted">{label}</p>
      <p className={`text-sm font-mono font-medium text-text-primary ${color}`}>{value}</p>
    </div>
  );
}
