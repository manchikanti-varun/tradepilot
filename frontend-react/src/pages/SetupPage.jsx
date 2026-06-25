import { useState, useEffect } from 'react'
import { auth } from '../api'
import { Key, Shield, Zap, Check, ChevronRight, ExternalLink, Lock, AlertCircle, ArrowRight, Wifi, WifiOff, Clock } from 'lucide-react'

export default function SetupPage({ onComplete }) {
  const [groqKey, setGroqKey] = useState('')
  const [angelKey, setAngelKey] = useState('')
  const [angelClient, setAngelClient] = useState('')
  const [angelPassword, setAngelPassword] = useState('')
  const [angelTotp, setAngelTotp] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAngel, setShowAngel] = useState(false)

  useEffect(() => {
    auth.credentialsStatus().then(setStatus).catch(() => {})
  }, [])

  const handleGroqSave = async () => {
    if (!groqKey.trim()) return
    setLoading(true)
    setError('')
    try {
      await auth.saveGroqKey(groqKey.trim())
      setGroqKey('')
      const s = await auth.credentialsStatus()
      setStatus(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAngelSave = async () => {
    if (!angelKey || !angelClient || !angelPassword || !angelTotp) {
      setError('All Angel One fields are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await auth.saveBrokerCreds({
        angel_api_key: angelKey.trim(),
        angel_client_id: angelClient.trim(),
        angel_password: angelPassword.trim(),
        angel_totp_secret: angelTotp.trim(),
      })
      setAngelKey(''); setAngelClient(''); setAngelPassword(''); setAngelTotp('')
      setShowAngel(false)
      const s = await auth.credentialsStatus()
      setStatus(s)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isReady = status?.ready_to_trade

  return (
    <div className="min-h-screen bg-dark-900 px-4 py-8">
      <div className="max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-white mb-1">Setup Your API Keys</h1>
        <p className="text-gray-400 text-sm mb-6">Configure your keys to enable AI signals and market data.</p>

        {/* Status Banner */}
        {status && (
          <div className={`rounded-xl p-4 mb-6 border ${
            isReady ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {isReady ? <Check size={16} className="text-green-400" /> : <Zap size={16} className="text-amber-400" />}
              <span className={`text-sm font-medium ${isReady ? 'text-green-400' : 'text-amber-400'}`}>
                {status.message}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
              {status.data_mode === 'hybrid'
                ? <Wifi size={12} className="text-green-400" />
                : <Clock size={12} className="text-amber-400" />
              }
              <span>Data mode: {status.data_mode_label || status.data_mode}</span>
            </div>
          </div>
        )}

        {/* Step 1: Groq API Key (REQUIRED) */}
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Key size={18} className="text-accent-blue" />
            <h2 className="text-sm font-semibold text-white">Groq API Key</h2>
            <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">REQUIRED</span>
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Powers AI analysis — dual-model signals, morning briefs, coaching, loss classification.
            Free tier gives 30 calls/min which is enough for personal use.
          </p>

          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline mb-3">
            Get free key at console.groq.com <ExternalLink size={12} />
          </a>

          {status?.groq ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check size={16} /> Configured
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password" value={groqKey} onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxx"
                className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none"
              />
              <button onClick={handleGroqSave} disabled={loading || !groqKey.trim()}
                className="bg-accent-blue text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                Save
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Angel One (OPTIONAL) */}
        <div className="bg-dark-800 rounded-xl p-4 border border-dark-600 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-purple-400" />
            <h2 className="text-sm font-semibold text-white">Angel One Credentials</h2>
            <span className="ml-auto text-[10px] bg-dark-600 text-gray-400 px-2 py-0.5 rounded-full font-medium">OPTIONAL</span>
          </div>

          <p className="text-xs text-gray-400 mb-2">
            Enables real-time LTP and live market depth from Angel One SmartAPI.
            Without this, the system uses Yahoo Finance (1-2 min delay) which works fine for signal generation.
          </p>

          <div className="text-xs text-gray-500 mb-3 bg-dark-700 rounded-lg p-2.5 space-y-1.5">
            <div className="font-medium text-gray-300">How it works:</div>
            <div className="flex items-center gap-2">
              <WifiOff size={12} className="text-amber-400 shrink-0" />
              <span>Without Angel One — Yahoo Finance (delayed ~60s). You execute trades in any broker.</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi size={12} className="text-green-400 shrink-0" />
              <span>With Angel One — Real-time prices + live depth. You still execute trades manually.</span>
            </div>
          </div>

          {status?.angel_one ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check size={16} /> Angel One configured — Hybrid mode active
            </div>
          ) : (
            <>
              <button onClick={() => setShowAngel(!showAngel)}
                className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors">
                <ChevronRight size={14} className={`transition-transform ${showAngel ? 'rotate-90' : ''}`} />
                {showAngel ? 'Hide fields' : 'I have Angel One — configure real-time data'}
              </button>

              {showAngel && (
                <div className="mt-3 space-y-2">
                  <input type="text" value={angelKey} onChange={(e) => setAngelKey(e.target.value)}
                    placeholder="API Key" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none" />
                  <input type="text" value={angelClient} onChange={(e) => setAngelClient(e.target.value)}
                    placeholder="Client ID" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none" />
                  <input type="password" value={angelPassword} onChange={(e) => setAngelPassword(e.target.value)}
                    placeholder="Password" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none" />
                  <input type="text" value={angelTotp} onChange={(e) => setAngelTotp(e.target.value)}
                    placeholder="TOTP Secret" className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-blue focus:outline-none" />
                  <button onClick={handleAngelSave} disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    Save Angel One Credentials
                  </button>
                  <p className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
                    <Lock size={10} /> Encrypted with AES-256 at rest. Never stored in plain text.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={onComplete}
          disabled={!isReady}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            isReady
              ? 'bg-accent-blue hover:bg-blue-600 text-white'
              : 'bg-dark-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isReady ? (<>Start Trading <ArrowRight size={16} /></>) : 'Add Groq API key to continue'}
        </button>

        {!isReady && (
          <p className="text-center text-[11px] text-gray-500 mt-3">
            Angel One is optional. You only need the Groq key to start.
          </p>
        )}
      </div>
    </div>
  )
}
