import { environment } from '../../../environments/environment';

export function getApiUrl(): string {
  const url = (environment.apiUrl || '').trim();

  // If the environment explicitly sets a URL, use it as-is.
  if (url && url !== '/api') {
    return url;
  }

  // If environment provides '/api' or is empty, fall back to same-origin /api.
  return `${window.location.origin}/api`;
}

export function getApiBase(): string {
  return getApiUrl().replace('/api', '');
}
