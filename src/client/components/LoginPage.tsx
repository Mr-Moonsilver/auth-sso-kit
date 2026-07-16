import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';

/** All user-facing strings of the login page. Override any subset via the `labels` prop (e.g. for i18n). */
export interface LoginPageLabels {
  emailLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  /** Footer shown when registration mode is 'open' (unless `footerText` prop is set). */
  footerOpen: string;
  /** Footer shown when registration mode is 'allowlist' (unless `footerText` prop is set). */
  footerAllowlist: string;
  errEmailRequired: string;
  errPasswordRequired: string;
  errLoginFailed: string;
  errNotAuthorized: string;
  errOidcFailed: string;
  errNoEmail: string;
}

export const defaultLoginPageLabels: LoginPageLabels = {
  emailLabel: 'Email',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter your password',
  submitLabel: 'Login',
  submittingLabel: 'Logging in...',
  footerOpen: 'Open registration — first user becomes admin',
  footerAllowlist: 'Only pre-approved email addresses can log in',
  errEmailRequired: 'Email is required',
  errPasswordRequired: 'Password is required',
  errLoginFailed: 'Login failed',
  errNotAuthorized: 'Your email is not authorized to access this application. Contact an administrator.',
  errOidcFailed: 'Authentication failed. Please try again.',
  errNoEmail: 'No email was received from the identity provider.',
};

export interface LoginPageProps {
  title?: string;
  subtitle?: string;
  oidcButtonLabel?: string;
  emailPlaceholder?: string;
  footerText?: string;
  /** Override any user-facing string (labels, placeholders, error messages). */
  labels?: Partial<LoginPageLabels>;
}

export function LoginPage({
  title = 'Login',
  subtitle = '',
  oidcButtonLabel = 'Log in with SSO',
  emailPlaceholder = 'your@email.com',
  footerText,
  labels,
}: LoginPageProps) {
  const L: LoginPageLabels = { ...defaultLoginPageLabels, ...labels };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithOIDC, authMethod, registrationMode } = useAuth();

  // Derive footer text: respect explicit prop, otherwise adapt to registration mode
  const resolvedFooterText = footerText !== undefined
    ? footerText
    : registrationMode === 'open'
      ? L.footerOpen
      : L.footerAllowlist;

  // Check for OIDC error in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error=not_authorized')) {
      setError(L.errNotAuthorized);
    } else if (hash.includes('error=oidc_failed')) {
      setError(L.errOidcFailed);
    } else if (hash.includes('error=no_email')) {
      setError(L.errNoEmail);
    }
    if (hash.includes('error=')) {
      window.location.hash = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(L.errEmailRequired);
      return;
    }
    if (!password) {
      setError(L.errPasswordRequired);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || L.errLoginFailed);
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
                {L.emailLabel}
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
                {L.passwordLabel}
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={L.passwordPlaceholder}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? L.submittingLabel : L.submitLabel}
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
