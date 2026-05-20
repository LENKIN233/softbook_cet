import {
  formatSpaceBoxLabel,
  formatSpaceGroupLabel,
  formatSpaceLibraryLabel,
} from '../shared/uiMetadata/displayMetadata';

export {
  formatLearningSessionDisplayLabel,
  formatSpaceBoxLabel,
  formatSpaceGroupLabel,
  formatSpaceLibraryLabel,
} from '../shared/uiMetadata/displayMetadata';

export type SpacePositionIndexes = {
  libraryIndex: number;
  groupIndex: number;
  boxIndex: number;
};

export type SpaceSeedLike = {
  libraries: Array<{
    libraryName: string;
    groups: Array<{
      groupName: string;
      boxes: Array<{ boxRef: string }>;
    }>;
  }>;
};

export function formatSpacePathByIndex(
  libraryIndex: number,
  groupIndex: number,
  boxIndex: number,
) {
  return `${formatSpaceLibraryLabel(libraryIndex)} / ${formatSpaceGroupLabel(
    groupIndex,
  )} / ${formatSpaceBoxLabel(boxIndex)}`;
}

export function resolveSpacePosition(
  seed: SpaceSeedLike,
  metadata: {
    space_metadata: {
      library: string;
      group: string;
      box_ref: string;
    };
  },
): SpacePositionIndexes | null {
  const libraryIndex = seed.libraries.findIndex(
    library => library.libraryName === metadata.space_metadata.library,
  );

  if (libraryIndex < 0) {
    return null;
  }

  const library = seed.libraries[libraryIndex];
  const groupIndex = library.groups.findIndex(
    group => group.groupName === metadata.space_metadata.group,
  );

  if (groupIndex < 0) {
    return null;
  }

  const group = library.groups[groupIndex];
  const boxIndex = group.boxes.findIndex(
    box => box.boxRef === metadata.space_metadata.box_ref,
  );

  if (boxIndex < 0) {
    return null;
  }

  return {
    libraryIndex: Math.max(libraryIndex + 1, 1),
    groupIndex: Math.max(groupIndex + 1, 1),
    boxIndex: Math.max(boxIndex + 1, 1),
  };
}
