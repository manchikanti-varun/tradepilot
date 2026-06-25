import { useState, useEffect } from 'react'
import { History, Download, MessageSquare, X, Send, Tag } from 'lucide-react'
import { api, formatCurrency, formatTime } from '../api'

export default function HistoryPage() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [noteTags, setNoteTags] = useState('')

  useEffect(() => {
    api.history(100).then(res => setTrades(res.trades || [])).catch(console.error).finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    const url = api.exportHistory()
    window.open(url, '_blank')
  }

  const openTradeDetail = async (trade) => {
    setSelectedTrade(trade)
    try {
      const res = await api.tradeNotes(trade.id)
      setNotes(res.notes || [])
    } catch { setNotes([]) }
  }

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedTrade) return
    await api.addTradeNote(selectedTrade.id, noteText, noteTags || null)
    setNoteText('')
    setNoteTags('')
    // Refresh notes
    const res = await api.tradeNotes(selectedTrade.id)
    setNotes(res.notes || [])
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-500 text-sm">Loading trades...</div>
  }

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-accent-blue" />
          <h2 className="text-base font-bold">Trade History</h2>
          <span className="text-[10px] text-gray-500 bg-dark-700 px-2 py-0.5 rounded-full">{trades.length}</span>
        </div>
        {trades.length > 0 && (
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-dark-500 rounded-lg text-xs text-gray-300 hover:text-white transition-colors">
            <Download size={12} />
            CSV
          </button>
        )}
      </div>

      {/* Trade List */}
      {trades.length === 0 ? (
        <div className="text-center py-12">
          <History size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No trades yet</p>
          <p className="text-xs text-gray-600 mt-1">Report your first trade using the intake bar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trades.map(trade => {
            const pnl = trade.exit_price && trade.entry_price
              ? (trade.exit_price - trade.entry_price) * trade.qty
              : null
            const isProfit = pnl !== null && pnl > 0
            return (
              <button key={trade.id} onClick={() => openTradeDetail(trade)}
                className="w-full bg-dark-700 border border-dark-600 rounded-xl p-3.5 text-left hover:border-dark-500 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white">{trade.ticker}</span>
                    <span className="text-[10px] text-gray-500 ml-2">{trade.entry_time?.slice(0, 10)}</span>
                  </div>
                  {pnl !== null && (
                    <span className={`text-sm font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                      {isProfit ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-[11px] text-gray-500">
                  <span>Entry ₹{trade.entry_price?.toFixed(1)}</span>
                  {trade.exit_price && <span>Exit ₹{trade.exit_price.toFixed(1)}</span>}
                  <span>Qty {trade.qty}</span>
                  <span className="text-gray-600">Tier {trade.capital_tier}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-black/60 z-[1001] flex items-end justify-center" onClick={() => setSelectedTrade(null)}>
          <div className="w-full max-w-lg bg-dark-800 border-t border-dark-600 rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{selectedTrade.ticker}</h3>
                <p className="text-xs text-gray-500">{selectedTrade.entry_time?.slice(0, 10)}</p>
              </div>
              <button onClick={() => setSelectedTrade(null)} className="p-2 rounded-lg bg-dark-700">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <DetailCell label="Entry" value={`₹${selectedTrade.entry_price?.toFixed(2)}`} />
              <DetailCell label="Exit" value={selectedTrade.exit_price ? `₹${selectedTrade.exit_price.toFixed(2)}` : 'Open'} />
              <DetailCell label="Qty" value={selectedTrade.qty} />
              <DetailCell label="Status" value={selectedTrade.status} />
            </div>

            {/* Notes Section */}
            <div className="border-t border-dark-600 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={14} className="text-purple-400" />
                <span className="text-xs font-bold">Trade Journal</span>
              </div>

              {/* Add Note */}
              <div className="mb-3">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note about this trade..."
                  className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent-blue resize-none h-16"
                />
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 flex items-center gap-1">
                    <Tag size={10} className="text-gray-500" />
                    <input value={noteTags} onChange={e => setNoteTags(e.target.value)}
                      placeholder="Tags: momentum, mistake..."
                      className="flex-1 bg-dark-900 border border-dark-500 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none"
                    />
                  </div>
                  <button onClick={handleAddNote} disabled={!noteText.trim()}
                    className="px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs font-bold disabled:opacity-30 flex items-center gap-1">
                    <Send size={10} /> Add
                  </button>
                </div>
              </div>

              {/* Existing Notes */}
              {notes.length > 0 ? (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="bg-dark-900 rounded-lg p-2.5">
                      <p className="text-xs text-gray-200">{n.note}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {n.tags && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">{n.tags}</span>}
                        <span className="text-[9px] text-gray-600">{n.created_at?.slice(0, 16)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-600 text-center py-3">No notes yet for this trade</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailCell({ label, value }) {
  return (
    <div className="bg-dark-900 rounded-lg p-2.5">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  )
}
