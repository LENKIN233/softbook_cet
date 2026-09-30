const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const inlineDeletionLabels = ['应删除的部分', '你删除的部分', '应划去的部分', '你划去的部分'];
const answerLabels = new Set(['正确答案', '你的选择', '核对答案', ...inlineDeletionLabels]);

export function readableExperienceText(observation, expected, {answer = false} = {}) {
  // Vision may interleave or merge an exact left-column label into a wrapped
  // answer line. Remove only those known labels, never inferred answer text.
  const lines = observation.lines.flatMap(line => {
    if (!answer) return [line];
    const value = line.text.trim();
    if (answerLabels.has(normalize(value))) return [];
    const mergedLabel = inlineDeletionLabels.find(label => value.startsWith(label));
    return [{text: mergedLabel ? value.slice(mergedLabel.length) : line.text}];
  });
  const visible = normalize(lines.map(line => line.text).join(' '));
  return (Array.isArray(expected) ? expected : [expected])
    .every(value => visible.includes(normalize(value)));
}

export function readableBilingualExperienceText(primary, englishFirst, expected) {
  const firstEnglish = expected.search(/[A-Za-z]/);
  if (firstEnglish <= 0) return false;
  return readableExperienceText(primary, expected.slice(0, firstEnglish)) &&
    readableExperienceText(englishFirst, expected.slice(firstEnglish));
}

// Pure English answers may be misread under Vision's Chinese priority. The
// alternate still has to read every expected word from the same image; it
// cannot certify Chinese copy or fill gaps in a bilingual answer.
export function isEnglishExperienceAnswer(expected) {
  const values = Array.isArray(expected) ? expected : [expected];
  return values.length > 0 && values.every(value =>
    /[A-Za-z]/.test(value) && !/\p{Script=Han}/u.test(value));
}
