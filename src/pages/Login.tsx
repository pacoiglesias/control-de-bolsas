import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { missingEnv } from '../lib/firebase';

export default function Login() {
  const { signIn, resetPassword, error } = useAuth();
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
          CONTROL BOLSAS
        </div>
        <div className="brand-sub" style={{ color: 'var(--ink-faint)', marginBottom: 22 }}>
          Master Track · acceso restringido
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
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <button className="btn-link" type="button" onClick={() => void onReset()}>
          Olvidé mi contraseña
        </button>
      </form>
    </div>
  );
}
