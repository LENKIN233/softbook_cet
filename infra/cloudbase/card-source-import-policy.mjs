export function assertDevelopmentCardSourceImport(cardSource) {
  if (cardSource.release !== null) {
    throw new Error(
      'The development importer cannot publish content releases; use the formal approved-release pipeline.',
    );
  }
}
