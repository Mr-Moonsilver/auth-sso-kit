import { useState, useEffect } from 'react';
import { authApi } from '../api.js';
import type { Role, Permission } from '../types.js';

export interface RoleManagementPanelProps {
  /** Optional: override the list of permission keys shown in the matrix */
  permissionKeys?: string[];
}

export function RoleManagementPanel({ permissionKeys: propPermissionKeys }: RoleManagementPanelProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<number, Permission[]>>({});
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesData, definitionsData] = await Promise.all([
        authApi.getRoles() as Promise<Role[]>,
        propPermissionKeys
          ? Promise.resolve(propPermissionKeys)
          : authApi.getPermissionDefinitions().catch(() => [] as string[]),
      ]);
      setRoles(rolesData);
      setPermissionKeys(definitionsData);

      // Load permissions for each role
      const permsMap: Record<number, Permission[]> = {};
      await Promise.all(
        rolesData.map(async (role) => {
          const perms = await authApi.getRolePermissions(role.id) as Permission[];
          permsMap[role.id] = perms;
        })
      );
      setRolePermissions(permsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) {
      setCreateError('Role name is required');
      return;
    }
    try {
      await authApi.createRole(newName.trim(), newDescription.trim());
      setNewName('');
      setNewDescription('');
      loadData();
    } catch (err: any) {
      setCreateError(err.message);
    }
  };

  const handleStartEdit = (role: Role) => {
    setEditingId(role.id);
    setEditName(role.name);
    setEditDescription(role.description || '');
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await authApi.updateRole(id, editName.trim(), editDescription.trim());
      setEditingId(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete role "${name}"? This will remove it from all users.`)) return;
    try {
      await authApi.deleteRole(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isPermissionEnabled = (roleId: number, key: string): boolean => {
    const perms = rolePermissions[roleId] ?? [];
    const match = perms.find((p) => p.permission_key === key);
    return match ? match.enabled : false;
  };

  const handleTogglePermission = async (roleId: number, key: string) => {
    const currentPerms = rolePermissions[roleId] ?? [];
    const existing = currentPerms.find((p) => p.permission_key === key);
    const newEnabled = existing ? !existing.enabled : true;

    // Build the full updated permissions list
    const updatedPerms = permissionKeys.map((k) => {
      if (k === key) return { key: k, enabled: newEnabled };
      const curr = currentPerms.find((p) => p.permission_key === k);
      return { key: k, enabled: curr ? curr.enabled : false };
    });

    try {
      await authApi.updateRolePermissions(roleId, updatedPerms);
      // Optimistic local update
      setRolePermissions((prev) => ({
        ...prev,
        [roleId]: updatedPerms.map((p, i) => ({
          id: currentPerms.find((cp) => cp.permission_key === p.key)?.id ?? i,
          permission_key: p.key,
          enabled: p.enabled,
        })),
      }));
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
        <h3 className="card-title mb-md">Create Role</h3>
        <form onSubmit={handleCreate}>
          <div className="flex gap-sm mb-sm">
            <input
              type="text"
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Role name"
              style={{ flex: 1 }}
            />
            <input
              type="text"
              className="form-input"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              style={{ flex: 2 }}
            />
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
        {createError && (
          <div className="badge badge-danger" style={{ display: 'block', padding: '6px 10px' }}>{createError}</div>
        )}
      </div>

      {roles.map((role) => (
        <div key={role.id} className="card mb-lg">
          {editingId === role.id ? (
            <div className="flex gap-sm mb-md">
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                type="text"
                className="form-input"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                style={{ flex: 2 }}
              />
              <button className="btn btn-sm btn-primary" onClick={() => handleSaveEdit(role.id)}>Save</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-sm mb-md">
              <h3 className="card-title" style={{ flex: 1, margin: 0 }}>{role.name}</h3>
              {role.description && (
                <span className="text-sm text-muted" style={{ flex: 2 }}>{role.description}</span>
              )}
              <button className="btn btn-sm btn-secondary" onClick={() => handleStartEdit(role)}>Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(role.id, role.name)}>Delete</button>
            </div>
          )}

          {permissionKeys.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Permission</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {permissionKeys.map((key) => (
                  <tr key={key}>
                    <td className="font-medium">{key}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={isPermissionEnabled(role.id, key)}
                        onChange={() => handleTogglePermission(role.id, key)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {roles.length === 0 && (
        <div className="card">
          <p className="text-muted">No roles defined yet. Create one above.</p>
        </div>
      )}
    </>
  );
}
