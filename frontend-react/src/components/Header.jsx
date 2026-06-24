export default function Header({ clock, state }) {
  return (
    <div className="flex justify-between items-center py-4">
      <div>
        <h1 className="text-xl font-extrabold">TradePilot <span className="text-accent-blue">AI</span></h1>
        <p className="text-[11px] text-gray-500 mt-0.5">You execute. AI decides.</p>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono text-gray-400">{clock}</div>
        <div className="flex items-center gap-1.5 justify-end mt-1">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
          <span className="text-[10px] text-gray-500">{state?.market_mode || 'NORMAL'}</span>
        </div>
      </div>
    </div>
  )
}
