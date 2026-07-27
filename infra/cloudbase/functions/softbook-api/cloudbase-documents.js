function normalizeCloudBaseDocuments(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (isDocumentListEnvelope(data)) {
    return data.list;
  }

  return data === null || data === undefined ? [] : [data];
}

function isDocumentListEnvelope(value) {
  // CloudBase 4.0.3 transaction doc.get() wraps its result in {list: [...]}.
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Array.isArray(value.list)
  );
}

module.exports = {
  normalizeCloudBaseDocuments,
};
