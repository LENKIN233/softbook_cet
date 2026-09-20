const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const answerLabels = new Set(['正确答案', '你的选择', '核对答案']);

export function readableExperienceText(observation, expected, {answer = false} = {}) {
  // Vision may interleave the vertically centered left-column label between
  // wrapped lines in the answer column. Remove only complete known UI labels;
  // never approximate, replace, or drop missing answer characters.
  const lines = observation.lines.filter(line =>
    !answer || !answerLabels.has(normalize(line.text)),
  );
  const visible = normalize(lines.map(line => line.text).join(' '));
  return (Array.isArray(expected) ? expected : [expected])
    .every(value => visible.includes(normalize(value)));
}
