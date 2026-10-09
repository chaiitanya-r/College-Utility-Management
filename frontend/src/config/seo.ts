
export const BASE_URL: string = import.meta.env.VITE_APP_BASE_URL ?? '';

export const DEFAULT_TITLE = 'College Utility Management | Unified Campus Operations ERP';

export const DEFAULT_DESCRIPTION =
  'Unified campus facility booking, canteen requisition workflows, maintenance repair ticketing, and AI-powered operations platform for colleges and universities.';

export const DEFAULT_OG_IMAGE = BASE_URL ? `${BASE_URL}/og-preview.png` : '';

export const SITE_NAME = 'College Utility Management';

export function buildCanonical(path: string): string {
  if (!BASE_URL) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${cleanPath}`;
}
