// Deployment replaces this object atomically with:
// {
//   mode: 'remote',
//   clientKind: 'web',
//   baseUrl: 'https://…',
//   track: 'cet4',
//   contentManifestPublicKeys: {'release-key-id': '<64 lowercase hex>'}
// }
// The Ed25519 verification keys are public. Never put API keys, access tokens,
// refresh tokens, SMS credentials, private signing keys, or download credentials here.
window.__SOFTBOOK_WEB_RUNTIME__ = window.__SOFTBOOK_WEB_RUNTIME__ || {};
