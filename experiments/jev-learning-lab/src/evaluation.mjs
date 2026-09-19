import { scenarios, semanticHoldout } from "../fixtures/scenarios.mjs";
import { prepare, makeRequest, validateAnswers, POLICY } from "./policy.mjs";
import { evaluateSnapshot } from "./algorithm.mjs";
import { createFixtureProvider, createJevProvider } from "./provider.mjs";

export function fixtureFor(scenario) {
  const context = prepare(scenario.snapshot);
  return createFixtureProvider(
    context.evidence.map((e) => scenario.fixtureChoicesByEvent[e.id]),
    scenario.fixtureOptions
  );
}

export async function runEvaluation({
  providerKind = "fixture",
  mode = "rerank",
  provider,
} = {}) {
  if (!["fixture", "jev"].includes(providerKind))
    throw new Error("Unknown provider");
  const real = providerKind === "jev";
  const live = real ? provider ?? createJevProvider() : null;
  // Fault-injection/low-confidence scenarios belong to contract tests, not model quality.
  const selected = scenarios().filter(
    (s) =>
      !real ||
      [
        "contrast",
        "coarse",
        "one_error",
        "due_first",
        "due_tie",
        "sleeping",
        "access",
        "resume",
        "recovered",
      ].includes(s.id)
  );
  const cases = [];
  for (const scenario of selected) {
    const decision = await evaluateSnapshot(scenario.snapshot, {
      provider: live ?? fixtureFor(scenario),
      mode,
    });
    const checks = {
      baseline: decision.baselineCardId === scenario.expected.baseline,
      selectedWithinCandidates:
        decision.selectedCardId === null ||
        decision.candidateIds.includes(decision.selectedCardId),
      fsrsUnchanged:
        decision.fsrsDigest === prepare(scenario.snapshot).fsrsDigest,
    };
    if (!real) {
      checks.recommendation =
        decision.recommendedCardId === scenario.expected.recommended;
      checks.reason = decision.reason === scenario.expected.reason;
    }
    cases.push({
      id: scenario.id,
      title: scenario.title,
      expectedRecommendation: scenario.expected.recommended,
      recommendationMatched:
        decision.recommendedCardId === scenario.expected.recommended,
      checks,
      passed: Object.values(checks).every(Boolean),
      decision,
    });
  }
  const semantic = [];
  if (real) {
    for (const item of semanticHoldout()) {
      const request = makeRequest(prepare(item.snapshot));
      let observedMeta;
      try {
        const result = await live.evaluate(request);
        observedMeta = result.meta;
        const answer = validateAnswers(result.response, request).error_0;
        semantic.push({
          id: item.id,
          expected: item.expectedSkill,
          predicted: answer.choice,
          confidence: answer.confidence,
          correct: answer.choice === item.expectedSkill,
          meta: result.meta,
        });
      } catch (error) {
        semantic.push({
          id: item.id,
          status: "unavailable",
          reason: error.code ?? "invalid_model_response",
          meta: observedMeta,
        });
      }
    }
  }
  const successful =
    cases.filter((c) => c.decision.modelCall.realModelCall).length +
    semantic.filter((s) => s.meta?.realModelCall).length;
  const unavailable =
    cases.filter((c) => c.decision.status === "fallback").length +
    semantic.filter((s) => s.status === "unavailable").length;
  const scored = semantic.filter((s) => typeof s.correct === "boolean");
  const costs = [
    ...cases.map((c) => c.decision.modelCall.costUsd),
    ...semantic.map((s) => s.meta?.costUsd),
  ].filter(Number.isFinite);
  const observedCalls = [
    ...cases.map((c) => c.decision.modelCall),
    ...semantic.map((s) => s.meta),
  ].filter((m) => m?.realModelCall);
  const latencies = observedCalls.map((m) => m.latencyMs).sort((a, b) => a - b);
  return {
    schemaVersion: "jev-learning-eval.v1",
    generatedAt: new Date().toISOString(),
    policy: POLICY,
    provider: providerKind,
    mode,
    dataSource: "synthetic",
    contractChecksPassed: cases.every((c) => c.passed),
    liveStatus: !real
      ? "not_run"
      : unavailable > 0
      ? "incomplete"
      : successful > 0
      ? "completed"
      : "not_run",
    realModelCallsCompleted: successful,
    modelQuality: {
      status:
        real && scored.length === semantic.length && scored.length > 0
          ? "small_synthetic_sample_only"
          : "not_verified",
      examplesScored: scored.length,
      examplesCorrect: scored.filter((s) => s.correct).length,
      accuracy: scored.length
        ? scored.filter((s) => s.correct).length / scored.length
        : null,
    },
    learningEffectVerified: false,
    costUsd: costs.reduce((a, b) => a + b, 0),
    inputTokens: observedCalls.reduce((sum, m) => sum + m.inputTokens, 0),
    latencyMs: {
      median: latencies.length
        ? latencies[Math.floor(latencies.length / 2)]
        : null,
      maximum: latencies.at(-1) ?? null,
    },
    costNote:
      "Sum of observed successful response usage; failed requests may have unobserved charges.",
    cases,
    semantic,
  };
}

export function markdownReport(report) {
  const lines = [
    "# Jev 学习算法测试报告",
    "",
    `- 数据：合成测试数据；提供方：${
      report.provider === "fixture" ? "脚本模拟响应（不是 Jev）" : "Jev API"
    }`,
    `- 策略：${report.policy.version}；模式：${report.mode}`,
    `- 调度与回退检查：${report.contractChecksPassed ? "通过" : "失败"}`,
    `- 真实模型联调：${report.liveStatus}；成功调用：${report.realModelCallsCompleted}`,
    `- 真实学习效果：未验证`,
    "",
    "| 场景 | 原调度 | 建议 | 最终选卡 | 原因 | 检查 |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of report.cases)
    lines.push(
      `| ${c.title} | ${c.decision.baselineCardId ?? "—"} | ${
        c.decision.recommendedCardId ?? "—"
      } | ${c.decision.selectedCardId ?? "—"} | ${c.decision.reason} | ${
        c.passed ? "通过" : "失败"
      } |`
    );
  lines.push(
    "",
    report.provider === "fixture"
      ? "模拟响应只验证算法连接、约束与回退，不证明 Jev 的分类准确率，也不证明记忆或考试成绩提升。"
      : "调度约束通过与模型判断准确是两回事；真实学习效果仍需延迟回忆和迁移题数据验证。",
    "",
    `已观察成功响应费用：$${report.costUsd.toFixed(
      6
    )}。失败请求的费用可能未知。`
  );
  if (report.semantic.length)
    lines.push(
      "",
      `语义小样本：${report.modelQuality.examplesCorrect}/${report.modelQuality.examplesScored}；仅供诊断，不能作为上线效果结论。`,
      `输入 token：${report.inputTokens}；延迟中位数：${
        report.latencyMs.median ?? "未测得"
      } ms；最大延迟：${report.latencyMs.maximum ?? "未测得"} ms。`
    );
  return lines.join("\n") + "\n";
}
