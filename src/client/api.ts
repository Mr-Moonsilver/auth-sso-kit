const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const authApi = {
  // Auth
  getAuthConfig: () => request('/auth/config'),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),

  // Users
  getUsers: () => request('/users'),
  toggleAdmin: (id: number, isAdmin: boolean) =>
    request(`/users/${id}/admin`, { method: 'PUT', body: JSON.stringify({ isAdmin }) }),
  deleteUser: (id: number) => request(`/users/${id}`, { method: 'DELETE' }),

  // Admin — Email Allowlist
  getAllowedEmails: () => request('/admin/allowed-emails'),
  addAllowedEmail: (email: string) =>
    request('/admin/allowed-emails', { method: 'POST', body: JSON.stringify({ email }) }),
  removeAllowedEmail: (id: number) => request(`/admin/allowed-emails/${id}`, { method: 'DELETE' }),
  resetUserPassword: (userId: number, password: string) =>
    request(`/admin/users/${userId}/reset-password`, { method: 'PUT', body: JSON.stringify({ password }) }),

  // Admin — Pre-create Users
  preCreateUser: (email: string, name?: string) =>
    request('/admin/users/pre-create', {
      method: 'POST',
      body: JSON.stringify({ email, ...(name ? { name } : {}) }),
    }),

  // Admin — Impersonation
  impersonateUser: (id: number) =>
    request('/admin/impersonate/' + id, { method: 'POST' }),
  stopImpersonating: () =>
    request('/admin/stop-impersonate', { method: 'POST' }),

  // Admin — Registration Mode
  getRegistrationMode: () => request<{ mode: 'open' | 'allowlist' }>('/admin/registration-mode'),
  setRegistrationMode: (mode: 'open' | 'allowlist') =>
    request('/admin/registration-mode', { method: 'PUT', body: JSON.stringify({ mode }) }),

  // Admin — Roles
  getRoles: () => request('/admin/roles'),
  createRole: (name: string, description: string) =>
    request('/admin/roles', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updateRole: (id: number, name: string, description: string) =>
    request(`/admin/roles/${id}`, { method: 'PUT', body: JSON.stringify({ name, description }) }),
  deleteRole: (id: number) =>
    request(`/admin/roles/${id}`, { method: 'DELETE' }),
  getRolePermissions: (roleId: number) =>
    request(`/admin/roles/${roleId}/permissions`),
  updateRolePermissions: (roleId: number, permissions: { key: string; enabled: boolean }[]) =>
    request(`/admin/roles/${roleId}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  getPermissionDefinitions: () => request<string[]>('/admin/permissions'),

  // Admin — User Roles
  updateUserRoles: (userId: number, roleIds: number[]) =>
    request(`/users/${userId}/roles`, { method: 'PUT', body: JSON.stringify({ roleIds }) }),
};
