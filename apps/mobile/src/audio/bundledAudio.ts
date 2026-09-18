import type {LearningCard} from '../learning/model';
import {findBundledAudioAsset} from '../learning/bundledCardLibrary';
import type {BundledLearningAudioSelection} from './learningAudioController';
import type {ContentManifestAsset} from './contentManifestRepository';

export function requireBundledAudioAsset(asset: ContentManifestAsset) {
  const bundled = findBundledAudioAsset(asset.asset_id);
  if (!bundled || bundled.sha256 !== asset.sha256 || bundled.size_bytes !== asset.size_bytes ||
      bundled.duration_ms !== asset.duration_ms || bundled.media_type !== asset.media_type ||
      !/^audio\/cet[46]\/\d{4}\/\d{6}\.mp3$/.test(bundled.asset_path)) {
    throw new Error('Audio does not match the bundled library.');
  }
  return bundled;
}

export function bundledAudioSelection(card: LearningCard, attemptId: string): BundledLearningAudioSelection | null {
  if (!card.audio) return null;
  const asset = findBundledAudioAsset(card.audio.asset_id);
  if (!asset || asset.sha256 !== card.audio.sha256 || asset.duration_ms !== card.audio.duration_ms) {
    throw new Error('Card audio does not match the bundled library.');
  }
  return {asset, download: null, authorityToken: attemptId, cardToken: `${card.card_id}:${asset.sha256}`};
}
