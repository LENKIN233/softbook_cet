import {
  POLICY,
  digest,
  prepare,
  makeRequest,
  validateAnswers,
  rank,
} from "./policy.mjs";
import { ProviderError } from "./provider.mjs";

export async function evaluateSnapshot(
  snapshot,
  { provider, mode = "shadow" } = {}
) {
  if (!["shadow", "rerank"].includes(mode))
    throw new Error("Invalid experiment mode");
  const context = prepare(snapshot);
  const baseline = context.baseline?.id ?? null;
  const report = {
    schemaVersion: "jev-learning-decision.v1",
    environment: "test",
    dataSource: "synthetic",
    policy: POLICY,
    mode,
    provider: provider?.kind ?? "none",
    snapshotDigest: context.snapshotDigest,
    phase: context.phase,
    baselineCardId: baseline,
    recommendedCardId: baseline,
    selectedCardId: baseline,
    candidateIds: context.candidates.map((c) => c.id),
    nextDueAt: context.nextDueAt,
    diagnoses: [],
    weaknesses: [],
    ranking: [],
    fsrsStates: context.fsrsStates,
    fsrsDigest: context.fsrsDigest,
    modelCall: {
      attempted: false,
      realModelCall: false,
      inputTokens: null,
      costUsd: 0,
    },
    modelQualityVerified: false,
    learningEffectVerified: false,
    status: "baseline",
    reason: null,
  };
  if (context.phase === "resume")
    return { ...report, reason: "persisted_cursor" };
  if (!baseline) return { ...report, reason: "no_eligible_card" };
  if (context.candidates.length < 2)
    return { ...report, reason: "single_candidate" };
  if (context.evidence.length < POLICY.minDistinctCards)
    return { ...report, reason: "insufficient_evidence" };
  if (!provider) return { ...report, reason: "no_provider" };
  const request = makeRequest(context);
  report.requestDigest = digest(request);
  report.modelCall.attempted = true;
  try {
    const result = await provider.evaluate(request);
    report.modelCall = { attempted: true, ...result.meta };
    const answers = validateAnswers(result.response, request);
    const resultRank = rank(context, answers);
    report.diagnoses = resultRank.diagnoses;
    report.weaknesses = resultRank.weaknesses;
    report.ranking = resultRank.ranked;
    if (resultRank.weaknesses.length === 0)
      return { ...report, reason: "insufficient_supported_weakness" };
    if (!resultRank.ranked.some((candidate) => candidate.score > 0))
      return { ...report, reason: "no_candidate_matches" };
    report.recommendedCardId = resultRank.recommended;
    report.selectedCardId =
      mode === "rerank" ? resultRank.recommended : baseline;
    report.status = "evaluated";
    report.reason =
      resultRank.recommended === baseline
        ? "baseline_already_matches"
        : "weakness_match";
    return report;
  } catch (error) {
    report.status = "fallback";
    report.reason =
      error instanceof ProviderError ? error.code : "invalid_model_response";
    return report;
  }
}
