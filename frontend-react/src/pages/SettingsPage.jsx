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

      {/* Risk */}
      <CollapsibleSection title="Capital & Risk" icon={Shield}>
        <SettingRow label="Max risk per trade (%)" value={settings.max_risk_pct} onChange={(v) => setSettings({ ...settings, max_risk_pct: v })} />
        <SettingRow label="Daily loss cap (₹)" value={settings.daily_loss_cap} onChange={(v) => setSettings({ ...settings, daily_loss_cap: v })} />
        <SettingRow label="Max trades per day" value={settings.max_trades_per_day} onChange={(v) => setSettings({ ...settings, max_trades_per_day: v })} />
        <SettingRow label="Max consecutive losses" value={settings.max_consecutive_losses} onChange={(v) => setSettings({ ...settings, max_consecutive_losses: v })} />
      </CollapsibleSection>

      {/* Signals */}
      <CollapsibleSection title="Signal Preferences" icon={Settings}>
        <SettingRow label="Min signal score" value={settings.min_signal_score} onChange={(v) => setSettings({ ...settings, min_signal_score: v })} />
        <SettingRow label="VIX halt threshold" value={settings.vix_halt_threshold} onChange={(v) => setSettings({ ...settings, vix_halt_threshold: v })} />
      </CollapsibleSection>

      {/* Notifications */}
      <CollapsibleSection title="Notifications" icon={Bell}>
        <ToggleRow label="Sound alerts" value={settings.sound_enabled === 'true'} onChange={(v) => setSettings({ ...settings, sound_enabled: v ? 'true' : 'false' })} />
        <ToggleRow label="Vibration" value={settings.vibration_enabled === 'true'} onChange={(v) => setSettings({ ...settings, vibration_enabled: v ? 'true' : 'false' })} />
      </CollapsibleSection>

      {/* API Keys */}
      <CollapsibleSection title="API Keys" icon={Key}>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Groq API Key</span>
            {credStatus?.groq ? <Badge variant="buy">Active</Badge> : <Badge variant="sell">Not set</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Angel One</span>
            {credStatus?.angel_one ? <Badge variant="buy">Hybrid</Badge> : <Badge variant="neutral">Yahoo Only</Badge>}
          </div>
        </div>
      </CollapsibleSection>

      {/* Account */}
      <CollapsibleSection title="Account" icon={Shield}>
        {user && (
          <div className="space-y-1 text-[11px] mb-3">
            <div className="flex justify-between"><span className="text-text-muted">Email</span><span className="text-text-secondary">{user.email}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Name</span><span className="text-text-secondary">{user.name}</span></div>
          </div>
        )}
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-2 rounded bg-sell/10 border border-sell/30 text-xs text-sell font-medium hover:bg-sell/20 transition-colors duration-100">
          <LogOut size={12} /> Logout
        </button>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(false);
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
        className="w-16 bg-base border border-border-dim rounded px-2 py-1 text-xs text-text-primary font-mono text-center outline-none focus:border-border-mid" />
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
