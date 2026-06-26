import { useState, useEffect } from 'react'
import { Settings, Wallet, Shield, Bell, Palette, Save, RefreshCw, CheckCircle2, Key, Wifi, WifiOff, Clock, LogOut, Lock, ExternalLink, Check } from 'lucide-react'
import { api, auth, formatCurrency } from '../api'

export default function SettingsPage({ growth, onCapitalUpdate, user, onLogout }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')
  const [credStatus, setCredStatus] = useState(null)
  const [showGroqEdit, setShowGroqEdit] = useState(false)
  const [showAngelEdit, setShowAngelEdit] = useState(false)
  const [groqKey, setGroqKey] = useState('')
  const [angelKey, setAngelKey] = useState('')
  const [angelClient, setAngelClient] = useState('')
  const [angelPassword, setAngelPassword] = useState('')
  const [angelTotp, setAngelTotp] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credMsg, setCredMsg] = useState('')

  useEffect(() => {
    api.getSettings().then(res => setSettings(res.settings)).catch(() => {})
    auth.credentialsStatus().then(setCredStatus).catch(() => {})
  }, [])

  const updateLocal = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await api.saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Save failed', e)
    }
    setSaving(false)
  }

  const handleCapitalSave = () => {
    const val = parseFloat(capitalInput)
    if (val >= 1000) {
      onCapitalUpdate(val)
      setCapitalInput('')
    }
  }

  const handleGroqSave = async () => {
    if (!groqKey.trim()) return
    setCredSaving(true); setCredMsg('')
    try {
      await auth.saveGroqKey(groqKey.trim())
      setGroqKey(''); setShowGroqEdit(false)
      setCredStatus(await auth.credentialsStatus())
      setCredMsg('Groq key updated')
      setTimeout(() => setCredMsg(''), 3000)
    } catch (e) { setCredMsg(e.message) }
    setCredSaving(false)
  }

  const handleAngelSave = async () => {
    if (!angelKey || !angelClient || !angelPassword || !angelTotp) { setCredMsg('All fields required'); return }
    setCredSaving(true); setCredMsg('')
    try {
      await auth.saveBrokerCreds({
        angel_api_key: angelKey.trim(),
        angel_client_id: angelClient.trim(),
        angel_password: angelPassword.trim(),
        angel_totp_secret: angelTotp.trim(),
      })
      setAngelKey(''); setAngelClient(''); setAngelPassword(''); setAngelTotp('')
      setShowAngelEdit(false)
      setCredStatus(await auth.credentialsStatus())
      setCredMsg('Angel One credentials updated')
      setTimeout(() => setCredMsg(''), 3000)
    } catch (e) { setCredMsg(e.message) }
    setCredSaving(false)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    )
  }

  return (
    <div className="py-4 space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-accent-blue" />
          <h2 className="text-base font-bold">Settings</h2>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            saved ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-accent-blue text-white hover:opacity-90'
          }`}>
          {saved ? <><CheckCircle2 size={12} /> Saved</> : <><Save size={12} /> {saving ? 'Saving...' : 'Save All'}</>}
        </button>
      </div>

      {/* Capital */}
      <Section icon={Wallet} title="Capital" color="text-accent-blue">
        <div className="text-2xl font-extrabold mb-3">
          {growth ? formatCurrency(growth.current_capital) : '—'}
          <span className="text-xs text-gray-500 ml-2">Tier {growth?.current_tier || '?'}</span>
        </div>
        <div className="flex gap-2">
          <input type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
            placeholder="New capital (₹)" min="1000" max="100000" step="500"
            className="flex-1 bg-dark-900 border border-dark-500 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-accent-blue"
          />
          <button onClick={handleCapitalSave} disabled={!capitalInput || parseFloat(capitalInput) < 1000}
            className="px-4 py-2.5 bg-accent-blue text-white rounded-lg text-xs font-bold disabled:opacity-30">
            Set
          </button>
        </div>
      </Section>

      {/* Risk */}
      <Section icon={Shield} title="Risk Management" color="text-amber-400">
        <SettingRow label="Max risk per trade (%)" sublabel="Stop loss cap as % of capital">
          <NumberInput value={settings.max_risk_pct} onChange={v => updateLocal('max_risk_pct', v)}
            min={1} max={20} step={1} suffix="%" />
        </SettingRow>
        <SettingRow label="Daily loss cap (₹)" sublabel="Stop trading after this daily loss">
          <NumberInput value={settings.daily_loss_cap} onChange={v => updateLocal('daily_loss_cap', v)}
            min={100} max={5000} step={50} suffix="₹" />
        </SettingRow>
        <SettingRow label="Max trades per day" sublabel="Hard stop after this many trades">
          <NumberInput value={settings.max_trades_per_day} onChange={v => updateLocal('max_trades_per_day', v)}
            min={1} max={10} step={1} />
        </SettingRow>
        <SettingRow label="Max consecutive losses" sublabel="Halt after this loss streak">
          <NumberInput value={settings.max_consecutive_losses} onChange={v => updateLocal('max_consecutive_losses', v)}
            min={1} max={10} step={1} />
        </SettingRow>
        <SettingRow label="VIX halt threshold" sublabel="No trades when VIX exceeds this">
          <NumberInput value={settings.vix_halt_threshold} onChange={v => updateLocal('vix_halt_threshold', v)}
            min={15} max={40} step={1} />
        </SettingRow>
      </Section>

      {/* Signals */}
      <Section icon={Settings} title="Signal Preferences" color="text-purple-400">
        <SettingRow label="Minimum signal score" sublabel="Only show signals scoring above this">
          <NumberInput value={settings.min_signal_score} onChange={v => updateLocal('min_signal_score', v)}
            min={50} max={90} step={5} suffix="/100" />
        </SettingRow>
        <SettingRow label="Grade filter" sublabel="Which grades to include in signals">
          <select value={settings.grade_filter} onChange={e => updateLocal('grade_filter', e.target.value)}
            className="bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none">
            <option value="A+,A,B">A+, A, B (recommended)</option>
            <option value="A+,A">A+, A only (strict)</option>
            <option value="A+,A,B,C">All grades</option>
          </select>
        </SettingRow>
        <SettingRow label="Scan interval" sublabel="How often to scan for signals">
          <select value={settings.scan_interval_sec} onChange={e => updateLocal('scan_interval_sec', e.target.value)}
            className="bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none">
            <option value="60">Every 1 min</option>
            <option value="90">Every 1.5 min (default)</option>
            <option value="120">Every 2 min</option>
            <option value="180">Every 3 min</option>
            <option value="300">Every 5 min</option>
          </select>
        </SettingRow>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications" color="text-green-400">
        <SettingRow label="In-app notifications">
          <Toggle value={settings.notifications_enabled === 'true'}
            onChange={v => updateLocal('notifications_enabled', v ? 'true' : 'false')} />
        </SettingRow>
        <SettingRow label="Sound alerts">
          <Toggle value={settings.sound_enabled === 'true'}
            onChange={v => updateLocal('sound_enabled', v ? 'true' : 'false')} />
        </SettingRow>
        <SettingRow label="Vibration (mobile)">
          <Toggle value={settings.vibration_enabled === 'true'}
            onChange={v => updateLocal('vibration_enabled', v ? 'true' : 'false')} />
        </SettingRow>
      </Section>

      {/* Display */}
      <Section icon={Palette} title="Display" color="text-cyan-400">
        <SettingRow label="Compact mode" sublabel="More data, less spacing">
          <Toggle value={settings.compact_mode === 'true'}
            onChange={v => updateLocal('compact_mode', v ? 'true' : 'false')} />
        </SettingRow>
      </Section>

      {/* Credentials & API Keys */}
      <Section icon={Key} title="API Keys & Credentials" color="text-accent-blue">
        {/* Data Mode Status */}
        {credStatus && (
          <div className="flex items-center gap-2 text-xs mb-3 bg-dark-900 rounded-lg px-3 py-2">
            {credStatus.data_mode === 'hybrid'
              ? <Wifi size={13} className="text-green-400" />
              : <Clock size={13} className="text-amber-400" />}
            <span className="text-gray-300">{credStatus.data_mode_label || credStatus.data_mode}</span>
          </div>
        )}

        {/* Groq API Key */}
        <div className="border-b border-dark-500 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-200 font-medium">Groq API Key</p>
              <p className="text-[10px] text-gray-500">Powers AI analysis & signals</p>
            </div>
            {credStatus?.groq ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-green-400"><Check size={10} /> Active</span>
                <button onClick={() => setShowGroqEdit(!showGroqEdit)}
                  className="text-[10px] text-accent-blue hover:underline">Change</button>
              </div>
            ) : (
              <button onClick={() => setShowGroqEdit(true)}
                className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded">Not set</button>
            )}
          </div>
          {showGroqEdit && (
            <div className="flex gap-2 mt-2">
              <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxx"
                className="flex-1 bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
              <button onClick={handleGroqSave} disabled={credSaving || !groqKey.trim()}
                className="px-3 py-2 bg-accent-blue text-white rounded-lg text-xs font-medium disabled:opacity-50">Save</button>
            </div>
          )}
        </div>

        {/* Angel One */}
        <div className="pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-200 font-medium">Angel One</p>
              <p className="text-[10px] text-gray-500">Optional — real-time data only, not for placing orders</p>
            </div>
            {credStatus?.angel_one ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-green-400"><Wifi size={10} /> Hybrid</span>
                <button onClick={() => setShowAngelEdit(!showAngelEdit)}
                  className="text-[10px] text-accent-blue hover:underline">Change</button>
              </div>
            ) : (
              <button onClick={() => setShowAngelEdit(!showAngelEdit)}
                className="text-[10px] text-gray-400 bg-dark-600 px-2 py-1 rounded">{showAngelEdit ? 'Hide' : 'Add'}</button>
            )}
          </div>
          {showAngelEdit && (
            <div className="mt-2 space-y-2">
              <input type="text" value={angelKey} onChange={e => setAngelKey(e.target.value)}
                placeholder="API Key" className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
              <input type="text" value={angelClient} onChange={e => setAngelClient(e.target.value)}
                placeholder="Client ID" className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
              <input type="password" value={angelPassword} onChange={e => setAngelPassword(e.target.value)}
                placeholder="Password" className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
              <input type="text" value={angelTotp} onChange={e => setAngelTotp(e.target.value)}
                placeholder="TOTP Secret" className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
              <button onClick={handleAngelSave} disabled={credSaving}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-xs font-medium disabled:opacity-50">
                {credStatus?.angel_one ? 'Update' : 'Save'} Angel One Credentials
              </button>
              <p className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
                <Lock size={9} /> Encrypted at rest with AES-256
              </p>
            </div>
          )}
        </div>

        {credMsg && (
          <p className={`text-[10px] mt-2 ${credMsg.includes('updated') || credMsg.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>
            {credMsg}
          </p>
        )}
      </Section>

      {/* Account */}
      <Section icon={Shield} title="Account" color="text-gray-400">
        {user && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Email</span>
              <span className="text-xs text-gray-200">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Name</span>
              <span className="text-xs text-gray-200">{user.name}</span>
            </div>
          </div>
        )}

        {/* Password Change */}
        <PasswordChangeForm />

        <button onClick={onLogout}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 font-medium hover:bg-red-500/20 transition-colors">
          <LogOut size={14} /> Logout
        </button>
      </Section>

      {/* About */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 text-center">
        <p className="text-sm font-bold text-white">TradePilot AI</p>
        <p className="text-[11px] text-gray-500 mt-1">Manual execution co-pilot &middot; AI-powered signals</p>
        <p className="text-[10px] text-gray-600 mt-0.5">Real-time data &middot; Zero auto-trading</p>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-dark-700 border border-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className={color} />
        <span className="text-sm font-bold">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SettingRow({ label, sublabel, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 font-medium">{label}</p>
        {sublabel && <p className="text-[10px] text-gray-500">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function NumberInput({ value, onChange, min, max, step, suffix }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step}
        className="w-16 bg-dark-900 border border-dark-500 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-accent-blue"
      />
      {suffix && <span className="text-[10px] text-gray-500">{suffix}</span>}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-accent-blue' : 'bg-dark-500'}`}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
        value ? 'translate-x-5' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

function PasswordChangeForm() {
  const [show, setShow] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('')

  const handleChange = async () => {
    if (newPw.length < 8) { setMsg('New password must be at least 8 characters'); setMsgType('error'); return }
    if (newPw !== confirmPw) { setMsg('Passwords do not match'); setMsgType('error'); return }
    setLoading(true); setMsg('')
    try {
      await auth.changePassword(currentPw, newPw)
      setMsg('Password changed successfully')
      setMsgType('success')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setShow(false); setMsg('') }, 2000)
    } catch (err) {
      setMsg(err.message || 'Failed to change password')
      setMsgType('error')
    }
    setLoading(false)
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-dark-600 border border-dark-500 rounded-lg text-xs text-gray-300 font-medium hover:bg-dark-500 transition-colors">
        <Lock size={12} /> Change Password
      </button>
    )
  }

  return (
    <div className="mt-3 space-y-2 bg-dark-900 rounded-lg p-3 border border-dark-500">
      <p className="text-xs text-gray-300 font-medium">Change Password</p>
      <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
        placeholder="Current password"
        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
      <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
        placeholder="New password (min 8 chars)"
        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
      <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
        placeholder="Confirm new password"
        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-blue" />
      {msg && (
        <p className={`text-[10px] ${msgType === 'success' ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>
      )}
      <div className="flex gap-2">
        <button onClick={handleChange} disabled={loading || !currentPw || !newPw || !confirmPw}
          className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-xs font-medium disabled:opacity-50">
          {loading ? 'Saving...' : 'Update Password'}
        </button>
        <button onClick={() => { setShow(false); setMsg('') }}
          className="px-3 py-2 bg-dark-700 text-gray-400 rounded-lg text-xs">
          Cancel
        </button>
      </div>
    </div>
  )
}
