/**
 * Opt-in mobile acceptance smoke for an external audio or full-track candidate. The
 * runner supplies a short-lived fixture and deletes it after this process exits.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import React, { useRef, useState } from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { assertContentManifestMatchesCards } from '../src/audio/contentManifestRepository';
import {
  LearningResultDetailSurface,
  LearningSurface,
  type LearningSurfacePalette,
} from '../src/learning/LearningSurface';
import type {
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningSession,
} from '../src/learning/model';
import { parseSoftbookRemoteLearningCardSourcePayload } from '../src/learning/remoteCardSource';
import {
  canSubmitLearningCard,
  createLearningCardState,
  evaluateLearningCard,
} from '../src/learning/session';

const INTERACTION_ORDER = [
  'flip',
  'multiple_choice',
  'lock',
  'elimination',
  'swipe',
] as const;
const palette: LearningSurfacePalette = {
  accent: '#7C8BFF',
  accentSoft: 'rgba(124,139,255,0.16)',
  accentStrong: '#3847B8',
  background: '#F1F0F6',
  border: 'rgba(29,31,42,0.12)',
  danger: '#D94C5C',
  panel: '#FFFFFF',
  panelStrong: '#F3F4F8',
  primaryActionMuted: 'rgba(255,255,255,0.74)',
  primaryActionSurface: '#12131A',
  primaryActionText: '#FFFFFC',
  success: '#1E9B63',
  tabIdle: 'rgba(124,139,255,0.36)',
  text: '#1E1F2A',
  textMuted: '#686B7A',
  warning: '#B77900',
};

type CandidateAsset = {
  asset_id: string;
  duration_ms: number;
  media_type: 'audio/mpeg';
  sha256: string;
  size_bytes: number;
};

type AcceptanceFixture = {
  schema_version:
    | 'audio-bundle-candidate-mobile-acceptance-fixture.v1'
    | 'full-track-candidate-mobile-acceptance-fixture.v1';
  checked_at: string;
  candidate_payload_sha256: string;
  candidate: {
    assets: CandidateAsset[];
    card_records: unknown[];
    content_version: string;
    release: null;
    source: { id: string; label: string };
    track: 'cet4' | 'cet6';
  };
};

test('candidate cards parse, bind declared audio, and complete through Mobile Learning', () => {
  const fixture = readFixture();
  const fullTrack =
    fixture.schema_version ===
    'full-track-candidate-mobile-acceptance-fixture.v1';
  const parsed = parseSoftbookRemoteLearningCardSourcePayload(
    { data: fixture.candidate },
    fixture.candidate.track,
  );
  const assetById = new Map(
    fixture.candidate.assets.map(asset => [asset.asset_id, asset]),
  );
  const interactionCardCounts: Record<string, number> = {};
  const boundAssetIds = new Set<string>();
  let audioCardCount = 0;

  if (
    parsed.cards.length === 0 ||
    parsed.contentVersion !== fixture.candidate.content_version ||
    (!fullTrack && parsed.cards.length !== fixture.candidate.assets.length) ||
    assetById.size !== fixture.candidate.assets.length
  ) {
    throw new Error('Audio-bundle candidate scope is invalid.');
  }

  for (const card of parsed.cards) {
    interactionCardCounts[card.interaction_id] =
      (interactionCardCounts[card.interaction_id] ?? 0) + 1;
    if (card.audio) {
      const asset = assetById.get(card.audio.asset_id);
      if (
        !asset ||
        asset.duration_ms !== card.audio.duration_ms ||
        asset.sha256 !== card.audio.sha256
      ) {
        throw new Error(`Audio binding for ${card.card_id} is invalid.`);
      }
      boundAssetIds.add(asset.asset_id);
      audioCardCount += 1;
    } else if (!fullTrack) {
      throw new Error(
        `Audio-bundle card ${card.card_id} has no audio binding.`,
      );
    }
    const state = createAcceptanceCompletionState(card);
    const result = evaluateLearningCard(card, state);
    if (
      !canSubmitLearningCard(card, state) ||
      result?.outcome !==
        (card.interaction_id === 'flip' ? 'confident' : 'correct')
    ) {
      throw new Error(
        `Candidate card ${card.card_id} cannot complete in Learning.`,
      );
    }
  }

  if (
    audioCardCount !== fixture.candidate.assets.length ||
    boundAssetIds.size !== fixture.candidate.assets.length ||
    fixture.candidate.assets.some(asset => !boundAssetIds.has(asset.asset_id))
  ) {
    throw new Error('Candidate audio asset coverage is incomplete.');
  }

  const contentManifest = createSimulatedManifest(fixture, parsed.cards.length);
  assertContentManifestMatchesCards(contentManifest, parsed.cards);
  const representativeCards = INTERACTION_ORDER.flatMap(interactionId => {
    const card = parsed.cards.find(
      candidate => candidate.interaction_id === interactionId,
    );
    return card ? [card] : [];
  });

  let representativeAudioControlsVerified = 0;
  for (const card of representativeCards) {
    const session = createRepresentativeSession(
      fixture,
      parsed.cards,
      card,
      contentManifest,
    );
    let tree: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <CardAcceptanceHarness session={session} />,
      );
    });
    if (card.audio) {
      const audioControl = tree!.root.findByProps({
        testID: 'learning-audio-control',
      });
      if (
        audioControl.props.accessibilityRole !== 'button' ||
        audioControl.props.accessibilityLabel !== '播放听力'
      ) {
        throw new Error(`Audio control for ${card.card_id} is invalid.`);
      }
      representativeAudioControlsVerified += 1;
    }
    completeInteraction(tree!, card);
    tree!.root.findByProps({ testID: 'learning-result-summary' });
    ReactTestRenderer.act(() => {
      tree!.root
        .findByProps({ testID: 'learning-open-result-detail-button' })
        .props.onPress();
    });
    tree!.root.findByProps({ testID: 'learning-result-detail-screen' });
    const visibleOutput = JSON.stringify(tree!.toJSON());
    const visibleText = collectRenderedText(tree!.toJSON());
    for (const expectedAnalysis of [
      card.analysis.title,
      card.analysis.summary,
      card.analysis.exam_tip,
    ]) {
      if (!visibleText.includes(expectedAnalysis)) {
        throw new Error(`Learning analysis for ${card.card_id} is incomplete.`);
      }
    }
    assertNoVisibleRuntimeMetadata(visibleOutput, card, session);
    ReactTestRenderer.act(() => tree!.unmount());
  }

  writeSafeReport({
    audioCardCount,
    fixture,
    interactionCardCounts,
    representativeAudioControlsVerified,
    representativeCards,
  });
});

function readFixture(): AcceptanceFixture {
  const fixturePath = requireEnvironmentPath(
    'SOFTBOOK_AUDIO_BUNDLE_ACCEPTANCE_FIXTURE',
  );
  const fixture = JSON.parse(
    readFileSync(fixturePath, 'utf8'),
  ) as AcceptanceFixture;
  if (
    ![
      'audio-bundle-candidate-mobile-acceptance-fixture.v1',
      'full-track-candidate-mobile-acceptance-fixture.v1',
    ].includes(fixture.schema_version) ||
    !/^sha256:[a-f0-9]{64}$/.test(fixture.candidate_payload_sha256) ||
    fixture.candidate.release !== null
  ) {
    throw new Error('Audio-bundle candidate acceptance fixture is invalid.');
  }
  return fixture;
}

function createSimulatedManifest(
  fixture: AcceptanceFixture,
  cardCount: number,
): NonNullable<LearningSession['contentManifest']> {
  const expiresAt = '2030-01-01T00:00:00.000Z';
  return {
    access: {
      accessible_card_count: cardCount,
      mode: 'full',
      total_card_count: cardCount,
    },
    downloads: fixture.candidate.assets.map(asset => ({
      asset_id: asset.asset_id,
      expires_at: expiresAt,
      url: `https://acceptance.invalid/${asset.asset_id}.mp3`,
    })),
    manifest: {
      schema_version: 'content-manifest.v1',
      release_id: 'rel_candidate_acceptance_only',
      track: fixture.candidate.track,
      content_version: fixture.candidate.content_version,
      minimum_client_version: '1.0.0',
      parent_release_id: null,
      assets: fixture.candidate.assets.map(asset => ({ ...asset })),
    },
    signature: {
      algorithm: 'ed25519',
      key_id: 'candidate-acceptance-not-verified',
      value: 'candidate-acceptance-not-verified',
    },
  };
}

function createRepresentativeSession(
  fixture: AcceptanceFixture,
  catalogCards: LearningCard[],
  card: LearningCard,
  contentManifest: NonNullable<LearningSession['contentManifest']>,
): LearningSession {
  return {
    catalogCards,
    contentManifest,
    contentVersion: fixture.candidate.content_version,
    membershipStage: null,
    membershipTrialExpiresAt: null,
    membershipTrialRemainingSeconds: 0,
    membershipTrialStartedAt: null,
    nextDueAt: null,
    roundCompletion: null,
    schedulingMode: 'local',
    serverSelection: null,
    sourceId: fixture.candidate.source.id,
    sourceLabel: fixture.candidate.source.label,
    track: fixture.candidate.track,
    cards: [card],
  };
}

function CardAcceptanceHarness({ session }: { session: LearningSession }) {
  const card = session.cards[0];
  const [cardState, setCardState] = useState(() =>
    createLearningCardState(card),
  );
  const cardStateRef = useRef(cardState);
  const [result, setResult] = useState<LearningCardResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const updateState = (
    update: (current: LearningCardState) => LearningCardState,
  ) => {
    const next = update(cardStateRef.current);
    cardStateRef.current = next;
    setCardState(next);
    return next;
  };
  const complete = (next: LearningCardState) => {
    const evaluated = evaluateLearningCard(card, next);
    if (!evaluated) {
      throw new Error(`Learning UI could not complete ${card.card_id}.`);
    }
    setResult(evaluated);
  };

  if (showDetail && result) {
    return (
      <LearningResultDetailSurface
        card={card}
        cardState={cardState}
        currentIndex={0}
        isLastCard
        onAdvanceCard={() => undefined}
        onBackToPractice={() => setShowDetail(false)}
        palette={palette}
        phase="learning"
        result={result}
        sessionCardCount={1}
        sessionLabel="LEAK_SENTINEL_AUDIO_CANDIDATE"
      />
    );
  }

  return (
    <LearningSurface
      completedResults={result ? [result] : []}
      contentManifest={session.contentManifest}
      currentCard={card}
      currentCardState={cardState}
      currentIndex={0}
      currentResult={result}
      onAdvanceCard={() => undefined}
      onFlip={() => updateState(current => ({ ...current, isFlipped: true }))}
      onOpenResultDetail={() => setShowDetail(true)}
      onRestartDeck={() => undefined}
      onSelectOption={optionId =>
        updateState(current => ({ ...current, selectedOptionId: optionId }))
      }
      onSelectSwipeState={stateId => {
        const next = updateState(current => ({
          ...current,
          swipeSelection: stateId,
        }));
        complete(next);
      }}
      onSetFlipConfidence={confidence => {
        const next = updateState(current => ({
          ...current,
          flipConfidence: confidence,
        }));
        complete(next);
      }}
      onSetLockSelection={(slotId, value) =>
        updateState(current => ({
          ...current,
          lockSelections: { ...current.lockSelections, [slotId]: value },
        }))
      }
      onSubmitCurrentCard={() => complete(cardStateRef.current)}
      onToggleEliminationItem={itemId =>
        updateState(current => ({
          ...current,
          eliminatedItemIds: current.eliminatedItemIds.includes(itemId)
            ? current.eliminatedItemIds.filter(
                candidate => candidate !== itemId,
              )
            : [...current.eliminatedItemIds, itemId],
        }))
      }
      onToggleFavorite={() =>
        updateState(current => ({
          ...current,
          isFavorited: !current.isFavorited,
        }))
      }
      onToggleHint={() =>
        updateState(current => ({
          ...current,
          isHintVisible: !current.isHintVisible,
        }))
      }
      onTogglePeek={() =>
        updateState(current => ({ ...current, isPeeked: !current.isPeeked }))
      }
      palette={palette}
      phase="learning"
      reviewCandidateCount={0}
      sessionCards={[card]}
      sessionLabel="LEAK_SENTINEL_AUDIO_CANDIDATE"
    />
  );
}

function completeInteraction(
  tree: ReactTestRenderer.ReactTestRenderer,
  card: LearningCard,
) {
  switch (card.interaction_id) {
    case 'flip':
      press(tree, 'learning-flip-button');
      press(tree, 'learning-flip-confident-button');
      return;
    case 'multiple_choice':
      press(tree, `learning-option-${card.answer_key.correct_option}`);
      press(tree, 'learning-submit-button');
      return;
    case 'lock':
      card.lock_slots.forEach((slot, index) =>
        press(
          tree,
          `learning-lock-${slot.id}-${toTestIdSegment(
            card.answer_key.lock_pattern[index],
          )}`,
        ),
      );
      press(tree, 'learning-submit-button');
      return;
    case 'elimination':
      card.answer_key.correct_items.forEach(itemId =>
        press(tree, `learning-elimination-${itemId}`),
      );
      press(tree, 'learning-submit-button');
      return;
    case 'swipe':
      press(tree, `learning-swipe-${card.answer_key.correct_state}`);
  }
}

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  ReactTestRenderer.act(() =>
    tree.root.findByProps({ testID }).props.onPress(),
  );
}

function createAcceptanceCompletionState(
  card: LearningCard,
): LearningCardState {
  const state = createLearningCardState(card);
  switch (card.interaction_id) {
    case 'flip':
      return { ...state, flipConfidence: 'confident', isFlipped: true };
    case 'multiple_choice':
      return { ...state, selectedOptionId: card.answer_key.correct_option };
    case 'lock':
      return {
        ...state,
        lockSelections: Object.fromEntries(
          card.lock_slots.map((slot, index) => [
            slot.id,
            card.answer_key.lock_pattern[index],
          ]),
        ),
      };
    case 'elimination':
      return {
        ...state,
        eliminatedItemIds: [...card.answer_key.correct_items],
      };
    case 'swipe':
      return { ...state, swipeSelection: card.answer_key.correct_state };
  }
}

function assertNoVisibleRuntimeMetadata(
  output: string,
  card: LearningCard,
  session: LearningSession,
) {
  const cardDownloadUrl = session.contentManifest?.downloads.find(
    download => download.asset_id === card.audio?.asset_id,
  )?.url;
  const forbidden = new Map<string, string | null | undefined>([
    ['card_id', card.card_id],
    ['knowledge_ref', card.knowledge_ref],
    ['box_ref', card.space_metadata.box_ref],
    ['source_id', session.sourceId],
    ['source_label', session.sourceLabel],
    ['content_version', session.contentVersion],
    ['session_label', 'LEAK_SENTINEL_AUDIO_CANDIDATE'],
    ['release_id', session.contentManifest?.manifest.release_id],
    ['download_url', cardDownloadUrl],
  ]);
  for (const [field, value] of forbidden) {
    if (value && output.includes(value)) {
      throw new Error(`Visible runtime metadata leak detected for ${field}.`);
    }
  }
}

function collectRenderedText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectRenderedText).join('');
  if (value && typeof value === 'object' && 'children' in value) {
    return collectRenderedText(
      (value as { children?: unknown }).children ?? [],
    );
  }
  return '';
}

function toTestIdSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function requireEnvironmentPath(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function writeSafeReport(input: {
  audioCardCount: number;
  fixture: AcceptanceFixture;
  interactionCardCounts: Record<string, number>;
  representativeAudioControlsVerified: number;
  representativeCards: LearningCard[];
}) {
  const reportPath = requireEnvironmentPath(
    'SOFTBOOK_AUDIO_BUNDLE_ACCEPTANCE_REPORT',
  );
  const common = {
    checked_at: input.fixture.checked_at,
    candidate_payload_sha256: input.fixture.candidate_payload_sha256,
    content_version: input.fixture.candidate.content_version,
    track: input.fixture.candidate.track,
    card_count: input.fixture.candidate.card_records.length,
    audio_asset_count: input.fixture.candidate.assets.length,
    interaction_card_counts: input.interactionCardCounts,
    all_cards_parseable: true,
    all_cards_learning_completable: true,
    representative_card_ids: input.representativeCards.map(
      card => card.card_id,
    ),
    representative_ui_completions_verified: input.representativeCards.length,
    representative_audio_controls_verified:
      input.representativeAudioControlsVerified,
    simulated_manifest_binding_verified: true,
    visible_runtime_metadata_leak_guard_verified: true,
    signed_manifest_verified: false,
    model_audio_qc_verified: false,
    persistent_receiver_verified: false,
    automated_real_device_evidence_verified: false,
    gate_eligible: false,
  };
  const fullTrack =
    input.fixture.schema_version ===
    'full-track-candidate-mobile-acceptance-fixture.v1';
  const report = fullTrack
    ? {
        schema_version: 'full-track-candidate-mobile-learning-smoke.v1',
        ...common,
        audio_card_count: input.audioCardCount,
        non_audio_card_count:
          input.fixture.candidate.card_records.length - input.audioCardCount,
        all_audio_cards_bound: true,
      }
    : {
        schema_version: 'audio-bundle-candidate-mobile-learning-smoke.v1',
        ...common,
        all_cards_audio_bound: true,
      };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}
