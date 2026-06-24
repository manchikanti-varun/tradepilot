import { useState } from 'react'
import { Send } from 'lucide-react'

export default function IntakeBar({ onSubmit }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    if (!text.trim()) return
    onSubmit(text.trim())
    setText('')
  }

  return (
    <div className="sticky top-0 z-50 bg-dark-900/95 backdrop-blur-md py-2 mb-3">
      <div className="flex gap-2 bg-dark-700 border border-dark-600 rounded-2xl p-1.5 focus-within:border-accent-blue transition-colors">
        <input type="text" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Bought SBIN at 845, qty 4..."
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none"
        />
        <button onClick={handleSubmit}
          className="bg-accent-blue text-white p-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-30"
          disabled={!text.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
