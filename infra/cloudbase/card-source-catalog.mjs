import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadBoxCatalog(path = resolve(ROOT, 'spec/box-catalog.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function catalogEntriesByRef(catalog, track) {
  const entries = new Map();

  for (const library of catalog.libraries) {
    for (const group of library.groups) {
      for (const box of group.boxes) {
        const ref = box.resolved_box_prefixes?.[track];

        if (!ref) {
          continue;
        }

        entries.set(ref, {
          box: box.name,
          group: group.name,
          library: library.name,
        });
      }
    }
  }

  return entries;
}

export function validateCardSourceCatalogMapping(
  cardSource,
  catalog = loadBoxCatalog(),
) {
  const catalogEntries = catalogEntriesByRef(catalog, cardSource.track);
  const errors = [];

  for (const card of cardSource.card_records) {
    const catalogEntry = catalogEntries.get(card.knowledge_ref);

    if (!catalogEntry) {
      errors.push(`${card.card_id} uses unmapped ${card.knowledge_ref}`);
      continue;
    }

    const expectedPath = [
      catalogEntry.library,
      catalogEntry.group,
      catalogEntry.box,
    ].join('/');
    const actualPath = [
      card.space_metadata.library,
      card.space_metadata.group,
      card.space_metadata.box,
    ].join('/');

    if (actualPath !== expectedPath) {
      errors.push(`${card.card_id} maps to ${actualPath}, expected ${expectedPath}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `card source ${cardSource.track} has catalog mapping errors:\n- ${errors.join('\n- ')}`,
    );
  }

  return cardSource;
}
