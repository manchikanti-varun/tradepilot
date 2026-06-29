import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Copy, Check, Sparkles } from 'lucide-react';
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[900] w-12 h-12 rounded-2xl bg-gradient-to-br from-info to-conflicting flex items-center justify-center shadow-xl shadow-info/20 hover:scale-105 transition-transform md:bottom-6"
      >
        <MessageCircle size={20} className="text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-[900] w-[360px] max-h-[500px] bg-elevated border border-border-mid rounded-2xl shadow-2xl flex flex-col overflow-hidden md:bottom-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dim bg-surface/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-info to-conflicting flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <div>
            <span className="text-xs font-semibold text-text-primary">Ask AI</span>
            <span className="text-[9px] text-text-muted ml-1.5">Llama 3.3 70B</span>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-overlay rounded-lg transition-colors">
          <X size={15} className="text-text-muted" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[350px]">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-xl bg-overlay flex items-center justify-center mx-auto mb-3">
              <Bot size={20} className="text-text-muted" />
            </div>
            <p className="text-[11px] text-text-muted mb-4">Ask anything about stocks, markets, or your portfolio</p>
            <div className="space-y-2">
              {['What\'s the market mood today?', 'How is banking sector looking?', 'Any important news?', 'What\'s my performance?'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="block w-full text-left text-[11px] text-text-secondary bg-overlay border border-border-dim rounded-xl px-3.5 py-2.5 hover:border-info/30 hover:text-info transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 rounded-lg bg-info/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={12} className="text-info" />
              </div>
            )}
            <div className="max-w-[82%]">
              <div className={`rounded-xl px-3.5 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-info/12 border border-info/20 text-text-primary'
                  : msg.error
                  ? 'bg-sell/8 border border-sell/20 text-text-secondary'
                  : 'bg-overlay border border-border-dim text-text-secondary'
              }`}>
                <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              {msg.role === 'ai' && !msg.error && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(msg.text);
                    setCopiedIdx(i);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="flex items-center gap-1 mt-1 ml-2 text-[9px] text-text-muted hover:text-text-secondary transition-colors"
                >
                  {copiedIdx === i ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
                </button>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-lg bg-overlay flex items-center justify-center shrink-0 mt-0.5">
                <User size={12} className="text-text-muted" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-info/15 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-info" />
            </div>
            <div className="bg-overlay border border-border-dim rounded-xl px-4 py-3">
              <Spinner size={14} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-dim p-3 bg-surface/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about stocks, strategy..."
            className="flex-1 bg-base border border-border-dim rounded-xl px-4 py-2.5 text-xs text-text-primary outline-none focus:border-info focus:ring-1 focus:ring-info/20 placeholder:text-text-muted transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="px-3.5 py-2.5 rounded-xl bg-info text-white disabled:opacity-30 hover:bg-info/90 transition-all"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
