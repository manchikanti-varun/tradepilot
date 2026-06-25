import { useState, useEffect } from 'react'
import { Settings, Wallet, Shield, Bell, Palette, Save, RefreshCw, CheckCircle2 } from 'lucide-react'
import { api, formatCurrency } from '../api'

export default function SettingsPage({ growth, onCapitalUpdate }) {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')

  useEffect(() => {
    api.getSettings().then(res => setSettings(res.settings)).catch(() => {})
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
    if (val >= 1000 && val <= 100000) {
      onCapitalUpdate(val)
      setCapitalInput('')
    }
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
            <option value="120">Every 2 min</option>
            <option value="180">Every 3 min (default)</option>
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

      {/* About */}
      <div className="bg-dark-700 border border-dark-600 rounded-xl p-4 text-center">
        <p className="text-sm font-bold text-white">TradePilot AI v3.4</p>
        <p className="text-[11px] text-gray-500 mt-1">Manual execution co-pilot • Angel One SmartAPI</p>
        <p className="text-[10px] text-gray-600 mt-0.5">Real-time data • Zero auto-trading</p>
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
