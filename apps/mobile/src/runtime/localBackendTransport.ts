// Enabled only by the separate local-backend entry. Release entries never call this.
let localOrigin: string | null = null;
export function installLocalBackendTransport(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/api') {
    throw new Error('Local backend must use an explicit loopback port and /api.');
  }
  localOrigin = url.origin;
}
export function isLocalBackendAssetUrl(url: URL) {
  return localOrigin !== null && url.origin === localOrigin && url.pathname.startsWith('/local-assets/') && !url.username && !url.password && !url.hash;
}
export function isLocalBackendTransportEnabled() { return localOrigin !== null; }
