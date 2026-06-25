import { useState, useEffect, useMemo } from 'react'
import { api } from '../api'
import { Radio, TrendingUp, TrendingDown, Minus, RefreshCw, Search, Filter, ArrowUpDown } from 'lucide-react'
import StockDetailModal from '../components/StockDetailModal'

const SORT_OPTIONS = [
  { key: 'composite', label: 'Score' },
  { key: 'ltp', label: 'Price' },
  { key: 'rsi', label: 'RSI' },
  { key: 'volume_ratio', label: 'Volume' },
]

export default function WatchlistPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('composite')
  const [sortDir, setSortDir] = useState('desc')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const load = () => {
    setLoading(true)
    api.watchlist().then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  // Get unique sectors for filter
  const sectors = useMemo(() => {
    if (!data?.stocks) return []
    return [...new Set(data.stocks.map(s => s.sector))].sort()
  }, [data])

  // Filter and sort
  const filteredStocks = useMemo(() => {
    if (!data?.stocks) return []
    let stocks = [...data.stocks]

    // Search
    if (search) {
      const q = search.toLowerCase()
      stocks = stocks.filter(s => s.symbol.toLowerCase().includes(q) || s.sector.toLowerCase().includes(q))
    }

    // Grade filter
    if (gradeFilter !== 'all') {
      stocks = stocks.filter(s => s.grade === gradeFilter)
    }

    // Sector filter
    if (sectorFilter !== 'all') {
      stocks = stocks.filter(s => s.sector === sectorFilter)
    }

    // Sort
    stocks.sort((a, b) => {
      const aVal = a[sortBy] || 0
      const bVal = b[sortBy] || 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })

    return stocks
  }, [data, search, sortBy, sortDir, gradeFilter, sectorFilter])

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  return (
    <div className="py-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Radio size={16} className="text-accent-blue" /> Watchlist
          </h2>
          <p className="text-[10px] text-gray-500">
            {data ? `${data.total} scored • Showing ${filteredStocks.length}` : 'Loading...'}
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600">
          <RefreshCw size={13} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search symbol or sector..."
          className="w-full bg-dark-700 border border-dark-600 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-accent-blue"
        />
      </div>

      {/* Filters Row */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-[10px] text-gray-300 outline-none">
          <option value="all">All Grades</option>
          <option value="A+">A+ only</option>
          <option value="A">A only</option>
          <option value="B">B only</option>
          <option value="C">C only</option>
        </select>
        <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
          className="bg-dark-700 border border-dark-600 rounded-lg px-2 py-1.5 text-[10px] text-gray-300 outline-none">
          <option value="all">All Sectors</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {SORT_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => toggleSort(opt.key)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap ${
              sortBy === opt.key ? 'bg-accent-blue/20 text-accent-blue' : 'bg-dark-700 text-gray-500'
            }`}>
            {opt.label}
            {sortBy === opt.key && <ArrowUpDown size={9} />}
          </button>
        ))}
      </div>

      {/* Stock List */}
      {filteredStocks.length > 0 ? (
        <div className="space-y-1.5">
          {filteredStocks.map((s, i) => (
            <button key={s.symbol} onClick={() => setSelectedSymbol(s.symbol)}
              className="w-full flex items-center justify-between bg-dark-700 border border-dark-600 rounded-xl px-3 py-2.5 hover:border-accent-blue/40 transition-colors text-left">
              <div className="flex items-center gap-2.5">
                <span className="text-[9px] text-gray-600 w-4 text-right">{i + 1}</span>
                <div>
                  <span className="font-bold text-xs">{s.symbol}</span>
                  <span className="text-[9px] text-gray-500 ml-1.5">{s.sector}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-mono">₹{s.ltp?.toFixed(1)}</div>
                  <div className="text-[9px] text-gray-500">
                    RSI {s.rsi?.toFixed(0)} • Vol {s.volume_ratio?.toFixed(1)}x
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-gray-400">{s.composite?.toFixed(0)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    s.grade === 'A+' ? 'bg-green-500/15 text-green-400' :
                    s.grade === 'A' ? 'bg-blue-500/15 text-blue-400' :
                    s.grade === 'B' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-dark-600 text-gray-500'
                  }`}>{s.grade}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Radio size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">{search || gradeFilter !== 'all' ? 'No matches for current filters' : 'No data yet'}</p>
        </div>
      )}

      {/* Stock Detail Modal */}
      {selectedSymbol && (
        <StockDetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </div>
  )
}
