export const DEVELOPMENT_CARD_SOURCE_ENV_ID = 'test-d2gzcyxr9f7e80972';

export function assertDevelopmentCardSourceImport(
  cardSource,
  {envId = DEVELOPMENT_CARD_SOURCE_ENV_ID} = {},
) {
  if (envId !== DEVELOPMENT_CARD_SOURCE_ENV_ID) {
    throw new Error(
      `The development importer is pinned to ${DEVELOPMENT_CARD_SOURCE_ENV_ID}; production content must use the formal approved-release pipeline.`,
    );
  }
  if (cardSource.release !== null) {
    throw new Error(
      'The development importer cannot publish content releases; use the formal approved-release pipeline.',
    );
  }
}
