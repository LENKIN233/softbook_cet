import type { EliminationCard, LearningCard, LearningCardState, LearningCardResult } from './model';

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

export function displayCardText(card: LearningCard, text: string) {
  const value = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  return card.interaction_id === 'lock' ? value.replace(/\{\{blank\}\}/g, '____') : value;
}

export function frontMaterial(card: LearningCard) {
  const seen = new Set([displayCardText(card, card.front.prompt).trim()]);
  return [card.front.support, card.front.context].flatMap(text => {
    let value = withoutRepeatedTask(text, card.front.prompt).trim();
    if (card.interaction_id === 'multiple_choice') {
      // Remove only an exact trailing option block already shown as controls.
      const options = card.options.map(option => `${option.label}. ${option.text}`).join('\n');
      if (value.endsWith(options)) value = value.slice(0, -options.length).trimEnd();
    }
    value = displayCardText(card, value);
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
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
    return { correct: lockPassage(card, card.answer_key.lock_pattern), selected: null };
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
    .map(item => item.text)
    .join(' · ');
  // These are the exact choices being graded. Rejoining the remaining text can
  // leave non-selectable connectors behind and teach an ungrammatical sentence.
  return {
    correct: itemText(card.answer_key.correct_items),
    selected: itemText(state.eliminatedItemIds) || '未划去任何内容',
  };
}

export function lockPassage(card: Extract<LearningCard, {interaction_id: 'lock'}>, values: readonly (string | null)[]) {
  const source = lockPassageSource(card);
  if (!source) return card.lock_slots.map((slot, index) => `${slot.label}：${values[index] ?? '____'}`).join('；');
  let index = 0;
  return source.replace(/\{\{blank\}\}/g, () => values[index++] ?? '____');
}
export function stateDescription(option: {label: string; description: string} | undefined) {
  return option ? option.label.trim() === option.description.trim()
    ? option.label : `${option.label} · ${option.description}` : '未选择';
}
export function answerHeading(card: LearningCard) {
  return card.interaction_id === 'elimination' ? '应删除的部分' : card.interaction_id === 'flip' ? '核对答案' : card.interaction_id === 'lock' ? '补全后的内容' : '正确答案';
}

export function cardTextParts(card: LearningCard, text: string) {
  const source = card.interaction_id === 'lock' ? text.replace(/\{\{blank\}\}/g, '____') : text;
  return source.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part =>
    /^\*\*[^*]+\*\*$/.test(part) ? {text: part.slice(2, -2), emphasized: true} : {text: part, emphasized: false});
}

export function newCardGroup(card: LearningCard | null, catalog: readonly LearningCard[], results: readonly LearningCardResult[], sleeping: readonly string[]) {
  if (!card) return undefined;
  const libraryCards = catalog.filter(item => item.space_metadata.library === card.space_metadata.library);
  const learned = new Set(results.filter(result => result.cardId !== card.card_id).map(result => result.cardId));
  const count = libraryCards.filter(item => learned.has(item.card_id)).length;
  const step = count % 5 + 1;
  const remaining = libraryCards.filter(item => item.card_id === card.card_id || (!learned.has(item.card_id) && !sleeping.includes(item.card_id))).length;
  return {step, size: Math.max(step, Math.min(5, step - 1 + remaining))};
}

export function lockPassageSource(card: LearningCard) {
  if (card.interaction_id !== 'lock') return undefined;
  return [card.front.support, card.front.context, card.front.prompt].map(text => withoutRepeatedTask(text, card.front.prompt).trim()).find(text =>
    (text.match(/\{\{blank\}\}/g) ?? []).length === card.lock_slots.length);
}
export function attemptLabel(result: LearningCardResult) {
  if (result.outcome === 'correct') return '本次答对';
  if (result.outcome === 'incorrect') return result.interactionId === 'lock' ? '本次曾选错，稍后复习' : '本次答错，稍后复习';
  return result.outcome === 'confident' ? '有把握' : '需要复习';
}
