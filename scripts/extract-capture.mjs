import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const input = path.resolve(
  process.argv[2] || path.join(root, "evidence/homepage-scenario.json"),
);
const label = process.argv[3] || "homepage";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Invalid label");
const evidence = JSON.parse(await fs.readFile(input, "utf8"));
const result = evidence.normalized_result;
if (!result?.steps || evidence.operation !== "capture_browser_scenario")
  throw new Error("Expected REA scenario Evidence");
const out = path.join(root, "captures", label);
await fs.mkdir(out, { recursive: true });
const events = result.events.items;
const requests = new Map(
  events.filter((e) => e.kind === "request").map((e) => [e.transaction_id, e]),
);
const responses = new Map(
  events.filter((e) => e.kind === "response").map((e) => [e.transaction_id, e]),
);
const resources = [];
for (const e of events) {
  if (e.kind !== "network-content" || e.phase !== "response") continue;
  const request = requests.get(e.transaction_id);
  if (e.body.state !== "captured") continue;
  const body = e.body.value || e.body;
  if (!body.content || body.encoding !== "base64") continue;
  const bytes = Buffer.from(body.content, "base64");
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha !== body.sha256)
    throw new Error(`Body digest mismatch: ${e.transaction_id}`);
  const url = request?.url.url || responses.get(e.transaction_id)?.url.url;
  const media = body.media_type?.split(";")[0];
  const ext =
    {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/avif": ".avif",
      "image/svg+xml": ".svg",
    }[media] ||
    {
      script: ".js",
      stylesheet: ".css",
      document: ".html",
      image: ".img",
      font: ".font",
    }[request?.resource_type] ||
    ".bin";
  const filename = `${e.transaction_id}${ext}`;
  if (!/^[A-Za-z0-9_-]+$/.test(e.transaction_id))
    throw new Error("Unsupported transaction filename");
  await fs.writeFile(path.join(out, filename), bytes);
  resources.push({
    transaction_id: e.transaction_id,
    url,
    type: request?.resource_type,
    status: responses.get(e.transaction_id)?.status,
    file: filename,
    bytes: bytes.length,
    sha256: sha,
    media_type: body.media_type,
  });
}
for (const step of result.steps) {
  if (!/^[A-Za-z0-9_-]+$/.test(step.step_id))
    throw new Error("Unsupported step filename");
  for (const kind of ["dom", "accessibility", "screenshot"]) {
    const artifact = step.artifacts[kind];
    if (artifact.state !== "captured") continue;
    await fs.writeFile(
      path.join(
        out,
        `${step.step_id}.${kind === "screenshot" ? "png" : kind === "dom" ? "html" : "txt"}`,
      ),
      kind === "screenshot"
        ? Buffer.from(artifact.value.data_base64, "base64")
        : artifact.value.text,
    );
  }
}
const network = [...requests.values()].map((r) => ({
  transaction_id: r.transaction_id,
  method: r.method,
  url: r.url.url,
  type: r.resource_type,
  status: responses.get(r.transaction_id)?.status ?? null,
}));
const summary = {
  evidence_id: evidence.evidence_id,
  operation: evidence.operation,
  completeness: result.completeness,
  limitations: evidence.limitations,
  requests: network.length,
  resources: resources.length,
  bytes: resources.reduce((s, r) => s + r.bytes, 0),
  hosts: [...new Set(network.map((r) => new URL(r.url).host))],
  scripts: resources.filter((r) => r.type === "script"),
  api_requests: network.filter((r) => ["fetch", "xhr"].includes(r.type)),
  steps: result.steps.map((s) => ({
    id: s.step_id,
    status: s.status,
    url: s.after_url.url,
  })),
};
await fs.writeFile(
  path.join(out, "resources.json"),
  JSON.stringify(resources, null, 2),
);
await fs.writeFile(
  path.join(out, "network.json"),
  JSON.stringify(network, null, 2),
);
await fs.writeFile(
  path.join(out, "summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    {
      ...summary,
      scripts: summary.scripts.map((s) => ({ url: s.url, bytes: s.bytes })),
      api_requests: summary.api_requests.slice(0, 30),
    },
    null,
    2,
  ),
);
