import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';

export interface LoginPageProps {
  title?: string;
  subtitle?: string;
  oidcButtonLabel?: string;
  emailPlaceholder?: string;
  footerText?: string;
}

export function LoginPage({
  title = 'Login',
  subtitle = '',
  oidcButtonLabel = 'Log in with SSO',
  emailPlaceholder = 'your@email.com',
  footerText,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithOIDC, authMethod, registrationMode } = useAuth();

  // Derive footer text: respect explicit prop, otherwise adapt to registration mode
  const resolvedFooterText = footerText !== undefined
    ? footerText
    : registrationMode === 'open'
      ? 'Open registration \u2014 first user becomes admin'
      : 'Only pre-approved email addresses can log in';

  // Check for OIDC error in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error=not_authorized')) {
      setError('Your email is not authorized to access this application. Contact an administrator.');
    } else if (hash.includes('error=oidc_failed')) {
      setError('Authentication failed. Please try again.');
    } else if (hash.includes('error=no_email')) {
      setError('No email was received from the identity provider.');
    }
    if (hash.includes('error=')) {
      window.location.hash = '';
    }
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>

        {error && (
          <div className="badge badge-danger mb-md" style={{ display: 'block', textAlign: 'center', padding: '8px 12px' }}>
            {error}
          </div>
        )}

        {authMethod === 'oidc' ? (
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={loginWithOIDC}
          >
            {oidcButtonLabel}
          </button>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={emailPlaceholder}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {resolvedFooterText && (
          <p className="text-muted text-sm mt-md" style={{ textAlign: 'center' }}>
            {resolvedFooterText}
          </p>
        )}
      </div>
    </div>
  );
}
