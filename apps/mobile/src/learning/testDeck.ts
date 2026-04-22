export type LearningInteractionId =
  | 'flip'
  | 'multiple_choice'
  | 'lock'
  | 'elimination'
  | 'swipe';

type LearningTrack = 'cet4' | 'cet6';

type LearningFront = {
  eyebrow: string;
  prompt: string;
  support: string;
  context: string;
};

type LearningAnalysis = {
  title: string;
  summary: string;
  exam_tip: string;
};

type LearningHintLayer = {
  label: string;
  content: string;
  reveal_gesture: '下滑';
};

type SpaceMetadata = {
  library: string;
  group: string;
  box: string;
};

type LearningBaseCard = {
  card_id: string;
  track: LearningTrack;
  knowledge_ref: string;
  interaction_id: LearningInteractionId;
  front: LearningFront;
  analysis: LearningAnalysis;
  hint_layer?: LearningHintLayer;
  auto_scoring?: boolean;
  space_metadata: SpaceMetadata;
};

type LearningOption = {
  id: string;
  label: string;
  text: string;
};

type LockSlot = {
  id: string;
  label: string;
  options: string[];
};

type EliminationItem = {
  id: string;
  text: string;
};

type SwipeState = {
  id: string;
  label: string;
  description: string;
};

export type FlipCard = LearningBaseCard & {
  interaction_id: 'flip';
  back_text: string;
};

export type MultipleChoiceCard = LearningBaseCard & {
  interaction_id: 'multiple_choice';
  options: LearningOption[];
  auto_scoring: true;
  answer_key: {
    correct_option: string;
  };
};

export type LockCard = LearningBaseCard & {
  interaction_id: 'lock';
  lock_slots: LockSlot[];
  auto_scoring: true;
  answer_key: {
    lock_pattern: string[];
  };
};

export type EliminationCard = LearningBaseCard & {
  interaction_id: 'elimination';
  elimination_items: EliminationItem[];
  auto_scoring: true;
  answer_key: {
    correct_items: string[];
  };
};

export type SwipeCard = LearningBaseCard & {
  interaction_id: 'swipe';
  swipe_states: SwipeState[];
  auto_scoring: true;
  answer_key: {
    correct_state: string;
  };
};

export type LearningCard =
  | FlipCard
  | MultipleChoiceCard
  | LockCard
  | EliminationCard
  | SwipeCard;

export type LearningCardState = {
  isPeeked: boolean;
  isFavorited: boolean;
  isHintVisible: boolean;
  isFlipped: boolean;
  flipConfidence: 'confident' | 'review' | null;
  selectedOptionId: string | null;
  lockSelections: Record<string, string | null>;
  eliminatedItemIds: string[];
  swipeSelection: string | null;
};

export type LearningCardResultOutcome =
  | 'correct'
  | 'incorrect'
  | 'confident'
  | 'review';

export type LearningCardResult = {
  cardId: string;
  interactionId: LearningInteractionId;
  outcome: LearningCardResultOutcome;
  usedHint: boolean;
  usedPeek: boolean;
  isFavorited: boolean;
};

export const INTERACTION_LABELS: Record<LearningInteractionId, string> = {
  flip: '翻面',
  multiple_choice: '四选一',
  lock: '开锁',
  elimination: '消除',
  swipe: '滑动',
};

