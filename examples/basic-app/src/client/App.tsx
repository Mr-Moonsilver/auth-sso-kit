import { AuthProvider, useAuth, LoginPage, UserManagementPanel } from 'auth-sso-kit/client/index.js';

function AppContent() {
  const { user, loading, logout, isAdmin } = useAuth();

  if (loading) {
    return <div className="login-page"><div className="spinner" /></div>;
  }

  if (!user) {
    return <LoginPage title="Example App" subtitle="auth-sso-kit demo" />;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Example App</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Hello, {user.name}!</span>
          {isAdmin && <span className="badge badge-primary">Admin</span>}
          <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      {isAdmin && <UserManagementPanel />}

      {!isAdmin && (
        <div className="card">
          <p>You are logged in. Admin users can manage users and the email allowlist.</p>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
