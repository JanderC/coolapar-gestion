import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

// Ilustración de la finca al amanecer: colinas de pasto, cerca de madera
// y, a lo lejos, el techo rojo del establo (el mismo guiño visual del logo).
const EscenaFinca = () => (
  <svg viewBox="0 0 600 340" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Finca COOLAPAR al amanecer">
    <circle cx="470" cy="70" r="46" fill="#F6D98B" opacity="0.9" />
    <path d="M0 190 Q150 130 300 175 T600 160 V340 H0 Z" fill="#4F7942" />
    <path d="M0 230 Q160 190 320 225 T600 210 V340 H0 Z" fill="#2F5233" />
    {/* establo lejano */}
    <g transform="translate(120,150)">
      <rect x="0" y="18" width="46" height="30" fill="#EFE6CE" />
      <path d="M-4 18 L23 -6 L50 18 Z" fill="#A63A34" />
    </g>
    {/* cerca de madera */}
    <g stroke="#6B4226" strokeWidth="4" opacity="0.8">
      <line x1="0" y1="260" x2="600" y2="248" />
      <line x1="0" y1="278" x2="600" y2="266" />
      {[40, 140, 240, 340, 440, 540].map((x) => (
        <line key={x} x1={x} y1="232" x2={x - 6} y2="290" />
      ))}
    </g>
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await iniciarSesion(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'No pudimos validar esos datos en el cuaderno.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="ledger-page">
      <div className="ledger-scene">
        <div className="ledger-tagline">
          <span className="eyebrow">Edo. Táchira</span>
          <h2>Cada litro, cada queso, anotado en su lugar.</h2>
        </div>
        <EscenaFinca />
      </div>

      <div className="ledger-form-panel">
        <form className="ledger-book" onSubmit={handleSubmit} noValidate>
          <div className="ledger-logo-wrap">
            <img src="/coolapar-logo.png" alt="COOLAPAR - Edo. Táchira" className="ledger-logo" />
          </div>
          <h1 className="visually-hidden">COOLAPAR — Sistema de gestión</h1>
          <div className="ledger-brand-mark text-center">Cuaderno de acceso</div>

          {error && (
            <div className="ledger-error" role="alert">
              {error}
            </div>
          )}

          <div className="ledger-field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.nombre@coolapar.com"
              required
              autoComplete="username"
            />
          </div>

          <div className="ledger-field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="ledger-submit-row">
            <p className="ledger-submit-hint">Presiona el sello para registrar tu entrada de hoy.</p>
            <button type="submit" className="wax-seal-btn" disabled={cargando} aria-label="Ingresar">
              {cargando ? 'Sellando…' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;