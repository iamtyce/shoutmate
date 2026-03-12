export type Route =
  | { view: 'home' }
  | { view: 'trip'; tripId: string }
  | { view: 'share'; payload: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (!path) return { view: 'home' };
  const shareMatch = path.match(/^share\/(.+)$/);
  if (shareMatch) return { view: 'share', payload: shareMatch[1] };
  return { view: 'trip', tripId: path };
}

export function navigate(path: string): void {
  window.location.hash = path ? `/${path}` : '/';
}
