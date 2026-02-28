import { environment } from '../../../environments/environment';

export function getApiUrl(): string {
  const url = (environment.apiUrl || '').trim();
  // If the environment explicitly sets a URL and it's not a localhost dev URL, use it.
  // Treat any "localhost" value as a development artifact and prefer same-origin.
  if (url && url !== '/api' && !/localhost(:|$)/.test(url)) {
    return url;
  }

  // If environment provides '/api' or is empty, fall back to same-origin /api.
  return `${window.location.origin}/api`;
}

export function getApiBase(): string {
  return getApiUrl().replace('/api', '');
}
