import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink, Lock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight,
} from 'lucide-react';
import FormField from '../components/shared/FormField';
import PrimaryButton from '../components/shared/PrimaryButton';
import Spinner from '../components/shared/Spinner';
import Badge from '../components/shared/Badge';
import { authApi } from '../api/auth';
import { useAppStore } from '../store/useAppStore';

export default function SetupPage() {
  const navigate = useNavigate();
  const setNeedsSetup = useAppStore((s) => s.setNeedsSetup);

  const [step, setStep] = useState(1);
  const [credStatus, setCredStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Step 1 state
  const [groqKey, setGroqKey] = useState('');
  const [groqStatus, setGroqStatus] = useState(null); // null | 'testing' | 'success' | 'error'
  const [groqError, setGroqError] = useState('');
  const [groqSaving, setGroqSaving] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  // Step 2 state
  const [clientId, setClientId] = useState('');
  const [clientPin, setClientPin] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [angelStatus, setAngelStatus] = useState(null); // null | 'saving' | 'success' | 'error'
  const [angelError, setAngelError] = useState('');
  const [angelSaving, setAngelSaving] = useState(false);

  // Load existing credentials status
  useEffect(() => {
    authApi.credentialsStatus()
      .then((s) => {
        setCredStatus(s);
        if (s.groq) setGroqStatus('success');
        if (s.angel_one) setAngelStatus('success');
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  const groqReady = groqStatus === 'success' || credStatus?.groq;

  // ─── Step 1: Save & Test Groq Key ─────────────────────────

  async function handleGroqSave() {
    if (!groqKey.trim() && !groqReady) return;

    setGroqSaving(true);
    setGroqStatus('testing');
    setGroqError('');

    try {
      await authApi.saveGroqKey(groqKey.trim());
      setGroqStatus('success');
      setGroqKey('');
      // Refresh cred status
      const s = await authApi.credentialsStatus();
      setCredStatus(s);
    } catch (e) {
      setGroqStatus('error');
      setGroqError(e.message || 'Invalid key — check and try again');
    } finally {
      setGroqSaving(false);
    }
  }

  function handleGroqKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGroqSave();
    }
  }

  // ─── Step 2: Save Angel One Credentials ───────────────────

  async function handleAngelSave() {
    if (!clientId || !clientPin || !totpSecret || !apiKey) {
      setAngelError('All fields are required');
      return;
    }

    setAngelSaving(true);
    setAngelStatus('saving');
    setAngelError('');

    try {
      await authApi.saveBrokerCreds({
        angel_api_key: apiKey.trim(),
        angel_client_id: clientId.trim(),
        angel_password: clientPin.trim(),
        angel_totp_secret: totpSecret.trim(),
      });
      setAngelStatus('success');
      setClientId('');
      setClientPin('');
      setTotpSecret('');
      setApiKey('');
      const s = await authApi.credentialsStatus();
      setCredStatus(s);
    } catch (e) {
      setAngelStatus('error');
      setAngelError(e.message || 'Failed to save credentials');
    } finally {
      setAngelSaving(false);
    }
  }

  // ─── Complete Setup ────────────────────────────────────────

  function handleComplete() {
    setNeedsSetup(false);
    navigate('/dashboard', { replace: true });
  }

  // ─── Loading ───────────────────────────────────────────────

  if (loadingStatus) {
    return (
      <div className="w-full max-w-[480px] flex items-center justify-center py-20">
        <Spinner size={20} />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────

  const progressWidth = step === 1 ? '50%' : '100%';

  return (
    <div className="w-full max-w-[480px]">
      {/* Card */}
      <div className="bg-surface border border-border-dim rounded-xl p-8">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-text-muted font-medium">
            Step {step} of 2
          </span>
        </div>
        <div className="h-1 w-full bg-elevated rounded-sm overflow-hidden mb-6">
          <div
            className="h-full bg-buy rounded-sm transition-all duration-300"
            style={{ width: progressWidth }}
          />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Connect AI Engine</h2>
            <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
              TradePilot uses Groq to run dual AI analysis on every stock.
              Your key is encrypted and stored securely.
            </p>

            <div className="mt-6">
              <FormField
                label="Groq API Key"
                type="password"
                value={groqKey}
                onChange={(v) => { setGroqKey(v); setGroqStatus(null); setGroqError(''); }}
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                showToggle
                disabled={groqReady}
                onKeyDown={handleGroqKeyDown}
              />

              {/* Get key link */}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-info hover:underline mt-2"
              >
                Get your free key <ExternalLink size={12} />
              </a>

              {/* Status badge */}
              {groqStatus && (
                <div className="mt-3">
                  {groqStatus === 'testing' && (
                    <StatusPill variant="watch" icon={<Spinner size={12} />} text="Testing..." />
                  )}
                  {groqStatus === 'success' && (
                    <StatusPill variant="buy" icon={<CheckCircle2 size={12} />} text="Connected" />
                  )}
                  {groqStatus === 'error' && (
                    <StatusPill variant="sell" icon={<XCircle size={12} />} text={groqError || 'Invalid key'} />
                  )}
                </div>
              )}

              {/* Save & Test button */}
              {!groqReady && (
                <div className="mt-5">
                  <PrimaryButton
                    onClick={handleGroqSave}
                    loading={groqSaving}
                    disabled={!groqKey.trim()}
                    fullWidth
                    variant="primary"
                  >
                    {groqSaving ? 'Testing connection...' : 'Save & Test Key'}
                  </PrimaryButton>
                </div>
              )}

              {/* Continue button (shown when key is saved) */}
              {groqReady && (
                <div className="mt-5">
                  <PrimaryButton onClick={() => setStep(2)} fullWidth variant="primary">
                    Continue <ArrowRight size={14} />
                  </PrimaryButton>
                </div>
              )}

              {/* Expandable info */}
              <div className="mt-5 border-t border-border-dim pt-3">
                <button
                  onClick={() => setInfoExpanded(!infoExpanded)}
                  className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary transition-colors duration-100"
                >
                  {infoExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  What is this for?
                </button>
                {infoExpanded && (
                  <div className="mt-2 space-y-1.5 text-[12px] text-text-secondary leading-relaxed">
                    <p>• Groq powers the dual-model AI analysis (Llama 3.3 + Llama 4 Scout)</p>
                    <p>• Each stock signal gets two independent AI opinions before showing you</p>
                    <p>• Free tier gives 30 requests/min — enough for personal use</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Connect Your Broker</h2>
              <Badge variant="watch">OPTIONAL</Badge>
            </div>
            <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
              Optional but recommended. Allows TradePilot to show live prices.
              You still execute trades manually in Angel One.
            </p>

            <div className="mt-6 space-y-3">
              <FormField
                label="Client ID"
                type="text"
                value={clientId}
                onChange={setClientId}
                placeholder="e.g. A12345"
                disabled={angelStatus === 'success'}
              />
              <FormField
                label="Client PIN"
                type="password"
                value={clientPin}
                onChange={setClientPin}
                placeholder="4-6 digit PIN"
                showToggle
                disabled={angelStatus === 'success'}
              />
              <FormField
                label="TOTP Secret"
                type="password"
                value={totpSecret}
                onChange={setTotpSecret}
                placeholder="From Angel One security settings"
                showToggle
                disabled={angelStatus === 'success'}
              />
              <p className="text-[12px] text-text-muted">Find this in Angel One security settings</p>
              <FormField
                label="API Key"
                type="password"
                value={apiKey}
                onChange={setApiKey}
                placeholder="Angel One SmartAPI key"
                showToggle
                disabled={angelStatus === 'success'}
              />

              {/* Angel status */}
              {angelStatus && (
                <div className="mt-2">
                  {angelStatus === 'saving' && (
                    <StatusPill variant="watch" icon={<Spinner size={12} />} text="Saving..." />
                  )}
                  {angelStatus === 'success' && (
                    <StatusPill variant="buy" icon={<CheckCircle2 size={12} />} text="Connected" />
                  )}
                  {angelStatus === 'error' && (
                    <StatusPill variant="sell" icon={<XCircle size={12} />} text={angelError || 'Failed'} />
                  )}
                </div>
              )}

              {/* Save button */}
              {angelStatus !== 'success' && (
                <PrimaryButton
                  onClick={handleAngelSave}
                  loading={angelSaving}
                  fullWidth
                  variant="secondary"
                >
                  {angelSaving ? 'Saving...' : 'Save Angel One Credentials'}
                </PrimaryButton>
              )}

              {/* Skip link */}
              <p
                onClick={handleComplete}
                className="text-[13px] text-text-muted text-center cursor-pointer hover:text-text-secondary transition-colors duration-100 mt-2"
              >
                Skip for now — add later in Settings
              </p>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-border-dim">
              <PrimaryButton onClick={() => setStep(1)} variant="secondary">
                <ArrowLeft size={14} /> Back
              </PrimaryButton>
              <div className="flex-1">
                <PrimaryButton onClick={handleComplete} fullWidth variant="primary">
                  Start Trading <ArrowRight size={14} />
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 mt-5">
        <Lock size={12} className="text-text-muted" />
        <span className="text-[12px] text-text-muted">Keys are encrypted with AES-256 before storage</span>
      </div>
    </div>
  );
}

function StatusPill({ variant, icon, text }) {
  const colors = {
    buy: 'bg-buy/15 text-buy border-buy/30',
    sell: 'bg-sell/15 text-sell border-sell/30',
    watch: 'bg-watch/15 text-watch border-watch/30',
  };
  const cls = colors[variant] || colors.watch;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium ${cls}`}>
      {icon}
      <span>{text}</span>
    </div>
  );
}
