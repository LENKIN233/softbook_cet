export const CORE_INTERACTION_ORDER = [
  'flip',
  'multiple_choice',
  'lock',
  'elimination',
  'swipe',
] as const;

export type LearningInteractionId = (typeof CORE_INTERACTION_ORDER)[number];

export type LearningTrack = 'cet4' | 'cet6';

export type LearningFront = {
  eyebrow: string;
  prompt: string;
  support: string;
  context: string;
};

export type LearningAnalysis = {
  title: string;
  summary: string;
  exam_tip: string;
};

export type LearningHintLayer = {
  label: string;
  content: string;
  reveal_gesture: '下滑';
};

export type SpaceMetadata = {
  box_ref: string;
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

export type LearningOption = {
  id: string;
  label: string;
  text: string;
};

export type LockSlot = {
  id: string;
  label: string;
  options: string[];
};

export type EliminationItem = {
  id: string;
  text: string;
};

export type SwipeState = {
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
  completedAt: string;
};

export type LearningServerSelection = {
  cardId: string;
  dueAt: string | null;
  phase: 'learning' | 'review';
  reason: 'persisted_cursor' | 'due_review' | 'catalog_new';
  selectionId: string;
};

export type LearningServerMembershipStage = 'trial' | 'free' | 'premium';

export type LearningSession = {
  catalogCards: LearningCard[];
  contentVersion: string | null;
  membershipStage: LearningServerMembershipStage | null;
  nextDueAt: string | null;
  schedulingMode: 'local' | 'server';
  serverSelection: LearningServerSelection | null;
  sourceId: string;
  sourceLabel: string;
  track: LearningTrack;
  cards: LearningCard[];
};

export const INTERACTION_LABELS: Record<LearningInteractionId, string> = {
  flip: '翻面',
  multiple_choice: '四选一',
  lock: '开锁',
  elimination: '消除',
  swipe: '滑动',
};
