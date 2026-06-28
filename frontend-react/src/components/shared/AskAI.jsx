import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Copy, Check } from 'lucide-react';
import { post } from '../../api/client';
import Spinner from './Spinner';

export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const res = await post('/api/chat', { message: question });
      setMessages((m) => [...m, { role: 'ai', text: res.response, error: res.error }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e.message || 'Failed to get response', error: true }]);
    }
    setLoading(false);
  };

  // Floating button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[900] w-11 h-11 rounded-full bg-info flex items-center justify-center shadow-lg hover:bg-info/90 transition-colors duration-100 md:bottom-4"
      >
        <MessageCircle size={18} className="text-white" />
      </button>
    );
  }

  // Chat panel
  return (
    <div className="fixed bottom-20 right-4 z-[900] w-[340px] max-h-[480px] bg-elevated border border-border-dim rounded-xl shadow-2xl flex flex-col overflow-hidden md:bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim bg-surface">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-info" />
          <span className="text-xs font-medium text-text-primary">Ask AI</span>
          <span className="text-[9px] text-text-muted">Llama 3.3 70B</span>
        </div>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-overlay rounded">
          <X size={14} className="text-text-muted" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px] max-h-[340px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={24} className="mx-auto text-text-muted mb-2" />
            <p className="text-[11px] text-text-muted">Ask anything about stocks, markets, or your portfolio</p>
            <div className="mt-3 space-y-1.5">
              {['What\'s the market mood today?', 'How is banking sector looking?', 'Any important news affecting stocks?', 'What\'s my win rate and performance?'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="block w-full text-left text-[10px] text-text-secondary bg-overlay border border-border-dim rounded-md px-3 py-2 hover:border-border-mid transition-colors duration-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-5 h-5 rounded-full bg-info/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={10} className="text-info" />
              </div>
            )}
            <div className="max-w-[85%]">
              <div className={`rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-info/15 text-text-primary'
                  : msg.error
                  ? 'bg-sell/10 border border-sell/20 text-text-secondary'
                  : 'bg-overlay border border-border-dim text-text-secondary'
              }`}>
                <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              {/* Copy button for AI responses */}
              {msg.role === 'ai' && !msg.error && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.text);
                    setCopiedIdx(i);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="flex items-center gap-1 mt-1 ml-1 text-[9px] text-text-muted hover:text-text-secondary transition-colors duration-100"
                >
                  {copiedIdx === i ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-5 h-5 rounded-full bg-overlay flex items-center justify-center shrink-0 mt-0.5">
                <User size={10} className="text-text-muted" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full bg-info/20 flex items-center justify-center shrink-0">
              <Bot size={10} className="text-info" />
            </div>
            <div className="bg-overlay border border-border-dim rounded-lg px-3 py-2">
              <Spinner size={12} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-dim p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about stocks, strategy..."
            className="flex-1 bg-base border border-border-dim rounded-md px-3 py-2 text-xs text-text-primary outline-none focus:border-border-mid placeholder:text-text-muted"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-md bg-info text-white disabled:opacity-30 transition-opacity duration-100"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
