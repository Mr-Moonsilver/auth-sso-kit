import * as client from 'openid-client';

let config: client.Configuration | null = null;

export interface OIDCSettings {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  appUrl: string;
}

let oidcSettings: OIDCSettings | null = null;

export function setOIDCConfig(cfg: OIDCSettings): void {
  oidcSettings = cfg;
  config = null;
}

export function isOIDCEnabled(): boolean {
  return !!oidcSettings;
}

export function getAppUrl(): string {
  return oidcSettings?.appUrl || `http://localhost:${process.env.PORT || 3000}`;
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/auth/oidc/callback`;
}

export async function getOIDCConfig(): Promise<client.Configuration> {
  if (!oidcSettings) throw new Error('OIDC not configured');
  if (config) return config;

  const issuer = new URL(oidcSettings.issuerUrl);
  config = await client.discovery(
    issuer,
    oidcSettings.clientId,
    oidcSettings.clientSecret,
  );

  return config;
}
