import type { EliminationCard, LearningCard, LearningCardState, LockCard } from './model';

// Never guess which distinct front text is optional: imported front material
// remains visible. Only exact repeats of already-visible text are suppressed.
// An explicit task label may repeat the question already displayed above the material.
// Remove only a verbatim repeat; different instructions and every passage remain visible.
function withoutRepeatedTask(text: string, prompt: string) {
  const value = text.trim();
  for (const prefix of ['任务：', '任务:', '任务: ', 'Task: ', 'Task:']) {
    const repeated = `${prefix}${prompt.trim()}`;
    if (value === repeated) return prompt.trim();
    for (const separator of ['\n\n', '\n', ' ']) {
      const suffix = `${separator}${repeated}`;
      if (value.endsWith(suffix)) return value.slice(0, -suffix.length).trimEnd();
    }
  }
  return text;
}

export function displayCardText(card: LearningCard, text: string, state?: LearningCardState) {
  if (card.interaction_id !== 'lock') return text;
  const blank = /\{\{blank\}\}|_{2,}/g;
  if (state && (text.match(blank)?.length ?? 0) === card.lock_slots.length) {
    let index = 0;
    return text.replace(blank, () => {
      const slot = card.lock_slots[index];
      const expected = card.answer_key.lock_pattern[index++];
      return state.lockSelections[slot.id] === expected ? expected : '____';
    });
  }
  return text.replace(/\{\{blank\}\}/g, '____');
}

