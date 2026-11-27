import { useState } from 'react';
import { api } from '../api.js';

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3l18 18" />
    <path d="M10.6 6.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
    <path d="M6.6 6.7C3.9 8.5 2 12 2 12s3.5 7 10 7c1.5 0 2.9-.3 4.1-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

function PasswordField({ id, label, value, onChange, autoComplete, hint, error }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="input pw-input"
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required
        />
        <button
          type="button"
          className="pw-toggle"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error ? <p className="error field-error">{error}</p> : hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const mismatch = isSignup && form.confirm !== '' && form.password !== form.confirm;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { user } = isSignup
        ? await api.signup({ name: form.name, email: form.email, password: form.password })
        : await api.login({ email: form.email, password: form.password });
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setForm({ ...form, password: '', confirm: '' });
    setError('');
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand auth-brand">
          <span className="logo">A</span>
          <span className="brand-name">Actify</span>
        </div>
        <h1 className="modal-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="modal-sub">{isSignup ? 'Start tracking what your team needs to do.' : 'Log in to see your actionables.'}</p>

        {isSignup && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>

        <PasswordField
          id="password"
          label="Password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          value={form.password}
          onChange={set('password')}
          hint={isSignup ? 'At least 8 characters.' : undefined}
        />
        {isSignup && (
          <PasswordField
            id="confirm"
            label="Confirm password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            error={mismatch ? 'Passwords do not match.' : ''}
          />
        )}

        {error && <p className="error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </button>

        <p className="switch">
          {isSignup ? 'Already have an account?' : 'New to Actify?'}{' '}
          <button type="button" className="link" onClick={switchMode}>
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </main>
  );
}
