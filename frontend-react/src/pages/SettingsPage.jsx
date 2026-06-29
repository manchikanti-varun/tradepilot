import { useState, useEffect } from 'react';
import { Settings, ChevronDown, ChevronRight, Save, CheckCircle2, LogOut, Key, Shield, Bell } from 'lucide-react';
import { settingsApi } from '../api/settings';
import { authApi } from '../api/auth';
import { useAppStore } from '../store/useAppStore';
import { clearTokens } from '../api/client';
import SectionLabel from '../components/shared/SectionLabel';
import Badge from '../components/shared/Badge';
import Spinner from '../components/shared/Spinner';
import ErrorState from '../components/shared/ErrorState';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [credStatus, setCredStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    settingsApi.getAll().then((r) => setSettings(r.settings)).catch((e) => setError(e.message));
    authApi.credentialsStatus().then(setCredStatus).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await settingsApi.saveAll(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setSaving(false);
  };

  const handleLogout = () => {
    clearTokens();
    useAppStore.getState().setAuthenticated(false);
    useAppStore.getState().setUser(null);
  };

  if (error && !settings) return <div className="p-4"><ErrorState message="Failed to load settings" /></div>;
  if (!settings) return <div className="p-4 flex justify-center py-12"><Spinner size={20} /></div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Settings</SectionLabel>
        <button onClick={handleSave} disabled={saving} className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-colors duration-100 ${
          saved ? 'bg-buy/15 text-buy border border-buy/30' : 'bg-info text-white'
        }`}>
          {saved ? <><CheckCircle2 size={11} /> Saved</> : <><Save size={11} /> {saving ? 'Saving...' : 'Save'}</>}
        </button>
      </div>

      {/* Capital */}
      <CollapsibleSection title="Capital & Growth" icon={Shield} defaultOpen={true}>
        <div className="space-y-2">
          <label className="text-[11px] text-text-secondary block">Current Capital (₹)</label>
          <input
            type="number"
            value={settings.current_capital || ''}
            onChange={(e) => setSettings({ ...settings, current_capital: e.target.value })}
            placeholder="10000"
            className="w-full bg-base border border-border-dim rounded-lg px-4 py-3 text-lg font-mono text-text-primary outline-none focus:border-info [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => {
              const val = parseFloat(settings.current_capital);
              if (val >= 1000) {
                settingsApi.setCapital(val).then(() => {
                  useAppStore.getState().addToast({ type: 'success', message: `Capital set to ₹${val.toLocaleString()}` });
                }).catch((e) => {
                  useAppStore.getState().addToast({ type: 'error', message: e.message });
                });
              } else {
                useAppStore.getState().addToast({ type: 'error', message: 'Min ₹1,000' });
              }
            }}
            className="w-full py-2 rounded bg-info/15 border border-info/30 text-xs text-info font-medium hover:bg-info/25 transition-colors"
          >
            Update Capital
          </button>
          <div className="text-[10px] text-text-muted">Min ₹1,000. Tier adjusts automatically. Enter your actual broker balance.</div>
        </div>
      </CollapsibleSection>

      {/* Risk */}
      <CollapsibleSection title="Risk Management" icon={Shield}>
        <SettingRow label="Max risk per trade (%)" value={settings.max_risk_pct} onChange={(v) => setSettings({ ...settings, max_risk_pct: v })} />
        <SettingRow label="Daily loss cap (₹)" value={settings.daily_loss_cap} onChange={(v) => setSettings({ ...settings, daily_loss_cap: v })} />
        <SettingRow label="Max trades per day" value={settings.max_trades_per_day} onChange={(v) => setSettings({ ...settings, max_trades_per_day: v })} />
        <SettingRow label="Max consecutive losses" value={settings.max_consecutive_losses} onChange={(v) => setSettings({ ...settings, max_consecutive_losses: v })} />
      </CollapsibleSection>

      {/* Signals */}
      <CollapsibleSection title="Signal Preferences" icon={Settings}>
        <SettingRow label="Min signal score" value={settings.min_signal_score} onChange={(v) => setSettings({ ...settings, min_signal_score: v })} />
        <SettingRow label="VIX halt threshold" value={settings.vix_halt_threshold} onChange={(v) => setSettings({ ...settings, vix_halt_threshold: v })} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-secondary">Grade filter</span>
          <select value={settings.grade_filter || 'A+,A,B'} onChange={(e) => setSettings({ ...settings, grade_filter: e.target.value })}
            className="bg-base border border-border-dim rounded px-2 py-1 text-xs text-text-primary outline-none">
            <option value="A+,A,B">A+, A, B</option>
            <option value="A+,A">A+, A only</option>
            <option value="A+,A,B,C">All grades</option>
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-secondary">Scan interval</span>
          <select value={settings.scan_interval_sec || '90'} onChange={(e) => setSettings({ ...settings, scan_interval_sec: e.target.value })}
            className="bg-base border border-border-dim rounded px-2 py-1 text-xs text-text-primary outline-none">
            <option value="60">Every 1 min</option>
            <option value="90">Every 1.5 min</option>
            <option value="120">Every 2 min</option>
            <option value="180">Every 3 min</option>
            <option value="300">Every 5 min</option>
          </select>
        </div>
      </CollapsibleSection>

      {/* Notifications */}
      <CollapsibleSection title="Notifications" icon={Bell}>
        <ToggleRow label="In-app notifications" value={settings.notifications_enabled === 'true'} onChange={(v) => setSettings({ ...settings, notifications_enabled: v ? 'true' : 'false' })} />
        <ToggleRow label="Sound alerts" value={settings.sound_enabled === 'true'} onChange={(v) => setSettings({ ...settings, sound_enabled: v ? 'true' : 'false' })} />
        <ToggleRow label="Vibration (mobile)" value={settings.vibration_enabled === 'true'} onChange={(v) => setSettings({ ...settings, vibration_enabled: v ? 'true' : 'false' })} />
      </CollapsibleSection>

      {/* API Keys */}
      <CollapsibleSection title="API Keys" icon={Key}>
        <ApiKeySection credStatus={credStatus} onRefresh={() => authApi.credentialsStatus().then(setCredStatus)} />
      </CollapsibleSection>

      {/* Account */}
      <CollapsibleSection title="Account" icon={Shield}>
        {user && (
          <div className="space-y-1 text-[11px] mb-3">
            <div className="flex justify-between"><span className="text-text-muted">Email</span><span className="text-text-secondary">{user.email}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Name</span><span className="text-text-secondary">{user.name}</span></div>
          </div>
        )}
        <PasswordChangeSection />
        <div className="mt-2">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded bg-sell/10 border border-sell/30 text-xs text-sell font-medium hover:bg-sell/20 transition-colors duration-100">
            <LogOut size={12} /> Logout
          </button>
        </div>
      </CollapsibleSection>

      {/* About */}
      <div className="bg-surface border border-border-dim rounded-lg p-4 text-center">
        <p className="text-sm font-medium text-text-primary">TradePilot AI</p>
        <p className="text-[11px] text-text-secondary mt-1">NSE Intraday Trading Co-Pilot</p>
        <p className="text-[10px] text-text-muted mt-0.5">Manual execution · AI-powered signals · Zero auto-trading</p>
        <div className="flex items-center justify-center gap-3 mt-3 text-[9px] text-text-muted">
          <span>v2.0.0</span>
          <span>·</span>
          <span>27 engines</span>
          <span>·</span>
          <span>200+ stocks</span>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-surface border border-border-dim rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-overlay transition-colors duration-100">
        <Icon size={13} className="text-text-muted" />
        <span className="text-xs font-medium text-text-primary flex-1">{title}</span>
        {open ? <ChevronDown size={12} className="text-text-muted" /> : <ChevronRight size={12} className="text-text-muted" />}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

function SettingRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <input type="number" value={value || ''} onChange={(e) => onChange(e.target.value)}
        className="w-24 bg-base border border-border-dim rounded px-3 py-1.5 text-xs text-text-primary font-mono text-right outline-none focus:border-info [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <button onClick={() => onChange(!value)} className={`w-9 h-5 rounded-full relative transition-colors duration-100 ${value ? 'bg-info' : 'bg-border-mid'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-100 ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function ApiKeySection({ credStatus, onRefresh }) {
  const [groqKey, setGroqKey] = useState('');
  const [groqKey2, setGroqKey2] = useState('');
  const [showGroq, setShowGroq] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleGroqSave = async () => {
    if (!groqKey.trim()) return;
    setSaving(true);
    try {
      await authApi.saveGroqKey(groqKey.trim(), groqKey2.trim() || null);
      setGroqKey('');
      setGroqKey2('');
      setShowGroq(false);
      onRefresh();
      useAppStore.getState().addToast({ type: 'success', message: 'Groq key(s) updated' });
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 text-[11px]">
      {/* Groq */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Groq API Keys</span>
          <div className="flex items-center gap-2">
            {credStatus?.groq ? <Badge variant="buy">Active</Badge> : <Badge variant="sell">Not set</Badge>}
            <button onClick={() => setShowGroq(!showGroq)} className="text-[10px] text-info hover:underline">
              {showGroq ? 'Hide' : 'Change'}
            </button>
          </div>
        </div>
        {showGroq && (
          <div className="space-y-2 mt-2">
            <div>
              <label className="text-[9px] text-text-muted block mb-1">Key 1 — Llama Scout (fast model)</label>
              <input type="password" value={groqKey} onChange={(e) => setGroqKey(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxx"
                className="w-full bg-base border border-border-dim rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-info" />
            </div>
            <div>
              <label className="text-[9px] text-text-muted block mb-1">Key 2 — Llama 70B (second opinion, different account)</label>
              <input type="password" value={groqKey2} onChange={(e) => setGroqKey2(e.target.value)}
                placeholder="gsk_xxxxxxxxxxxx (optional — avoids rate limit)"
                className="w-full bg-base border border-border-dim rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-info" />
            </div>
            <button onClick={handleGroqSave} disabled={saving || !groqKey.trim()}
              className="w-full py-2 bg-info text-white rounded text-xs font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Keys'}
            </button>
            <p className="text-[9px] text-text-muted">Use 2 different Groq accounts for both models to respond without rate limits. Get free key at console.groq.com</p>
          </div>
        )}
      </div>

      {/* Angel One */}
      <div className="flex items-center justify-between">
        <span className="text-text-secondary">Angel One</span>
        {credStatus?.angel_one ? <Badge variant="buy">Hybrid</Badge> : <Badge variant="neutral">Yahoo Only</Badge>}
      </div>
      <p className="text-[10px] text-text-muted">Angel One credentials can be updated in the Setup wizard.</p>
    </div>
  );
}

function PasswordChangeSection() {
  const [show, setShow] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (newPw.length < 8) {
      useAppStore.getState().addToast({ type: 'error', message: 'Min 8 characters' });
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      useAppStore.getState().addToast({ type: 'success', message: 'Password changed' });
      setShow(false);
      setCurrentPw('');
      setNewPw('');
    } catch (e) {
      useAppStore.getState().addToast({ type: 'error', message: e.message });
    }
    setLoading(false);
  };

  if (!show) {
    return (
      <button onClick={() => setShow(true)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded bg-overlay border border-border-dim text-xs text-text-secondary font-medium hover:border-border-mid transition-colors duration-100">
        Change Password
      </button>
    );
  }

  return (
    <div className="space-y-2 bg-base rounded-lg p-3 border border-border-dim">
      <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
        placeholder="Current password"
        className="w-full bg-surface border border-border-dim rounded px-3 py-2 text-xs text-text-primary outline-none" />
      <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
        placeholder="New password (min 8 chars)"
        className="w-full bg-surface border border-border-dim rounded px-3 py-2 text-xs text-text-primary outline-none" />
      <div className="flex gap-2">
        <button onClick={handleChange} disabled={loading || !currentPw || !newPw}
          className="flex-1 py-2 bg-info text-white rounded text-xs font-medium disabled:opacity-50">
          {loading ? 'Saving...' : 'Update'}
        </button>
        <button onClick={() => { setShow(false); setCurrentPw(''); setNewPw(''); }}
          className="px-3 py-2 bg-overlay text-text-muted rounded text-xs">Cancel</button>
      </div>
    </div>
  );
}
