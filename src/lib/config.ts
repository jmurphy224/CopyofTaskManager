const env = import.meta.env;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY ?? '';

/** Demo mode runs entirely in the browser with sample data. */
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const ALLOWED_EMAIL_DOMAINS: string[] = (env.VITE_ALLOWED_EMAIL_DOMAINS ?? 'fogarty.com')
  .split(',')
  .map((d: string) => d.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

export type AuthProvider = 'google' | 'azure' | 'email';

export const AUTH_PROVIDERS: AuthProvider[] = (env.VITE_AUTH_PROVIDERS ?? 'google,azure,email')
  .split(',')
  .map((p: string) => p.trim())
  .filter((p: string): p is AuthProvider => p === 'google' || p === 'azure' || p === 'email');

/** Tasks with no deadline time are due at this time (end of business day). */
export const END_OF_DAY = '16:00';

/** Returns true when the email belongs to one of the allowed domains. */
export function isAllowedEmail(email: string, domains: string[] = ALLOWED_EMAIL_DOMAINS): boolean {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 1) return false;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return domains.includes(domain);
}