export const LEARNING_TEST_CARDS: LearningCard[] = [
  {
    card_id: 'cet4-reading-turn-001',
    track: 'cet4',
    knowledge_ref: 'reading.logic.turning_signal.however',
    interaction_id: 'flip',
    front: {
      eyebrow: '阅读 | 逻辑信号词',
      prompt: '看到 however 时，第一步先检查哪种关系？',
      support: '先抓逻辑，不要急着逐词翻译。',
      context: '真题里 however 常把有效信息压在转折后半句。',
    },
    back_text: '优先检查“前句让步，后句转折修正”的关系，再回看细节。',
    analysis: {
      title: '先判转折，再做选项比对',
      summary:
        'CET 阅读里 however 后面的内容更容易承载作者真正态度。先锁定转折位，能减少只复述前半句的干扰项。',
      exam_tip: '如果选项只重复转折前内容，通常不是最终答案。',
    },
    hint_layer: {
      label: '提示层',
      content: '先问自己：作者是在收回前一句，还是补一个例外？',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      library: '阅读',
      group: '逻辑关系',
      box: '转折信号',
    },
  },
  {
    card_id: 'cet4-vocab-choice-002',
    track: 'cet4',
    knowledge_ref: 'vocabulary.precision.unclear_details',
    interaction_id: 'multiple_choice',
    front: {
      eyebrow: '词义辨析 | 四选一',
      prompt:
        'The committee postponed the vote because several details were still ____.',
      support: '选出最符合句意的词。',
      context: '投票被推迟，说明关键信息还没有清楚。',
    },
    options: [
      { id: 'urgent', label: 'A', text: 'urgent' },
      { id: 'unclear', label: 'B', text: 'unclear' },
      { id: 'formal', label: 'C', text: 'formal' },
      { id: 'similar', label: 'D', text: 'similar' },
    ],
    answer_key: {
      correct_option: 'unclear',
    },
    auto_scoring: true,
    analysis: {
      title: '先顺着因果看语义',
      summary:
        '因为“细节还不清楚”才会推迟投票。urgent 和 formal 都能修饰 details，但和 postpone the vote 的因果不成立。',
      exam_tip: '四选一别孤立看词，先把它塞回原句，看前后逻辑是不是闭合。',
    },
    hint_layer: {
      label: '提示层',
      content: 'postpone 往往搭配“信息未定 / 条件未备齐”的原因。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      library: '词汇',
      group: '近义辨析',
      box: '因果搭配',
    },
  },
  {
    card_id: 'cet4-sentence-lock-003',
    track: 'cet4',
    knowledge_ref: 'reading.sentence_trunk.subject_verb_object',
    interaction_id: 'lock',
    front: {
      eyebrow: '句干提取 | 开锁',
      prompt: '把句子主干锁出来，三个槽位都对才开锁。',
      support: '先抓主语，再找谓语和核心宾语。',
      context: '复杂修饰里先保住 S + V + O，读长句会轻很多。',
    },
    lock_slots: [
      {
        id: 'subject',
        label: '主语',
        options: ['The policy', 'reduces', 'test anxiety'],
      },
      {
        id: 'verb',
        label: '谓语',
        options: ['test anxiety', 'The policy', 'reduces'],
      },
      {
        id: 'object',
        label: '宾语',
        options: ['reduces', 'test anxiety', 'during revision'],
      },
    ],
    answer_key: {
      lock_pattern: ['The policy', 'reduces', 'test anxiety'],
    },
    auto_scoring: true,
    analysis: {
      title: '开锁的关键是别让修饰词抢主干',
      summary:
        '很多真题长句故意把时间、方式、插入解释塞进句中。先锁主语、谓语、宾语，剩下修饰再慢慢挂回去。',
      exam_tip: '如果一句话太长，先问自己“是谁做了什么”，再补其他成分。',
    },
    hint_layer: {
      label: '提示层',
      content: '遇到长句先找有限动词，主语通常会围着它出现。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      library: '阅读',
      group: '长难句',
      box: '句干开锁',
    },
  },
  {
    card_id: 'cet4-elimination-004',
    track: 'cet4',
    knowledge_ref: 'reading.sentence_trunk.remove_noise',
    interaction_id: 'elimination',
    front: {
      eyebrow: '句干提取 | 消除',
      prompt: '点掉应删除的干扰成分，保留句干。',
      support:
        '目标句：The students who review in short bursts usually remember the pattern before the test.',
      context: '先把修饰成分剥掉，再回到主谓宾。',
    },
    elimination_items: [
      { id: 'relative_clause', text: 'who review in short bursts' },
      { id: 'adverb', text: 'usually' },
      { id: 'object', text: 'the pattern' },
      { id: 'time_phrase', text: 'before the test' },
    ],
    answer_key: {
      correct_items: ['relative_clause', 'adverb', 'time_phrase'],
    },
    auto_scoring: true,
    analysis: {
      title: '去干扰不是乱删，是先保骨架',
      summary:
        '这句的句干是 The students remember the pattern。定语从句、频率副词和时间状语都能先剥离，帮助你看清主干。',
      exam_tip: '做阅读细节题时，先保住主干能更快比对选项信息是否被改写。',
    },
    hint_layer: {
      label: '提示层',
      content: '先保留主语、谓语、核心宾语，状语和定语从句可以先暂存。',
      reveal_gesture: '下滑',
    },
    space_metadata: {
      library: '阅读',
      group: '长难句',
      box: '去干扰',
    },
  },
  {
    card_id: 'cet4-translation-swipe-005',
    track: 'cet4',
    knowledge_ref: 'translation.pattern.be_likely_to_do',
    interaction_id: 'swipe',
    front: {
      eyebrow: '翻译 | 滑动判断',
      prompt: 'be likely to do 在翻译里更接近哪一侧？',
      support: '用双态判断压低进入成本。',
      context: '别把 likely 误读成“喜欢”，它更常表达概率。',
    },
    swipe_states: [
      {
        id: 'safe',
        label: '可直接套用',
        description: '表达“很可能做某事”。',
      },
      {
        id: 'risky',
        label: '容易误用',
        description: '误写成“对某事很喜欢”。',
      },
    ],
    answer_key: {
      correct_state: 'safe',
    },
    auto_scoring: true,
    analysis: {
      title: '先稳住高频表达的中文落点',
      summary:
        'be likely to do 先落到“很可能……”最稳。考试里如果把 likely 当 like 去理解，翻译会直接偏题。',
      exam_tip: '翻译高频结构时，优先记“最稳的中文落点”，比背一串近义表达更有用。',
    },
    space_metadata: {
      library: '翻译',
      group: '高频结构',
      box: '概率表达',
    },
  },
];

