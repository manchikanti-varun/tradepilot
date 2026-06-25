import { useState } from 'react'
import { auth, setTokens, setStoredUser } from '../api'
import { Zap, Eye, EyeOff, AlertCircle, Loader2, TrendingUp, Shield, BarChart3 } from 'lucide-react'

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let res
      if (mode === 'signup') {
        res = await auth.signup(email, password, name)
      } else {
        res = await auth.login(email, password)
      }

      setTokens(res.access_token, res.refresh_token)
      setStoredUser(res.user)
      onLogin(res.user)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Zap size={28} className="text-accent-blue" />
            <h1 className="text-2xl font-bold text-white">TradePilot AI</h1>
          </div>
          <p className="text-gray-400 text-sm">NSE Intraday Trading Co-Pilot</p>
        </div>

        {/* Card */}
        <div className="bg-dark-800 rounded-2xl p-6 border border-dark-600">
          {/* Toggle */}
          <div className="flex bg-dark-700 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-accent-blue text-white' : 'text-gray-400'
              }`}
            >Login</button>
            <button
              onClick={() => { setMode('signup'); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-accent-blue text-white' : 'text-gray-400'
              }`}
            >Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-white text-sm focus:border-accent-blue focus:outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-white text-sm focus:border-accent-blue focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min 8 characters' : 'Your password'}
                  className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-white text-sm focus:border-accent-blue focus:outline-none pr-10"
                  required minLength={mode === 'signup' ? 8 : 1}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-accent-blue hover:bg-blue-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Login'}
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="text-center">
            <TrendingUp size={18} className="text-green-400 mx-auto mb-1" />
            <p className="text-gray-500 text-[10px]">200+ NSE Stocks</p>
          </div>
          <div className="text-center">
            <BarChart3 size={18} className="text-accent-blue mx-auto mb-1" />
            <p className="text-gray-500 text-[10px]">AI-Powered Signals</p>
          </div>
          <div className="text-center">
            <Shield size={18} className="text-purple-400 mx-auto mb-1" />
            <p className="text-gray-500 text-[10px]">Charge-Aware P&L</p>
          </div>
        </div>
      </div>
    </div>
  )
}
