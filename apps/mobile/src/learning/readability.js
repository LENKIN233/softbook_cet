// Approximate text pressure before native/browser layout; content stays intact.
export function readingUnits(text) {
  return Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? 1 : /\s/u.test(char) ? 0.3 : 0.55), 0);
}

export function isLongQuestion(text) {
  return readingUnits(text) > 44 || text.includes('\n');
}

export function stackChoiceOptions(options, availableWidth = 620, fontScale = 1) {
  if (fontScale >= 1.3 || availableWidth < 310) return true;
  const textWidth = (availableWidth - 12) / 2 - 62;
  return options.some(option => option.text.includes('\n') || readingUnits(option.text) * 16 * fontScale > textWidth * 2.5);
}
