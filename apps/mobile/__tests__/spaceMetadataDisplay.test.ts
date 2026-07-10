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
  expect(formatSpacePathByIndex(2, 1, 1)).toBe(
    '相邻书架一 / 当前分区 / 当前卡盒',
  );
  expect(formatSpaceLibraryLabel(2)).toBe('相邻书架一');
  expect(formatSpaceLibraryLabel(3)).toBe('相邻书架二');
  expect(formatSpaceGroupLabel(1)).toBe('当前分区');
  expect(formatSpaceGroupLabel(2)).toBe('相邻分区一');
  expect(formatSpaceBoxLabel(1)).toBe('当前卡盒');
  expect(formatSpaceBoxLabel(2)).toBe('相邻卡盒一');
});

test('formats learning session labels without exposing tracks', () => {
  expect(formatLearningSessionDisplayLabel('learning')).toBe('本轮学习卡');
  expect(formatLearningSessionDisplayLabel('review')).toBe('本轮回看卡');
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
    }),
  ).toBeNull();
});
