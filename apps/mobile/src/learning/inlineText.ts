// Only paired emphasis is interpreted. A lone asterisk can be an authored
// grammaticality marker and must remain literal. No HTML or links are executed.
export function inlineTextSegments(text: string): {text: string; strong: boolean}[] {
  const segments: {text: string; strong: boolean}[] = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) segments.push({text: text.slice(offset, match.index), strong: false});
    segments.push({text: match[1], strong: true});
    offset = match.index + match[0].length;
  }
  if (offset < text.length) segments.push({text: text.slice(offset), strong: false});
  return segments;
}
