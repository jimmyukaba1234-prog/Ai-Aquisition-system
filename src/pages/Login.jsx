import { useState } from 'react';
import { LuArrowRight, LuSparkles, LuPhoneCall, LuGraduationCap } from 'react-icons/lu';
import { useStore } from '../store.jsx';
import { Button, Field } from '../components/ui.jsx';

export default function Login() {
  const { signIn, signUp, resetPassword, live } = useStore();
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ name: '', email: '', pw: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (!live) await signIn();
      else if (mode === 'in') await signIn(f.email.trim(), f.pw);
      else if (mode === 'up') {
        const r = await signUp(f.email.trim(), f.pw, f.name.trim());
        if (!r?.access_token) setMsg({ tone: 'ok', text: 'Account created. Check your email to confirm it, then sign in. An admin will assign your role.' });
      } else { await resetPassword(f.email.trim()); setMsg({ tone: 'ok', text: 'If that email has an account, a reset link is on its way.' }); }
    } catch (err) { setMsg({ tone: 'bad', text: err.message }); }
    setBusy(false);
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="login-photo" aria-hidden />
        <div className="login-brand"><img src="/logo-light.png" alt="The Elevation Church, Greater Lekki" /></div>
        <div className="login-copy">
          <p className="eyebrow">Guest Journey</p>
          <h1 className="serif">We’re so glad <em>you’re here.</em></h1>
          <p className="login-lead">Every first-timer, known by name and followed with care, from their first Sunday to the Greatness Community.</p>
          <ul>
            <li><LuPhoneCall aria-hidden /> Every new guest called by Wednesday</li>
            <li><LuGraduationCap aria-hidden /> Track each step from first visit to Greatness Community</li>
            <li><LuSparkles aria-hidden /> AI tells the team who needs attention today</li>
          </ul>
        </div>
        <p className="login-verse">“And let us consider one another to provoke unto love and to good works.” <span>Hebrews 10:24</span></p>
      </section>

      <section className="login-form">
        <form onSubmit={submit} className="login-card">
          <img src="/emblem-dark.png" alt="" className="login-emblem" />
          <h2 className="serif">{!live ? 'Explore the demo' : mode === 'in' ? 'Welcome back' : mode === 'up' ? 'Create your account' : 'Reset password'}</h2>
          <p className="muted">{!live ? 'Supabase isn’t connected yet, so you’ll see realistic sample data. Nothing is saved to a server.' : mode === 'up' ? 'New team members sign up here; an admin then assigns your role.' : 'Sign in with your church team account.'}</p>
          {live && mode === 'up' && <Field label="Full name" required><input value={f.name} onChange={set('name')} required autoComplete="name" /></Field>}
          {live && <Field label="Email" required><input type="email" value={f.email} onChange={set('email')} required autoComplete="email" /></Field>}
          {live && mode !== 'reset' && <Field label="Password" required><input type="password" value={f.pw} onChange={set('pw')} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>}
          {msg && <div className={`note ${msg.tone === 'bad' ? 'note-bad' : ''}`}>{msg.text}</div>}
          <Button variant="primary" size="lg" disabled={busy} icon={LuArrowRight} type="submit">
            {busy ? 'Please wait…' : !live ? 'Enter demo' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </Button>
          {live && (
            <div className="login-links">
              {mode !== 'in' && <button type="button" onClick={() => setMode('in')}>Back to sign in</button>}
              {mode === 'in' && <button type="button" onClick={() => setMode('up')}>New team member? Create an account</button>}
              {mode === 'in' && <button type="button" onClick={() => setMode('reset')}>Forgot password?</button>}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
