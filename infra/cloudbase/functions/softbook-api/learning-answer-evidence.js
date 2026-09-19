const ANSWER_EVIDENCE_SCHEMA = 'learning-answer-evidence.v1';
const ANSWER_EVIDENCE_ACCEPT = `application/json; profile=${ANSWER_EVIDENCE_SCHEMA}`;

function normalizeAnswerEvidence(value, interactionId) {
  if (value === undefined) return undefined;
  if (
    interactionId !== 'multiple_choice' ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'schema_version,selected_option_id' ||
    value.schema_version !== ANSWER_EVIDENCE_SCHEMA ||
    typeof value.selected_option_id !== 'string' ||
    !value.selected_option_id.trim() ||
    value.selected_option_id.length > 128
  )
    throw new Error('Invalid versioned answer evidence.');
  return {
    schema_version: ANSWER_EVIDENCE_SCHEMA,
    selected_option_id: value.selected_option_id,
  };
}

function assertAnswerEvidenceMatchesCard(payload, card) {
  const evidence = normalizeAnswerEvidence(
    payload.answer_evidence,
    payload.interaction_id,
  );
  if (!evidence) return;
  if (
    !card.options?.some((option) => option.id === evidence.selected_option_id)
  ) {
    throw new Error('Answer evidence references an unknown option.');
  }
  const correct =
    evidence.selected_option_id === card.answer_key.correct_option;
  if (payload.outcome !== (correct ? 'correct' : 'incorrect')) {
    throw new Error('Answer evidence conflicts with the canonical answer.');
  }
}

module.exports = {
  ANSWER_EVIDENCE_SCHEMA,
  ANSWER_EVIDENCE_ACCEPT,
  normalizeAnswerEvidence,
  assertAnswerEvidenceMatchesCard,
};
