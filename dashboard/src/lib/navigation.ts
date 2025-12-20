/**
 * Simple navigation utilities for client-side routing
 */

export function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function getCurrentPath(): string {
  return window.location.pathname;
}

export function getQueryParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}
