import type { EliminationCard, LearningCard, LearningCardState } from './model';

// Never guess which distinct front text is optional: imported front material
// remains visible. Only exact repeats of already-visible text are suppressed.
// An explicit task label may repeat the question already displayed above the material.
// Remove only a verbatim repeat; different instructions and every passage remain visible.
function withoutRepeatedTask(text: string, prompt: string) {
  const value = text.trim();
  for (const prefix of ['任务：', '任务:', '任务: ', 'Task: ', 'Task:']) {
    const repeated = `${prefix}${prompt.trim()}`;
    if (value === repeated) return prompt.trim();
    const suffix = `\n\n${repeated}`;
    if (value.endsWith(suffix)) return value.slice(0, -suffix.length).trimEnd();
  }
  return text;
}

export function frontMaterial(card: LearningCard) {
  const seen = new Set([card.front.prompt.trim()]);
  return [card.front.support, card.front.context].flatMap(text => {
    const value = withoutRepeatedTask(text, card.front.prompt).trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [value];
  });
}

export function spaceCardPreview(card: LearningCard) {
  const material = frontMaterial(card);
  const usesMaterialTitle = (card.interaction_id === 'lock' || card.interaction_id === 'elimination') && material.length > 0;
  return usesMaterialTitle
    ? {title: material[0], detail: [card.front.prompt, ...material.slice(1)]}
    : {title: card.front.prompt, detail: material};
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
    const segments: PassageSegment[] = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.start > cursor)
        segments.push({ text: source.slice(cursor, span.start) });
      segments.push({ text: span.item.text, itemId: span.item.id });
      cursor = span.end;
    }
    if (cursor < source.length) segments.push({ text: source.slice(cursor) });
    return { source, segments };
  }
  return null;
}

export function survivingPassage(
  passage: EliminationPassage,
  removedIds: readonly string[],
) {
  return passage.segments
    .filter(segment => !segment.itemId || !removedIds.includes(segment.itemId))
    .map(segment => segment.text)
    .join('')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
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
    return { correct: card.answer_key.lock_pattern.join(' '), selected: null };
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
  const passage = eliminationPassage(card);
  return passage
    ? {
        correct: survivingPassage(passage, card.answer_key.correct_items),
        selected: survivingPassage(passage, state.eliminatedItemIds),
      }
    : {
        correct: card.elimination_items
          .filter(item => !card.answer_key.correct_items.includes(item.id))
          .map(item => item.text)
          .join('；'),
        selected: card.elimination_items
          .filter(item => !state.eliminatedItemIds.includes(item.id))
          .map(item => item.text)
          .join('；'),
      };
}
