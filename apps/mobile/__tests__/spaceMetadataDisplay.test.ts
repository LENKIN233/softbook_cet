/**
 * @format
 */

import {
  formatLearningSessionDisplayLabel,
  formatSpaceBoxLabel,
  formatSpaceGroupLabel,
  formatSpaceLibraryLabel,
  formatSpacePathByIndex,
  resolveSpacePosition,
} from '../src/space/spaceMetadataDisplay';

type SeedFixture = Parameters<typeof resolveSpacePosition>[0];
type CardFixture = Parameters<typeof resolveSpacePosition>[1];

const seedFixture: SeedFixture = {
  libraries: [
    {
      libraryName: 'library-a',
      groups: [
        {
          groupName: 'group-alpha',
          boxes: [{ boxRef: 'b01' }, { boxRef: 'b02' }],
        },
      ],
    },
    {
      libraryName: 'library-b',
      groups: [
        {
          groupName: 'group-beta',
          boxes: [{ boxRef: 'b11' }],
        },
      ],
    },
  ],
};

const cardFixture: CardFixture = {
  space_metadata: {
    library: 'library-b',
    group: 'group-beta',
    box_ref: 'b11',
  },
};

test('formats path indexes into anonymous-space labels', () => {
  expect(formatSpacePathByIndex(2, 1, 1)).toBe('馆 2 / 组 1 / 盒 1');
  expect(formatSpaceLibraryLabel(2)).toBe('馆 2');
  expect(formatSpaceGroupLabel(1)).toBe('组 1');
  expect(formatSpaceBoxLabel(1)).toBe('盒 1');
});

test('formats learning session labels without exposing tracks', () => {
  expect(formatLearningSessionDisplayLabel('learning')).toBe('本轮学习卡组');
  expect(formatLearningSessionDisplayLabel('review')).toBe('首轮回看卡组');
});

test('resolves a card to an anonymous index path when available', () => {
  expect(resolveSpacePosition(seedFixture, cardFixture)).toEqual({
    libraryIndex: 2,
    groupIndex: 1,
    boxIndex: 1,
  });
});

test('returns null for unknown metadata lookup', () => {
  expect(
    resolveSpacePosition(seedFixture, {
      space_metadata: { library: 'missing', group: 'x', box_ref: 'y' },
    },
  )).toBeNull();
});
