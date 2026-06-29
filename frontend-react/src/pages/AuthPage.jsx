import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Shield, TrendingUp, CheckCircle2 } from 'lucide-react';
import FormField from '../components/shared/FormField';
import PrimaryButton from '../components/shared/PrimaryButton';
import { authApi } from '../api/auth';
import { setTokens, setStoredUser, isLoggedIn } from '../api/client';
import { useAppStore } from '../store/useAppStore';

export default function AuthPage() {
  const navigate = useNavigate();
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setUser = useAppStore((s) => s.setUser);
  const setNeedsSetup = useAppStore((s) => s.setNeedsSetup);

  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validation errors
  const [nameErr, setNameErr] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [confirmErr, setConfirmErr] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Password strength (signup only)
  const pwStrength = getPasswordStrength(password);

  function validateLogin() {
    let valid = true;
    setEmailErr('');
    setPwErr('');

    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailErr('Enter a valid email');
      valid = false;
    }
    if (!password) {
      setPwErr('Password is required');
      valid = false;
    }
    return valid;
  }

  function validateSignup() {
    let valid = true;
    setNameErr('');
    setEmailErr('');
    setPwErr('');
    setConfirmErr('');

    if (!name.trim()) {
      setNameErr('Name is required');
      valid = false;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailErr('Enter a valid email');
      valid = false;
    }
    if (password.length < 8) {
      setPwErr('Minimum 8 characters');
      valid = false;
    }
    if (password !== confirmPw) {
      setConfirmErr('Passwords do not match');
      valid = false;
    }
    return valid;
  }

  async function handleSubmit() {
    setError('');
    setSuccess(false);

    const isValid = tab === 'login' ? validateLogin() : validateSignup();
    if (!isValid) return;

    setLoading(true);

    try {
      let res;
      if (tab === 'login') {
        res = await authApi.login(email, password);
      } else {
        res = await authApi.signup(email, password, name.trim());
      }

      setTokens(res.access_token, res.refresh_token);
      setStoredUser(res.user);
      setUser(res.user);
      setAuthenticated(true);
      setSuccess(true);

      // Brief flash then redirect
      setTimeout(() => {
        // Check if setup needed
        if (tab === 'signup' || !res.user) {
          setNeedsSetup(true);
          navigate('/setup', { replace: true });
        } else {
          // For login, check credentials status
          authApi.me().then((me) => {
            if (!me.config?.has_groq_key) {
              setNeedsSetup(true);
              navigate('/setup', { replace: true });
            } else {
              setNeedsSetup(false);
              navigate('/dashboard', { replace: true });
            }
          }).catch(() => {
            navigate('/dashboard', { replace: true });
          });
        }
      }, 400);
    } catch (err) {
      const msg = err.message || 'Something went wrong';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setError('Connection error — check your internet connection');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  function switchTab(t) {
    setTab(t);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPw('');
    setError('');
    setNameErr('');
    setEmailErr('');
    setPwErr('');
    setConfirmErr('');
    setSuccess(false);
  }

  return (
    <div className="w-full max-w-[400px]">
      {/* Card */}
      <div className="bg-surface border border-border-dim rounded-2xl p-8">
        {/* Logo Mark */}
        <div className="flex justify-center mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-buy to-info flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-[22px] font-bold text-text-primary">
          TradePilot AI
        </h1>
        <p className="text-center text-[13px] text-text-muted mt-1">
          NSE Intraday Co-Pilot
        </p>

        {/* Tab Switcher */}
        <div className="flex mt-7 gap-1 p-1 bg-overlay rounded-xl">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 text-sm font-semibold text-center rounded-lg transition-all ${
              tab === 'login'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => switchTab('signup')}
            className={`flex-1 py-2 text-sm font-semibold text-center rounded-lg transition-all ${
              tab === 'signup'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-muted'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Forms */}
        <div className="mt-5 space-y-4">
          {/* Name (signup only) */}
          {tab === 'signup' && (
            <FormField
              label="Name"
              type="text"
              value={name}
              onChange={(v) => { setName(v); setNameErr(''); }}
              placeholder="Your name"
              autoComplete="name"
              error={nameErr}
              onKeyDown={handleKeyDown}
            />
          )}

          {/* Email */}
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(v) => { setEmail(v); setEmailErr(''); }}
            placeholder="you@example.com"
            autoComplete="email"
            error={emailErr}
            onKeyDown={handleKeyDown}
          />

          {/* Password */}
          <div>
            <FormField
              label="Password"
              type="password"
              value={password}
              onChange={(v) => { setPassword(v); setPwErr(''); }}
              placeholder={tab === 'signup' ? 'Min 8 characters' : 'Your password'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              showToggle
              error={pwErr}
              onKeyDown={tab === 'login' ? handleKeyDown : undefined}
            />
            {/* Password strength bar (signup only) */}
            {tab === 'signup' && password.length > 0 && (
              <div className="mt-2 h-[3px] w-full bg-elevated rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all duration-200 ${
                    pwStrength === 'strong' ? 'bg-buy w-full'
                    : pwStrength === 'medium' ? 'bg-watch w-2/3'
                    : 'bg-sell w-1/3'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Confirm Password (signup) */}
          {tab === 'signup' && (
            <FormField
              label="Confirm Password"
              type="password"
              value={confirmPw}
              onChange={(v) => { setConfirmPw(v); setConfirmErr(''); }}
              placeholder="Confirm password"
              autoComplete="new-password"
              showToggle
              error={confirmErr}
              success={confirmPw.length > 0 && password === confirmPw}
              onKeyDown={handleKeyDown}
            />
          )}

          {/* Error */}
          {error && (
            <p className="text-[13px] text-sell">{error}</p>
          )}

          {/* Submit */}
          <PrimaryButton
            onClick={handleSubmit}
            loading={loading}
            disabled={success}
            fullWidth
            variant="primary"
          >
            {success ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={14} /> Success
              </span>
            ) : tab === 'login' ? (
              loading ? 'Logging in...' : 'Login'
            ) : (
              loading ? 'Creating account...' : 'Create Account'
            )}
          </PrimaryButton>
        </div>
      </div>

      {/* Feature Strip */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <FeatureItem icon={Zap} text="AI-powered signals" />
        <FeatureItem icon={Shield} text="Charge-aware P&L" />
        <FeatureItem icon={TrendingUp} text="200+ stocks scanned" />
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={14} className="text-text-muted" />
      <span className="text-[12px] text-text-muted">{text}</span>
    </div>
  );
}

function getPasswordStrength(pw) {
  if (pw.length < 8) return 'weak';
  const hasMixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (hasMixed && hasNumber && hasSpecial) return 'strong';
  if ((hasMixed && hasNumber) || (hasMixed && hasSpecial) || (hasNumber && hasSpecial)) return 'medium';
  return 'medium';
}