export function createLearningCardState(
  card: LearningCard,
): LearningCardState {
  const lockSelections =
    card.interaction_id === 'lock'
      ? card.lock_slots.reduce<Record<string, string | null>>((carry, slot) => {
          carry[slot.id] = null;
          return carry;
        }, {})
      : {};

  return {
    isPeeked: false,
    isFavorited: false,
    isHintVisible: false,
    isFlipped: false,
    flipConfidence: null,
    selectedOptionId: null,
    lockSelections,
    eliminatedItemIds: [],
    swipeSelection: null,
  };
}

export function canSubmitLearningCard(
  card: LearningCard,
  state: LearningCardState,
) {
  switch (card.interaction_id) {
    case 'flip':
      return state.isFlipped && state.flipConfidence !== null;
    case 'multiple_choice':
      return state.selectedOptionId !== null;
    case 'lock':
      return card.lock_slots.every(slot => state.lockSelections[slot.id] !== null);
    case 'elimination':
      return state.eliminatedItemIds.length > 0;
    case 'swipe':
      return state.swipeSelection !== null;
    default:
      return false;
  }
}

export function evaluateLearningCard(
  card: LearningCard,
  state: LearningCardState,
): LearningCardResult | null {
  const baseResult = {
    cardId: card.card_id,
    interactionId: card.interaction_id,
    usedHint: state.isHintVisible,
    usedPeek: state.isPeeked,
    isFavorited: state.isFavorited,
  };

  switch (card.interaction_id) {
    case 'flip':
      if (!state.isFlipped || state.flipConfidence === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome: state.flipConfidence,
      };
    case 'multiple_choice':
      if (state.selectedOptionId === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome:
          state.selectedOptionId === card.answer_key.correct_option
            ? 'correct'
            : 'incorrect',
      };
    case 'lock':
      if (!canSubmitLearningCard(card, state)) {
        return null;
      }

      return {
        ...baseResult,
        outcome: card.answer_key.lock_pattern.every(
          (expectedValue, index) =>
            state.lockSelections[card.lock_slots[index].id] === expectedValue,
        )
          ? 'correct'
          : 'incorrect',
      };
    case 'elimination':
      if (!canSubmitLearningCard(card, state)) {
        return null;
      }

      return {
        ...baseResult,
        outcome: areStringSetsEqual(
          state.eliminatedItemIds,
          card.answer_key.correct_items,
        )
          ? 'correct'
          : 'incorrect',
      };
    case 'swipe':
      if (state.swipeSelection === null) {
        return null;
      }

      return {
        ...baseResult,
        outcome:
          state.swipeSelection === card.answer_key.correct_state
            ? 'correct'
            : 'incorrect',
      };
    default:
      return null;
  }
}

export function summarizeLearningResults(results: LearningCardResult[]) {
  return {
    completed: results.length,
    total: LEARNING_TEST_CARDS.length,
    autoCorrectCount: results.filter(result => result.outcome === 'correct').length,
    autoIncorrectCount: results.filter(result => result.outcome === 'incorrect')
      .length,
    confidentFlipCount: results.filter(result => result.outcome === 'confident')
      .length,
    reviewFlipCount: results.filter(result => result.outcome === 'review').length,
    hintUseCount: results.filter(result => result.usedHint).length,
    peekUseCount: results.filter(result => result.usedPeek).length,
    favoriteCount: results.filter(result => result.isFavorited).length,
  };
}

function areStringSetsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();

  return leftSorted.every((item, index) => item === rightSorted[index]);
}
