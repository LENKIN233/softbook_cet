import type {ContentManifestAsset} from '../audio/contentManifestRepository';

export const BUNDLED_CARD_SOURCE_ID = 'bundled-card-make-v1';
export type BundledAudioAsset = ContentManifestAsset & {asset_path: string};
// The function package owns the single exported payload, shared by all clients.
export {bundledCardData as bundledCardLibrary} from './bundledCardData';
import {bundledCardData} from './bundledCardData';

export function findBundledAudioAsset(assetId: string) {
  return [...bundledCardData.cet4.assets, ...bundledCardData.cet6.assets]
    .find(asset => asset.asset_id === assetId) ?? null;
}
