import { POLICY, digest } from "./policy.mjs";

export const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const PRICE_PER_MILLION = 0.042;
export const costUsd = (inputTokens) =>
  Number(((inputTokens / 1e6) * PRICE_PER_MILLION).toFixed(12));

export class ProviderError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function readBounded(response, signal) {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError("invalid_response");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 131072) {
        await reader.cancel();
        throw new ProviderError("response_too_large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export function createJevProvider({
  apiKey = process.env.TYPESAFE_API_KEY,
  fetchImpl = fetch,
  timeoutMs = 4000,
  maxCalls = 20,
  maxInputBytes = 60000,
} = {}) {
  let calls = 0;
  return {
    kind: "jev",
    async evaluate(request) {
      if (!apiKey?.trim()) throw new ProviderError("missing_api_key");
      const body = JSON.stringify(request);
      if (Buffer.byteLength(body) > maxInputBytes)
        throw new ProviderError("request_too_large");
      if (calls >= maxCalls) throw new ProviderError("call_budget_exhausted");
      calls++;
      const signal = AbortSignal.timeout(timeoutMs);
      const start = performance.now();
      try {
        const response = await fetchImpl(ENDPOINT, {
          method: "POST",
          redirect: "error",
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new ProviderError(
            [401, 403].includes(response.status)
              ? "authentication_failed"
              : response.status === 429
              ? "rate_limited"
              : `http_${response.status}`
          );
        }
        const result = await readBounded(response, signal);
        const usage = result.usage;
        if (
          !Number.isSafeInteger(usage?.input_tokens) ||
          usage.input_tokens < 0 ||
          !Number.isSafeInteger(usage?.output_tokens) ||
          usage.output_tokens < 0
        )
          throw new ProviderError("invalid_usage");
        return {
          response: result,
          meta: {
            provider: "jev",
            realModelCall: true,
            latencyMs: Math.round(performance.now() - start),
            requestDigest: digest(request),
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            costUsd: costUsd(usage.input_tokens),
          },
        };
      } catch (error) {
        // Never forward provider bodies, bearer keys, URLs, or arbitrary exception text.
        if (error instanceof ProviderError) throw error;
        throw new ProviderError(
          signal.aborted ? "timeout" : "network_or_response_error"
        );
      }
    },
  };
}

// A scripted test double, not a local Jev model and not a prediction algorithm.
export function createFixtureProvider(
  choices,
  { confidence = 0.95, probability = 0.96, failure = null } = {}
) {
  return {
    kind: "fixture",
    async evaluate(request) {
      if (failure) throw new ProviderError(failure);
      const answers = {};
      for (const [index, [name, question]] of Object.entries(
        request.questions
      ).entries()) {
        const labels = Object.keys(question.criteria);
        const choice = choices[index] ?? "insufficient_evidence";
        answers[name] = {
          type: "choice",
          choice,
          confidence,
          probabilities: Object.fromEntries(
            labels.map((label) => [
              label,
              label === choice
                ? probability
                : (1 - probability) / (labels.length - 1),
            ])
          ),
        };
      }
      return {
        response: { model: POLICY.model, answers },
        meta: {
          provider: "fixture",
          realModelCall: false,
          latencyMs: 0,
          requestDigest: digest(request),
          inputTokens: null,
          outputTokens: null,
          costUsd: 0,
        },
      };
    },
  };
}
