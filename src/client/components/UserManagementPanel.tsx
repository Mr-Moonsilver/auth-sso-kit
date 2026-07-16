import { useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import type { User, AllowedEmail, Role } from '../types.js';

/**
 * All user-facing strings of the panel. Override any subset via the `labels`
 * prop (e.g. for i18n). Templates use `{name}` / `{email}` placeholders.
 */
export interface UserManagementPanelLabels {
  regModeTitle: string;
  regModeOpen: string;
  regModeAllowlist: string;
  regModeOpenHelp: string;
  regModeAllowlistHelp: string;
  allowlistTitle: string;
  allowlistNotEnforced: string;
  allowlistHelpEnforced: string;
  allowlistHelpNotEnforced: string;
  emailPlaceholder: string;
  namePlaceholder: string;
  addToAllowlist: string;
  createAccount: string;
  errValidEmailRequired: string;
  colEmail: string;
  colStatus: string;
  colAdded: string;
  /** `{name}` → registered user's name */
  statusRegistered: string;
  statusPending: string;
  impersonate: string;
  remove: string;
  /** `{email}` → allowlist email */
  confirmRemoveEmail: string;
  userMgmtTitle: string;
  colUser: string;
  colRole: string;
  colJoined: string;
  badgeAdmin: string;
  badgeUser: string;
  removeAdmin: string;
  makeAdmin: string;
  rolesButton: string;
  resetPassword: string;
  deleteButton: string;
  /** `{name}` → user's name */
  confirmDeleteUser: string;
  newPasswordPlaceholder: string;
  setButton: string;
  saveRoles: string;
  errPasswordMin: string;
  passwordResetDone: string;
}

export const defaultUserManagementPanelLabels: UserManagementPanelLabels = {
  regModeTitle: 'Registration Mode',
  regModeOpen: 'Open',
  regModeAllowlist: 'Allowlist',
  regModeOpenHelp: 'Anyone with a valid email can register. The first user becomes admin.',
  regModeAllowlistHelp: 'Only pre-approved emails can log in.',
  allowlistTitle: 'Email Allowlist',
  allowlistNotEnforced: 'The allowlist is not currently enforced. Switch to Allowlist mode to restrict registration.',
  allowlistHelpEnforced: 'Only these email addresses can log in. Add emails before users authenticate.',
  allowlistHelpNotEnforced: 'Manage emails for when you switch to Allowlist mode.',
  emailPlaceholder: 'email@example.com',
  namePlaceholder: 'Name (optional)',
  addToAllowlist: 'Add to Allowlist',
  createAccount: 'Create Account',
  errValidEmailRequired: 'Valid email is required',
  colEmail: 'Email',
  colStatus: 'Status',
  colAdded: 'Added',
  statusRegistered: 'Registered ({name})',
  statusPending: 'Pending',
  impersonate: 'Impersonate',
  remove: 'Remove',
  confirmRemoveEmail: 'Remove "{email}" from the allowlist?',
  userMgmtTitle: 'User Management',
  colUser: 'User',
  colRole: 'Role',
  colJoined: 'Joined',
  badgeAdmin: 'Admin',
  badgeUser: 'User',
  removeAdmin: 'Remove Admin',
  makeAdmin: 'Make Admin',
  rolesButton: 'Roles',
  resetPassword: 'Reset Password',
  deleteButton: 'Delete',
  confirmDeleteUser: 'Delete user "{name}"? This will also delete all their data.',
  newPasswordPlaceholder: 'New password (min 8 chars)',
  setButton: 'Set',
  saveRoles: 'Save Roles',
  errPasswordMin: 'Password must be at least 8 characters',
  passwordResetDone: 'Password reset successfully',
};

export interface UserManagementPanelProps {
  /** Add extra columns to the user table */
  extraColumns?: Array<{
    header: string;
    render: (user: User) => ReactNode;
  }>;
  /** Override any user-facing string (e.g. for i18n). */
  labels?: Partial<UserManagementPanelLabels>;
}

export function UserManagementPanel({ extraColumns, labels }: UserManagementPanelProps) {
  const L: UserManagementPanelLabels = { ...defaultUserManagementPanelLabels, ...labels };
  const { user: currentUser, authMethod } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleEditUserId, setRoleEditUserId] = useState<number | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

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
      const [usersData, emailsData, modeData, rolesData] = await Promise.all([
        authApi.getUsers() as Promise<User[]>,
        authApi.getAllowedEmails() as Promise<AllowedEmail[]>,
        authApi.getRegistrationMode().catch(() => ({ mode: 'open' as const })),
        authApi.getRoles().catch(() => []) as Promise<Role[]>,
      ]);
      setUsers(usersData);
      setAllowedEmails(emailsData);
      setRegMode(modeData.mode);
      setAvailableRoles(rolesData);
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
    if (!confirm(L.confirmDeleteUser.replace('{name}', userName))) return;
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
      setEmailError(L.errValidEmailRequired);
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
      setEmailError(L.errValidEmailRequired);
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
    if (!confirm(L.confirmRemoveEmail.replace('{email}', email))) return;
    try {
      await authApi.removeAllowedEmail(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!resetPassword || resetPassword.length < 8) {
      alert(L.errPasswordMin);
      return;
    }
    try {
      await authApi.resetUserPassword(userId, resetPassword);
      setResetUserId(null);
      setResetPassword('');
      alert(L.passwordResetDone);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenRoleEdit = (userId: number, userRoles: string[]) => {
    setRoleEditUserId(userId);
    const ids = availableRoles.filter((r) => userRoles.includes(r.name)).map((r) => r.id);
    setSelectedRoleIds(ids);
  };

  const handleToggleRoleSelection = (roleId: number) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSaveUserRoles = async (userId: number) => {
    try {
      await authApi.updateUserRoles(userId, selectedRoleIds);
      setRoleEditUserId(null);
      loadData();
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
        <h3 className="card-title mb-md">{L.regModeTitle}</h3>
        <div className="flex gap-sm mb-md">
          <button
            className={`btn btn-sm ${regMode === 'open' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetRegMode('open')}
          >
            {L.regModeOpen}
          </button>
          <button
            className={`btn btn-sm ${regMode === 'allowlist' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSetRegMode('allowlist')}
          >
            {L.regModeAllowlist}
          </button>
        </div>
        <p className="text-sm text-muted">
          {regMode === 'open' ? L.regModeOpenHelp : L.regModeAllowlistHelp}
        </p>
      </div>

      <div className="card mb-lg">
        <h3 className="card-title mb-md">{L.allowlistTitle}</h3>
        {regMode === 'open' && (
          <p className="text-sm text-muted mb-lg" style={{ fontStyle: 'italic' }}>
            {L.allowlistNotEnforced}
          </p>
        )}
        <p className="text-sm text-muted mb-lg">
          {regMode === 'allowlist' ? L.allowlistHelpEnforced : L.allowlistHelpNotEnforced}
        </p>

        <div className="mb-md">
          <div className="flex gap-sm mb-sm">
            <input
              type="email"
              className="form-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={L.emailPlaceholder}
              style={{ flex: 1 }}
            />
          </div>
          <div className="flex gap-sm mb-sm">
            <input
              type="text"
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={L.namePlaceholder}
              style={{ flex: 1 }}
            />
          </div>
          <div className="flex gap-sm">
            <button className="btn btn-secondary" onClick={handleAddEmail}>{L.addToAllowlist}</button>
            <button className="btn btn-primary" onClick={handlePreCreate}>{L.createAccount}</button>
          </div>
        </div>

        {emailError && (
          <div className="badge badge-danger mb-md" style={{ display: 'block', padding: '6px 10px' }}>{emailError}</div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>{L.colEmail}</th>
              <th>{L.colStatus}</th>
              <th>{L.colAdded}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allowedEmails.map((ae) => (
              <tr key={ae.id}>
                <td className="font-medium">{ae.email}</td>
                <td>
                  {ae.userId ? (
                    <span className="badge badge-primary">{L.statusRegistered.replace('{name}', ae.userName ?? '')}</span>
                  ) : (
                    <span className="badge">{L.statusPending}</span>
                  )}
                </td>
                <td className="text-muted text-sm">{new Date(ae.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="flex gap-sm">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleImpersonateAllowlistUser(ae)}
                    >
                      {L.impersonate}
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveEmail(ae.id, ae.email)}
                    >
                      {L.remove}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="card-title mb-md">{L.userMgmtTitle}</h3>

        <table className="table">
          <thead>
            <tr>
              <th>{L.colUser}</th>
              <th>{L.colEmail}</th>
              <th>{L.colRole}</th>
              {extraColumns?.map((col) => (
                <th key={col.header}>{col.header}</th>
              ))}
              <th>{L.colJoined}</th>
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
                <td className="text-sm text-muted">{u.email || '—'}</td>
                <td>
                  <div className="flex gap-sm flex-wrap">
                    {u.isAdmin ? (
                      <span className="badge badge-primary">{L.badgeAdmin}</span>
                    ) : (
                      <span className="badge">{L.badgeUser}</span>
                    )}
                    {(u.roles ?? []).map((role) => (
                      <span key={role} className="badge badge-secondary">{role}</span>
                    ))}
                  </div>
                </td>
                {extraColumns?.map((col) => (
                  <td key={col.header}>{col.render(u)}</td>
                ))}
                <td className="text-muted text-sm">
                  {(u as any).createdAt ? new Date((u as any).createdAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  {u.id !== currentUser?.id && (
                    <div className="flex gap-sm flex-wrap">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleToggleAdmin(u.id, !u.isAdmin)}
                      >
                        {u.isAdmin ? L.removeAdmin : L.makeAdmin}
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleImpersonate(u.id)}
                      >
                        {L.impersonate}
                      </button>
                      {availableRoles.length > 0 && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            if (roleEditUserId === u.id) {
                              setRoleEditUserId(null);
                            } else {
                              handleOpenRoleEdit(u.id, u.roles ?? []);
                            }
                          }}
                        >
                          {L.rolesButton}
                        </button>
                      )}
                      {authMethod === 'password' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setResetUserId(resetUserId === u.id ? null : u.id);
                            setResetPassword('');
                          }}
                        >
                          {L.resetPassword}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteUser(u.id, u.name)}
                      >
                        {L.deleteButton}
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
                        placeholder={L.newPasswordPlaceholder}
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleResetPassword(u.id)}
                      >
                        {L.setButton}
                      </button>
                    </div>
                  )}
                  {roleEditUserId === u.id && (
                    <div className="mt-sm">
                      <div className="flex gap-sm flex-wrap mb-sm">
                        {availableRoles.map((role) => (
                          <label key={role.id} className="flex items-center gap-sm" style={{ fontSize: '0.85rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedRoleIds.includes(role.id)}
                              onChange={() => handleToggleRoleSelection(role.id)}
                            />
                            {role.name}
                          </label>
                        ))}
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleSaveUserRoles(u.id)}
                      >
                        {L.saveRoles}
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
