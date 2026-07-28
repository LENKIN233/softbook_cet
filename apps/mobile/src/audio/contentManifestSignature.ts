import * as ed25519 from '@noble/ed25519';
import {sha512} from '@noble/hashes/sha2.js';

import type {ContentManifestSignatureVerifier} from './contentManifestRepository';

ed25519.hashes.sha512 = sha512;

export type ContentManifestPublicKeyring = Readonly<Record<string, string>>;

export function createPinnedContentManifestSignatureVerifier(
  publicKeys: ContentManifestPublicKeyring,
): ContentManifestSignatureVerifier {
  const validatedKeys = Object.fromEntries(
    Object.entries(publicKeys).map(([keyId, publicKey]) => {
      if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(keyId)) {
        throw new Error('Content manifest public key ID is invalid.');
      }
      if (!/^[a-f0-9]{64}$/.test(publicKey)) {
        throw new Error(
          `Content manifest public key ${keyId} must be 32-byte lowercase hex.`,
        );
      }
      return [keyId, publicKey];
    }),
  );

  if (Object.keys(validatedKeys).length === 0) {
    throw new Error('At least one pinned content manifest public key is required.');
  }

  return ({canonicalPayload, keyId, signature}) => {
    const publicKey = validatedKeys[keyId];

    if (!publicKey || !/^[a-f0-9]{128}$/.test(signature)) {
      return false;
    }

    try {
      return ed25519.verify(
        ed25519.etc.hexToBytes(signature),
        new TextEncoder().encode(canonicalPayload),
        ed25519.etc.hexToBytes(publicKey),
        {zip215: false},
      );
    } catch {
      return false;
    }
  };
}
