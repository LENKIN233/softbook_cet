const DOCUMENT_MISSING_CODES = new Set([
  'DATABASE_DOCUMENT_NOT_EXIST',
  'DATABASE_DOCUMENT_NOT_FOUND',
  'DOCUMENT_NOT_EXIST',
  'DOCUMENT_NOT_FOUND',
]);

function isCloudBaseDocumentMissingError(error) {
  const code =
    error && typeof error === 'object'
      ? String(error.code ?? error.errCode ?? '').toUpperCase()
      : '';

  if (DOCUMENT_MISSING_CODES.has(code)) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('document_not_exist') ||
    normalizedMessage.includes('document_not_found') ||
    normalizedMessage.includes('document not exists') ||
    normalizedMessage.includes('document not found')
  );
}

module.exports = {
  isCloudBaseDocumentMissingError,
};
