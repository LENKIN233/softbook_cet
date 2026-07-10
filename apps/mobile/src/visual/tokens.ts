export const LIBRARY_IDENTITY = {
  listening: '#5B6DF5',
  reading: '#FF8A3D',
  cloze: '#22C58B',
  writing: '#B568F5',
  translation: '#18C4E0',
  vocabulary: '#F15B6E',
  grammar: '#F5B100',
} as const;

export const SELF_ASSESS_COLORS = {
  confident: '#22C58B',
  review: '#F5B100',
} as const;

type LibraryToneKey = keyof typeof LIBRARY_IDENTITY;

export type LibraryTone = {
  accent: string;
  accentSoft: string;
  accentTint: string;
  accentStrong: string;
  halo: string;
};

const LIBRARY_MATCHERS: Array<[LibraryToneKey, string[]]> = [
  ['listening', ['听力', 'listening']],
  ['reading', ['阅读', '仔细阅读', '快速阅读', 'reading']],
  ['cloze', ['选词', 'cloze']],
  ['writing', ['写作', 'writing']],
  ['translation', ['翻译', 'translation']],
  ['vocabulary', ['词汇', 'vocabulary']],
  ['grammar', ['语法', 'grammar']],
];

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createLibraryTone(hex: string): LibraryTone {
  return {
    accent: hex,
    accentSoft: hexToRgba(hex, 0.12),
    accentTint: hexToRgba(hex, 0.2),
    accentStrong: hexToRgba(hex, 0.72),
    halo: hexToRgba(hex, 0.18),
  };
}

export function resolveLibraryTone(libraryName?: string) {
  const normalized = libraryName?.trim().toLowerCase() ?? '';

  for (const [key, aliases] of LIBRARY_MATCHERS) {
    if (aliases.some(alias => normalized.includes(alias.toLowerCase()))) {
      return createLibraryTone(LIBRARY_IDENTITY[key]);
    }
  }

  return createLibraryTone(LIBRARY_IDENTITY.listening);
}
