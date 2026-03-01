import { useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import type { User, AllowedEmail } from '../types.js';

export interface UserManagementPanelProps {
  /** Add extra columns to the user table */
  extraColumns?: Array<{
    header: string;
    render: (user: User) => ReactNode;
  }>;
}

export function UserManagementPanel({ extraColumns }: UserManagementPanelProps) {
  const { user: currentUser, authMethod } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  // Email allowlist / pre-create state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [emailError, setEmailError] = useState('');

  // Password reset state
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  // Registration mode state
  const [regMode, setRegMode] = useState<'open' | 'allowlist'>('open');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, emailsData, modeData] = await Promise.all([
        authApi.getUsers() as Promise<User[]>,
        authApi.getAllowedEmails() as Promise<AllowedEmail[]>,
        authApi.getRegistrationMode().catch(() => ({ mode: 'open' as const })),
      ]);
      setUsers(usersData);
      setAllowedEmails(emailsData);
      setRegMode(modeData.mode);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetRegMode = async (mode: 'open' | 'allowlist') => {
    try {
      await authApi.setRegistrationMode(mode);
      setRegMode(mode);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleImpersonate = async (userId: number) => {
    try {
      await authApi.impersonateUser(userId);
      window.location.href = '/';
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleAdmin = async (userId: number, isAdmin: boolean) => {
    try {
      await authApi.toggleAdmin(userId, isAdmin);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Delete user "${userName}"? This will also delete all their data.`)) return;
    try {
      await authApi.deleteUser(userId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError('Valid email is required');
      return;
    }
    try {
      await authApi.addAllowedEmail(newEmail.trim());
      setNewEmail('');
      setNewName('');
      loadData();
    } catch (err: any) {
      setEmailError(err.message);
    }
  };

  const handlePreCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError('Valid email is required');
      return;
    }
    try {
      await authApi.preCreateUser(newEmail.trim(), newName.trim() || undefined);
      setNewEmail('');
      setNewName('');
      loadData();
    } catch (err: any) {
      setEmailError(err.message);
    }
  };

  const handleImpersonateAllowlistUser = async (ae: AllowedEmail) => {
    try {
      let userId = ae.userId;
      if (!userId) {
        // Pre-create the user first so we can impersonate
        const created = await authApi.preCreateUser(ae.email) as any;
        userId = created.id;
      }
      await authApi.impersonateUser(userId!);
      window.location.href = '/';
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveEmail = async (id: number, email: string) => {
    if (!confirm(`Remove "${email}" from the allowlist?`)) return;
    try {
      await authApi.removeAllowedEmail(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!resetPassword || resetPassword.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    try {
      await authApi.resetUserPassword(userId, resetPassword);
      setResetUserId(null);
      setResetPassword('');
      alert('Password reset successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="card mb-lg">
        <h3 className="card-title mb-md">Registration Mode</h3>
        <div className="flex gap-sm mb-md">
          <button
            className={`btn btn-sm ${regMode === 'open' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetRegMode('open')}
          >
            Open
          </button>
          <button
            className={`btn btn-sm ${regMode === 'allowlist' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetRegMode('allowlist')}
          >
            Allowlist
          </button>
        </div>
        <p className="text-sm text-muted">
          {regMode === 'open'
            ? 'Anyone with a valid email can register. The first user becomes admin.'
            : 'Only pre-approved emails can log in.'}
        </p>
      </div>

      <div className="card mb-lg">
        <h3 className="card-title mb-md">Email Allowlist</h3>
        {regMode === 'open' && (
          <p className="text-sm text-muted mb-lg" style={{ fontStyle: 'italic' }}>
            The allowlist is not currently enforced. Switch to Allowlist mode to restrict registration.
          </p>
        )}
        <p className="text-sm text-muted mb-lg">
          {regMode === 'allowlist'
            ? 'Only these email addresses can log in. Add emails before users authenticate.'
            : 'Manage emails for when you switch to Allowlist mode.'}
        </p>

        <div className="mb-md">
          <div className="flex gap-sm mb-sm">
            <input
              type="email"
              className="form-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              style={{ flex: 1 }}
            />
          </div>
          <div className="flex gap-sm mb-sm">
            <input
              type="text"
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (optional)"
              style={{ flex: 1 }}
            />
          </div>
          <div className="flex gap-sm">
            <button className="btn btn-secondary" onClick={handleAddEmail}>Add to Allowlist</button>
            <button className="btn btn-primary" onClick={handlePreCreate}>Create Account</button>
          </div>
        </div>

        {emailError && (
          <div className="badge badge-danger mb-md" style={{ display: 'block', padding: '6px 10px' }}>{emailError}</div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Status</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allowedEmails.map((ae) => (
              <tr key={ae.id}>
                <td className="font-medium">{ae.email}</td>
                <td>
                  {ae.userId ? (
                    <span className="badge badge-primary">Registered ({ae.userName})</span>
                  ) : (
                    <span className="badge">Pending</span>
                  )}
                </td>
                <td className="text-muted text-sm">{new Date(ae.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="flex gap-sm">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleImpersonateAllowlistUser(ae)}
                    >
                      Impersonate
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveEmail(ae.id, ae.email)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="card-title mb-md">User Management</h3>

        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              {extraColumns?.map((col) => (
                <th key={col.header}>{col.header}</th>
              ))}
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-sm">
                    <span className="user-initials">{u.initials}</span>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="text-sm text-muted">{u.email || '\u2014'}</td>
                <td>
                  {u.isAdmin ? (
                    <span className="badge badge-primary">Admin</span>
                  ) : (
                    <span className="badge">User</span>
                  )}
                </td>
                {extraColumns?.map((col) => (
                  <td key={col.header}>{col.render(u)}</td>
                ))}
                <td className="text-muted text-sm">
                  {(u as any).createdAt ? new Date((u as any).createdAt).toLocaleDateString() : '\u2014'}
                </td>
                <td>
                  {u.id !== currentUser?.id && (
                    <div className="flex gap-sm flex-wrap">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleToggleAdmin(u.id, !u.isAdmin)}
                      >
                        {u.isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleImpersonate(u.id)}
                      >
                        Impersonate
                      </button>
                      {authMethod === 'password' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setResetUserId(resetUserId === u.id ? null : u.id);
                            setResetPassword('');
                          }}
                        >
                          Reset Password
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(u.id, u.name)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                  {resetUserId === u.id && (
                    <div className="flex gap-sm mt-sm">
                      <input
                        type="password"
                        className="form-input"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="New password (min 8 chars)"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleResetPassword(u.id)}
                      >
                        Set
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
