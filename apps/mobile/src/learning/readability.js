// Approximate text pressure before native/browser layout; content stays intact.
export function readingUnits(text) {
  return Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? 1 : /\s/u.test(char) ? 0.3 : 0.55), 0);
}

export function isLongQuestion(text) {
  return readingUnits(text) > 44 || text.includes('\n');
}

// Android reports the 1.3 setting as a 32-bit float (about 1.29999995).
export function usesLargeTextLayout(fontScale) {
  return Math.round(fontScale * 100) >= 130;
}

export function stackChoiceOptions(options, availableWidth = 620, fontScale = 1) {
  if (usesLargeTextLayout(fontScale) || availableWidth < 310) return true;
  // Studio tiles place the letter above the text; four short lines remain
  // comparable. Longer material and large system text use one full-width row.
  const textWidth = (availableWidth - 10) / 2 - 24;
  return options.some(option => {
    const comfortableLines = /[\u3400-\u9fff]/u.test(option.text) ? 2 : 4;
    return option.text.includes('\n') || readingUnits(option.text) * 15 * fontScale > textWidth * comfortableLines;
  });
}