export function frontMaterial(card: LearningCard, state?: LearningCardState) {
  const seen = new Set([displayCardText(card, card.front.prompt, state).trim()]);
  return [card.front.support, card.front.context].flatMap(text => {
    const value = displayCardText(card, withoutRepeatedTask(text, card.front.prompt), state).trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}

// Paragraph boundaries are authored content. Keep them, and only soften a
// standalone glossary when every entry has an explicit word: meaning structure.
export function cardTextBlocks(text: string) {
  const paragraphs = text.trim().split(/\n\s*\n/);
  return paragraphs.map((value, index) => ({
    text: value,
    gloss: paragraphs.length > 1 && index === paragraphs.length - 1 &&
      value.split(/[；;]/).every(entry => /^[A-Za-z][A-Za-z '\u2019-]{0,55}[：:]\s*[^\n。？！?!；;]{1,28}$/.test(entry.trim())),
  }));
}

export function lockTemplate(card: LockCard) {
  const blank = /\{\{blank\}\}|_{2,}/g;
  for (const source of [card.front.prompt, card.front.support, card.front.context]) {
    if ((source.match(blank)?.length ?? 0) !== card.lock_slots.length) continue;
    // Show the complete authored sentence/task containing the slots, not a
    // guessed sentence made by concatenating answers or stripping punctuation.
    const paragraphs = source.split(/\n\s*\n/).filter(text => /\{\{blank\}\}|_{2,}/.test(text));
    return paragraphs.map(paragraph => paragraph.split('\n').filter(line =>
      // Only an explicit standalone task line is omitted from the result.
      // Slot-bearing lines and all other authored context stay intact.
      !line.trimStart().startsWith('结构练习：') || /\{\{blank\}\}|_{2,}/.test(line),
    ).join('\n')).join('\n\n');
  }
  return null;
}

export function lockAnswerText(card: LockCard, values: readonly (string | null)[]) {
  const template = lockTemplate(card);
  if (template) {
    let index = 0;
    return template.replace(/\{\{blank\}\}|_{2,}/g, () => values[index++] ?? '____');
  }
  // Some locks classify sentence components rather than fill a template.
  // Preserve those labels; their order alone is not a grammatical sentence.
  return card.lock_slots.map((slot, index) => `${slot.label}：${values[index] ?? '____'}`).join('\n');
}

export function resultAnswerLabel(card: LearningCard) {
  switch (card.interaction_id) {
    case 'flip': return '核对答案';
    case 'elimination': return '应划去的部分';
    case 'lock': return '填写结果';
    case 'swipe': return '正确判断';
    default: return '正确答案';
  }
}

export function spaceCardPreview(card: LearningCard) {
  const material = frontMaterial(card);
  const prompt = displayCardText(card, card.front.prompt);
  const usesMaterialTitle = (card.interaction_id === 'lock' || card.interaction_id === 'elimination') && material.length > 0;
  return usesMaterialTitle
    ? {title: material[0], detail: [prompt, ...material.slice(1)]}
    : {title: prompt, detail: material};
}

export type PassageSegment = { text: string; itemId?: string };
export type EliminationPassage = { source: string; segments: PassageSegment[] };

export function eliminationPassage(
  card: EliminationCard,
): EliminationPassage | null {
  for (const source of [
    card.front.support,
    card.front.context,
    card.front.prompt,
  ].map(text => withoutRepeatedTask(text, card.front.prompt))) {
    const spans = card.elimination_items.map(item => {
      const start = source.indexOf(item.text);
      return { start, end: start + item.text.length, item };
    });
    // Ambiguous or overlapping text has no safe one-to-one spatial mapping.
    if (
      spans.some(
        span =>
          span.start < 0 ||
          !span.item.text ||
          source.indexOf(span.item.text, span.start + 1) !== -1,
      )
    )
      continue;
    spans.sort((left, right) => left.start - right.start);
    if (
      spans.some(
        (span, index) => index > 0 && span.start < spans[index - 1].end,
      )
    )
      continue;
    const correctIds = new Set(card.answer_key.correct_items);
    for (let index = 1; index < spans.length; index += 1) {
      const previous = spans[index - 1];
      const current = spans[index];
      const between = source.slice(previous.end, current.start);
      if (
        correctIds.has(current.item.id) &&
        (correctIds.has(previous.item.id) ||
          /^\s*(?:[,;—–]\s*)?(?:and|or|when|because|while)\s+$/i.test(between) ||
          /^[,;—–]\s*$/.test(between))
      ) {
        current.start = previous.end;
      }
    }
    const segments: PassageSegment[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor)
        segments.push({ text: source.slice(cursor, span.start) });
      segments.push({ text: source.slice(span.start, span.end), itemId: span.item.id });
      cursor = span.end;
    }
    if (cursor < source.length) segments.push({ text: source.slice(cursor) });
    return { source, segments };
  }
  return null;
}

export function answerComparison(card: LearningCard, state: LearningCardState) {
  if (card.interaction_id === 'flip')
    return { correct: card.back_text, selected: null };
  if (card.interaction_id === 'multiple_choice') {
    const optionText = (id: string | null) => {
      const option = card.options.find(item => item.id === id);
      return option ? `${option.label} · ${option.text}` : '未选择';
    };
    return {
      correct: optionText(card.answer_key.correct_option),
      selected: optionText(state.selectedOptionId),
    };
  }
  if (card.interaction_id === 'lock') {
    return { correct: lockAnswerText(card, card.answer_key.lock_pattern), selected: null };
  }
  if (card.interaction_id === 'swipe') {
    const stateText = (id: string | null) => {
      const option = card.swipe_states.find(item => item.id === id);
      return option ? option.description : '未选择';
    };
    return {
      correct: stateText(card.answer_key.correct_state),
      selected: stateText(state.swipeSelection),
    };
  }
  const itemText = (ids: readonly string[]) => card.elimination_items
    .filter(item => ids.includes(item.id))
    .map(item => `− ${item.text}`)
    .join('\n');
  // These are the exact choices being graded. Rejoining the remaining text can
  // leave non-selectable connectors behind and teach an ungrammatical sentence.
  return {
    correct: itemText(card.answer_key.correct_items),
    selected: itemText(state.eliminatedItemIds) || '未划去任何内容',
  };
}
