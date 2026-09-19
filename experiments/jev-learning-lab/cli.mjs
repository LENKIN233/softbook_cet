import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  runEvaluation,
  markdownReport,
  fixtureFor,
} from "./src/evaluation.mjs";
import { scenarios } from "./fixtures/scenarios.mjs";
import { evaluateSnapshot } from "./src/algorithm.mjs";
import { createJevProvider } from "./src/provider.mjs";

const [command = "demo", ...args] = process.argv.slice(2);
const allowed = [
  "--provider=jev",
  "--provider=fixture",
  "--mode=shadow",
  "--mode=rerank",
  ...scenarios().map((s) => `--scenario=${s.id}`),
];
if (
  args.some((a) => !allowed.includes(a)) ||
  !["demo", "eval"].includes(command)
) {
  console.error(
    "Usage: node cli.mjs demo|eval [--provider=fixture|jev] [--mode=shadow|rerank] [--scenario=contrast]"
  );
  process.exitCode = 1;
} else {
  const providerKind = args.includes("--provider=jev") ? "jev" : "fixture";
  const mode = args.includes("--mode=rerank") ? "rerank" : "shadow";
  if (command === "eval") {
    const result = await runEvaluation({ providerKind, mode });
    const dir = fileURLToPath(new URL("./reports/", import.meta.url));
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}${providerKind}-latest.json`,
      JSON.stringify(result, null, 2) + "\n"
    );
    await writeFile(`${dir}${providerKind}-latest.md`, markdownReport(result));
    console.log(markdownReport(result));
    console.log(`JSON report: ${dir}${providerKind}-latest.json`);
    if (
      !result.contractChecksPassed ||
      (providerKind === "jev" && result.liveStatus !== "completed")
    )
      process.exitCode = 2;
  } else {
    const name =
      args.find((a) => a.startsWith("--scenario="))?.split("=")[1] ??
      "contrast";
    const scenario = scenarios().find((s) => s.id === name);
    const provider =
      providerKind === "jev" ? createJevProvider() : fixtureFor(scenario);
    const result = await evaluateSnapshot(scenario.snapshot, {
      provider,
      mode,
    });
    console.log(JSON.stringify(result, null, 2));
    if (providerKind === "jev" && result.status === "fallback")
      process.exitCode = 2;
  }
}
