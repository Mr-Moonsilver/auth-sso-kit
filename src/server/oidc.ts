import * as client from 'openid-client';

export interface OIDCSettings {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  appUrl: string;
  /** Path the provider redirects back to, appended to appUrl. Default: /api/auth/oidc/callback */
  redirectPath?: string;
}

/**
 * One OIDC client configuration, self-contained: an app that authenticates two audiences
 * against two different providers (e.g. an operator console and a client portal, each its
 * own application at the IdP) creates one instance per audience. The module-level
 * functions below remain the single-audience API every existing consumer already uses —
 * they now simply delegate to a default instance.
 */
export interface OIDCInstance {
  settings: OIDCSettings;
  getAppUrl(): string;
  getRedirectUri(): string;
  getConfig(): Promise<client.Configuration>;
  /**
   * The provider's discovery document, once getConfig() has fetched it — null before that.
   * Synchronous on purpose: callers reach for it on paths (logout) where an await on a
   * possibly-unreachable IdP would be worse than degrading gracefully.
   */
  serverMetadata(): client.ServerMetadata | null;
}

export function createOIDC(settings: OIDCSettings): OIDCInstance {
  let config: client.Configuration | null = null;
  const getAppUrl = () => settings.appUrl || `http://localhost:${process.env.PORT || 3000}`;
  return {
    settings,
    getAppUrl,
    getRedirectUri: () => `${getAppUrl()}${settings.redirectPath || '/api/auth/oidc/callback'}`,
    getConfig: async () => {
      if (config) return config;
      config = await client.discovery(
        new URL(settings.issuerUrl),
        settings.clientId,
        settings.clientSecret,
      );
      return config;
    },
    serverMetadata: () => (config ? config.serverMetadata() : null),
  };
}

// ── the default instance — the original singleton API, behavior unchanged ──

let defaultInstance: OIDCInstance | null = null;

export function setOIDCConfig(cfg: OIDCSettings): void {
  defaultInstance = createOIDC(cfg);
}

export function isOIDCEnabled(): boolean {
  return !!defaultInstance;
}

export function getAppUrl(): string {
  return defaultInstance?.getAppUrl() ?? `http://localhost:${process.env.PORT || 3000}`;
}

export function getRedirectUri(): string {
  return defaultInstance?.getRedirectUri() ?? `${getAppUrl()}/api/auth/oidc/callback`;
}

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (!defaultInstance) throw new Error('OIDC not configured');
  return defaultInstance.getConfig();
}
