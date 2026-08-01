import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { missingEnv } from '../lib/firebase';

export default function Login() {
  const { signIn, signInWithGoogle, resetPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    try {
      await signIn(email, password);
    } catch {
      /* el mensaje ya viene del contexto */
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setInfo('Escribe tu correo arriba y vuelve a presionar.');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Te mandamos un correo para restablecer la contraseña.');
    } catch {
      setInfo('No se pudo enviar el correo de recuperación.');
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand-mark" style={{ color: 'var(--ink)' }}>
          BOLSAS ELEMENTAL
        </div>
        <div className="brand-sub" style={{ color: 'var(--ink-faint)', marginBottom: 22 }}>
          ERP · acceso restringido
        </div>

        {missingEnv.length > 0 && (
          <div className="alert bad">
            Faltan variables de entorno: {missingEnv.join(', ')}. Copia <code>.env.example</code> a{' '}
            <code>.env</code> y vuelve a levantar el proyecto.
          </div>
        )}

        <label className="field full">
          <span>Correo</span>
          <input
            className="input boxed"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field full">
          <span>Contraseña</span>
          <input
            className="input boxed"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <div className="alert bad">{error}</div>}
        {info && <div className="alert">{info}</div>}

        <button className="btn btn-primary full-w" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar con Correo'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0', gap: '10px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>O entrar con</span>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>

        <button 
          className="btn full-w" 
          type="button" 
          onClick={() => void signInWithGoogle()} 
          disabled={busy}
          style={{ display: 'flex', gap: 10, alignItems: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        <button className="btn-link" type="button" onClick={() => void onReset()} style={{ marginTop: 8 }}>
          Olvidé mi contraseña
        </button>
      </form>
    </div>
  );
}
