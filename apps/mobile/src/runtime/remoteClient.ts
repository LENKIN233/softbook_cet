export const DEFAULT_SOFTBOOK_CLIENT_KIND = 'mobile' as const;
export const SOFTBOOK_CLIENT_HEADER = 'x-softbook-client' as const;

export type SoftbookClientKind = 'mobile' | 'web';

export function resolveSoftbookClientKind(
  value: SoftbookClientKind | undefined,
): SoftbookClientKind {
  if (value === undefined) {
    return DEFAULT_SOFTBOOK_CLIENT_KIND;
  }
  if (value !== 'mobile' && value !== 'web') {
    throw new Error('Softbook client kind must be mobile or web.');
  }
  return value;
}

export function createSoftbookClientHeaders(
  clientKind?: SoftbookClientKind,
  headers: Readonly<Record<string, string>> = {},
): Record<string, string> &
  Record<typeof SOFTBOOK_CLIENT_HEADER, SoftbookClientKind> {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => name.toLowerCase() !== SOFTBOOK_CLIENT_HEADER,
    ),
  );
  return {
    ...normalizedHeaders,
    [SOFTBOOK_CLIENT_HEADER]: resolveSoftbookClientKind(clientKind),
  };
}
