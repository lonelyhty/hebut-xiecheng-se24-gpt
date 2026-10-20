import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const root = path.resolve(import.meta.dirname, "..");
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const evidenceDir = path.join(root, "evidence");
const index = [];
let verifiedArtifacts = 0,
  verifiedBodies = 0,
  verifiedScripts = 0;
for (const filename of (await fs.readdir(evidenceDir))
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const bytes = await fs.readFile(path.join(evidenceDir, filename)),
    e = JSON.parse(bytes);
  if (!e.evidence_id) {
    index.push({
      file: "evidence/" + filename,
      fileSha256: sha(bytes),
      bytes: bytes.length,
      kind: "diagnostic",
      error: e.code || e.error || null,
    });
    continue;
  }
  assert.match(e.evidence_id, /^ev_[a-f0-9]{64}$/);
  const result = e.normalized_result;
  const failedSteps =
    result?.steps
      ?.filter((s) => s.status !== "completed")
      .map((s) => s.step_id) || [];
  index.push({
    file: "evidence/" + filename,
    fileSha256: sha(bytes),
    bytes: bytes.length,
    evidenceId: e.evidence_id,
    operation: e.operation,
    authority: e.authority,
    confidence: e.confidence,
    coverage:
      result?.completeness ||
      result?.coverage ||
      result?.graph?.coverage ||
      null,
    failedSteps,
    limitations: e.limitations,
  });
  for (const step of result?.steps || []) {
    for (const kind of ["screenshot", "dom", "accessibility"]) {
      const a = step.artifacts[kind];
      if (a.state !== "captured") continue;
      const b =
        kind === "screenshot"
          ? Buffer.from(a.value.data_base64, "base64")
          : Buffer.from(a.value.text);
      assert.equal(
        sha(b),
        a.value.sha256,
        `${filename}:${step.step_id}:${kind} digest`,
      );
      assert.equal(b.length, a.value.bytes);
      verifiedArtifacts++;
    }
  }
  for (const event of result?.events?.items || []) {
    if (event.kind === "network-content" && event.body?.state === "captured") {
      const body = event.body;
      assert.equal(body.encoding, "base64");
      const b = Buffer.from(body.content, "base64");
      assert.equal(sha(b), body.sha256);
      assert.equal(b.length, body.bytes);
      verifiedBodies++;
    }
  }
}
const exported = JSON.parse(
  await fs.readFile(path.join(evidenceDir, "script-export.json"), "utf8"),
);
for (const script of exported.normalized_result.scripts) {
  if (script.content.state !== "exported") continue;
  const location = path.resolve(
    exported.normalized_result.analysis_input.input_path,
    script.content.relative_path,
  );
  assert.ok(
    location.startsWith(
      path.resolve(root, "captures/exported-scripts/files") + path.sep,
    ),
  );
  const b = await fs.readFile(location);
  assert.equal(sha(b), script.content.sha256);
  assert.equal(b.length, script.content.bytes);
  verifiedScripts++;
}
const scenarios = [];
for (const name of [
  "local-homepage",
  "local-booking-flow",
  "local-mobile",
  "local-planner",
  "local-orders",
  "local-agency",
]) {
  const e = JSON.parse(
      await fs.readFile(path.join(evidenceDir, name + ".json"), "utf8"),
    ),
    r = e.normalized_result;
  assert.ok(
    r.steps.every((s) => s.status === "completed"),
    `${name}: all declared steps must complete`,
  );
  const errors = r.events.items.filter((e) => e.kind === "page-error");
  assert.equal(errors.length, 0, `${name}: page errors`);
  const text = r.steps.at(-1).artifacts.accessibility.value.text;
  const expected = {
    "local-homepage": "上海",
    "local-booking-flow": "你的登机牌",
    "local-mobile": "搜索机票",
    "local-planner": "成都",
    "local-orders": "已值机",
    "local-agency": "已出票金额",
  }[name];
  assert.ok(
    text.includes(expected),
    `${name}: expected rendered milestone ${expected}`,
  );
  scenarios.push({
    name,
    evidenceId: e.evidence_id,
    completedSteps: r.steps.length,
    pageErrors: errors.length,
    milestone: expected,
    passed: true,
    completeness: r.completeness,
  });
}
const report = {
  generatedAt: new Date().toISOString(),
  digestMeaning:
    "fileSha256 hashes saved UTF-8 file bytes. REA evidenceId is preserved as returned; this script does not recompute REA semantic identifiers.",
  verifiedArtifacts,
  verifiedBodies,
  verifiedScripts,
  localScenarios: scenarios,
  evidence: index,
};
await fs.writeFile(
  path.join(root, "reports/evidence-index.json"),
  JSON.stringify(report, null, 2),
);
await fs.writeFile(
  path.join(root, "reports/browser-verification.json"),
  JSON.stringify(
    {
      generatedAt: report.generatedAt,
      scenarios,
      passed: scenarios.every((s) => s.passed),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      verifiedArtifacts,
      verifiedBodies,
      verifiedScripts,
      evidenceFiles: index.length,
      localScenarios: scenarios.map((s) => ({
        name: s.name,
        completedSteps: s.completedSteps,
        passed: s.passed,
      })),
      passed: true,
    },
    null,
    2,
  ),
);
