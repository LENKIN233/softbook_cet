/**
 * Opt-in acceptance smoke for one exact model-authorized controlled-pilot
 * payload. The runner supplies a short-lived backend-generated fixture in /tmp.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import React, { useRef, useState } from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { createPinnedContentManifestSignatureVerifier } from '../src/audio/contentManifestSignature';
import { createAccountBootstrapRepository } from '../src/bootstrap/accountBootstrapRepository';
import {
  LearningResultDetailSurface,
  LearningSurface,
  type LearningSurfacePalette,
} from '../src/learning/LearningSurface';
import { createLearningSessionRepository } from '../src/learning/learningRepository';
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

const EXPECTED_PAYLOAD_SHA256 =
  'sha256:5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3';
const EXPECTED_CONTENT_VERSION =
  'sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36';
const REPRESENTATIVE_CARD_IDS = [
  '001004',
  '000001',
  '020203',
  '011303',
  '011304',
] as const;
const EXPECTED_INTERACTION_COUNTS = {
  elimination: 10,
  flip: 22,
  lock: 17,
  multiple_choice: 59,
  swipe: 12,
};
const EXPECTED_AUTO_SCORED_CARD_COUNT = 98;
const EXPECTED_FLIP_CARD_COUNT = 22;

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

type AcceptanceFixture = {
  schema_version: 'controlled-pilot-mobile-acceptance-fixture.v1';
  checked_at: string;
  candidate_payload_sha256: string;
  content_version: string;
  public_key: {
    algorithm: 'ed25519';
    key_id: string;
    value: string;
  };
  card_source: any;
  learning_session: any;
  content_manifest: any;
  bootstrap: any;
};

let fixture: AcceptanceFixture;
let catalogCards: LearningCard[];
let representativeSessions: LearningSession[] = [];

beforeAll(() => {
  const fixturePath = requireEnvironmentPath(
    'SOFTBOOK_CONTROLLED_PILOT_ACCEPTANCE_FIXTURE',
  );
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as AcceptanceFixture;
  if (
    fixture.schema_version !==
      'controlled-pilot-mobile-acceptance-fixture.v1' ||
    fixture.candidate_payload_sha256 !== EXPECTED_PAYLOAD_SHA256 ||
    fixture.content_version !== EXPECTED_CONTENT_VERSION ||
    fixture.public_key.algorithm !== 'ed25519' ||
    !/^[a-f0-9]{64}$/.test(fixture.public_key.value)
  ) {
    throw new Error('Controlled-pilot acceptance fixture binding is invalid.');
  }
});

test('all 120 authorized cards complete through their owned scoring semantics', () => {
  const parsed = parseSoftbookRemoteLearningCardSourcePayload(
    fixture.card_source,
    'cet4',
  );
  catalogCards = parsed.cards;
  const interactionCounts = catalogCards.reduce<Record<string, number>>(
    (counts, card) => {
      counts[card.interaction_id] = (counts[card.interaction_id] ?? 0) + 1;
      return counts;
    },
    {},
  );

  if (
    parsed.contentVersion !== EXPECTED_CONTENT_VERSION ||
    catalogCards.length !== 120 ||
    Object.entries(EXPECTED_INTERACTION_COUNTS).some(
      ([interactionId, expectedCount]) =>
        interactionCounts[interactionId] !== expectedCount,
    ) ||
    Object.keys(interactionCounts).length !==
      Object.keys(EXPECTED_INTERACTION_COUNTS).length
  ) {
    throw new Error('Approved controlled-pilot catalog scope is invalid.');
  }

  let autoScoredCardCount = 0;
  let flipCardCount = 0;
  for (const card of catalogCards) {
    const state = createAcceptanceCompletionState(card);
    const result = evaluateLearningCard(card, state);
    const isFlip = card.interaction_id === 'flip';
    const expectedOutcome = isFlip ? 'confident' : 'correct';
    if (isFlip) {
      flipCardCount += 1;
    } else {
      autoScoredCardCount += 1;
    }
    if (
      !canSubmitLearningCard(card, state) ||
      result?.outcome !== expectedOutcome
    ) {
      throw new Error(
        `Approved card ${card.card_id} cannot complete through its owned scoring semantics.`,
      );
    }
  }
  if (
    autoScoredCardCount !== EXPECTED_AUTO_SCORED_CARD_COUNT ||
    flipCardCount !== EXPECTED_FLIP_CARD_COUNT
  ) {
    throw new Error('Approved controlled-pilot scoring scope is invalid.');
  }
});

test('five representative cards cross the real repository and signed pilot manifest', async () => {
  const verifier = createPinnedContentManifestSignatureVerifier({
    [fixture.public_key.key_id]: fixture.public_key.value,
  });

  representativeSessions = [];
  for (const [index, cardId] of REPRESENTATIVE_CARD_IDS.entries()) {
    const sessionPayload = structuredClone(fixture.learning_session);
    sessionPayload.data.selection = {
      ...sessionPayload.data.selection,
      card_id: cardId,
      selection_id: `sel_mobile_acceptance_${String(index + 1).padStart(
        2,
        '0',
      )}`,
    };
    const responses = [
      fixture.card_source,
      sessionPayload,
      fixture.content_manifest,
    ];
    const fetchImpl = jest.fn(async () => ({
      json: async () => responses.shift(),
      ok: true,
      status: 200,
    }));
    const repository = createLearningSessionRepository({
      contentManifestConfig: {
        baseUrl: 'https://acceptance.invalid',
        installedClientIdentityProvider: () => ({
          platform: 'ios',
          version: '1.0.0',
        }),
        mode: 'remote',
        now: () => new Date(fixture.checked_at),
        verifySignature: verifier,
      },
      fetchImpl,
      mode: 'remote',
      remoteConfig: {
        endpoint: 'https://acceptance.invalid/v2/learning/card-source',
        parsePayload: parseSoftbookRemoteLearningCardSourcePayload,
      },
      remoteSessionConfig: {
        endpoint: 'https://acceptance.invalid/v2/learning/session',
      },
    });
    const session = await repository.loadSession(
      { authToken: 'acceptance-only-token', phoneNumber: 'not-persisted' },
      'cet4',
    );

    if (
      session.cards.length !== 1 ||
      session.cards[0].card_id !== cardId ||
      session.catalogCards.length !== 120 ||
      session.contentManifest?.manifest.assets.length !== 24 ||
      session.contentManifest.access.mode !== 'full'
    ) {
      throw new Error(
        `Representative repository session ${cardId} is invalid.`,
      );
    }
    representativeSessions.push(session);
  }

  const manifest = fixture.content_manifest.data.manifest;
  const expectedManifestKeys = [
    'assets',
    'content_version',
    'expires_at',
    'gate_eligible',
    'minimum_client_versions',
    'pilot_id',
    'release_class',
    'release_id',
    'schema_version',
    'track',
  ];
  if (
    JSON.stringify(Object.keys(manifest).sort()) !==
      JSON.stringify(expectedManifestKeys) ||
    manifest.gate_eligible !== false ||
    Object.keys(manifest.minimum_client_versions).sort().join(',') !==
      'android,ios' ||
    fixture.content_manifest.data.downloads.some(
      (download: { expires_at: string }) =>
        Date.parse(download.expires_at) > Date.parse(manifest.expires_at),
    )
  ) {
    throw new Error('Controlled-pilot manifest boundary is invalid.');
  }
});

test('real controlled-pilot Bootstrap crosses the mobile repository exact union', async () => {
  const repository = createAccountBootstrapRepository({
    fetchImpl: async () => ({
      json: async () => fixture.bootstrap,
      ok: true,
      status: 200,
    }),
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://acceptance.invalid/v2/bootstrap',
      installedClientIdentityProvider: () => ({
        platform: 'ios',
        version: '1.0.0',
      }),
    },
  });
  const bootstrap = await repository.load(
    'cet4',
    fixture.bootstrap.data.day_key,
  );
  if (
    !bootstrap ||
    bootstrap.content.releaseClass !== 'controlled_pilot' ||
    bootstrap.content.gateEligible !== false ||
    bootstrap.content.version !== EXPECTED_CONTENT_VERSION ||
    bootstrap.content.minimumClientVersions.android !== '1.0.0' ||
    bootstrap.content.minimumClientVersions.ios !== '1.0.0'
  ) {
    throw new Error('Controlled-pilot Bootstrap mobile projection is invalid.');
  }

  const expectedBootstrapContentKeys = [
    'card_count',
    'expires_at',
    'gate_eligible',
    'minimum_client_versions',
    'pilot_id',
    'release_class',
    'release_id',
    'source',
    'version',
  ];
  if (
    JSON.stringify(Object.keys(fixture.bootstrap.data.content).sort()) !==
    JSON.stringify(expectedBootstrapContentKeys)
  ) {
    throw new Error('Controlled-pilot Bootstrap wire fields are invalid.');
  }
});

test('five representative interactions complete in Learning without runtime metadata leakage', () => {
  if (representativeSessions.length !== REPRESENTATIVE_CARD_IDS.length) {
    throw new Error('Representative repository sessions were not prepared.');
  }

  let audioControlCount = 0;
  for (const session of representativeSessions) {
    const card = session.cards[0];
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
      audioControlCount += 1;
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

  if (audioControlCount !== 2) {
    throw new Error('Representative audio control count is invalid.');
  }

  writeSafeAcceptanceReport();
});

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
    if (!evaluated)
      throw new Error(`Learning UI could not complete ${card.card_id}.`);
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
        sessionLabel="LEAK_SENTINEL_INTERNAL_SOURCE_7A"
      />
    );
  }

  return (
    <LearningSurface
      audioAttemptId="local-controlled-pilot-acceptance-attempt"
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
      sessionLabel="LEAK_SENTINEL_INTERNAL_SOURCE_7A"
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
      press(
        tree,
        `learning-option-${
          card.options.findIndex(option => option.id === card.answer_key.correct_option) + 1
        }`,
      );
      press(tree, 'learning-submit-button');
      return;
    case 'lock':
      card.lock_slots.forEach((slot, index) =>
        press(
          tree,
          `learning-lock-${index + 1}-${
            slot.options.indexOf(card.answer_key.lock_pattern[index]) + 1
          }`,
        ),
      );
      press(tree, 'learning-submit-button');
      return;
    case 'elimination':
      card.answer_key.correct_items.forEach(itemId =>
        press(
          tree,
          `learning-elimination-${
            card.elimination_items.findIndex(item => item.id === itemId) + 1
          }`,
        ),
      );
      press(tree, 'learning-submit-button');
      return;
    case 'swipe':
      press(
        tree,
        `learning-swipe-${
          card.swipe_states.findIndex(
            state => state.id === card.answer_key.correct_state,
          ) + 1
        }`,
      );
      return;
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
  const manifest = session.contentManifest;
  const forbidden = new Map<string, string | null | undefined>([
    ['card_id', card.card_id],
    ['knowledge_ref', card.knowledge_ref],
    ['box_ref', card.space_metadata.box_ref],
    ['source_id', session.sourceId],
    ['source_label', session.sourceLabel],
    ['content_version', session.contentVersion],
    ['session_label_sentinel', 'LEAK_SENTINEL_INTERNAL_SOURCE_7A'],
    [
      'pilot_id',
      manifest && 'pilot_id' in manifest.manifest
        ? manifest.manifest.pilot_id
        : null,
    ],
    ['release_id', manifest?.manifest.release_id],
    ['signature_key_id', manifest?.signature.key_id],
    ['download_url', manifest?.downloads[0]?.url],
  ]);
  for (const [field, value] of forbidden) {
    if (value && output.includes(value)) {
      throw new Error(`Visible runtime metadata leak detected for ${field}.`);
    }
  }
}

function writeSafeAcceptanceReport() {
  const reportPath = requireEnvironmentPath(
    'SOFTBOOK_CONTROLLED_PILOT_ACCEPTANCE_REPORT',
  );
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schema_version: 'controlled-pilot-mobile-acceptance-smoke.v1',
        checked_at: fixture.checked_at,
        candidate_payload_sha256: EXPECTED_PAYLOAD_SHA256,
        content_version: EXPECTED_CONTENT_VERSION,
        card_count: 120,
        audio_asset_count: 24,
        interaction_card_counts: EXPECTED_INTERACTION_COUNTS,
        all_cards_parseable: true,
        auto_scored_card_count: EXPECTED_AUTO_SCORED_CARD_COUNT,
        auto_scored_cards_canonical_answer_evaluable: true,
        flip_card_count: EXPECTED_FLIP_CARD_COUNT,
        flip_cards_self_assessment_completable: true,
        representative_card_ids: REPRESENTATIVE_CARD_IDS,
        representative_repository_sessions_verified: 5,
        representative_ui_completions_verified: 5,
        representative_audio_controls_verified: 2,
        pilot_manifest_exact_shape_verified: true,
        ephemeral_manifest_signature_verified_by_mobile: true,
        pilot_bootstrap_content_exact_shape_verified: true,
        visible_runtime_metadata_leak_guard_verified: true,
        model_audio_qc_verified: false,
        persistent_receiver_verified: false,
        automated_real_device_evidence_verified: false,
        installed_client_minimum_version_enforced: false,
        release_public_key_injection_verified: false,
        gate_eligible: false,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
}

function requireEnvironmentPath(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function collectRenderedText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectRenderedText).join('');
  if (!node || typeof node !== 'object') return '';
  return collectRenderedText((node as { children?: unknown }).children);
}
