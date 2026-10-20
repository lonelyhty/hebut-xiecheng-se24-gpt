import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const e = JSON.parse(
  await fs.readFile(
    path.join(root, "evidence/javascript-application.json"),
    "utf8",
  ),
);
const nodes = e.normalized_result.graph.nodes;
const candidates = nodes.filter(
  (n) =>
    n.identity.key?.includes("hotelSearch") ||
    n.observations.some((o) => o.properties.path?.includes("hotelSearch")),
);
console.log(
  JSON.stringify(
    candidates.map((n) => ({
      id: n.node_id,
      kind: n.kind,
      identity: n.identity,
      observations: n.observations.map((o) => ({
        label: o.label,
        keys: Object.keys(o.properties || {}),
      })),
    })),
    null,
    2,
  ),
);
const node = candidates.find((n) => n.kind === "javascript-asset");
if (!node)
  throw new Error(
    "No hotel search node in retained graph; keep this question unknown.",
  );
await fs.writeFile(
  path.join(root, "inputs/hotel-trace.json"),
  JSON.stringify({
    application: e,
    seed: { kind: "node-id", value: node.node_id },
    direction: "outgoing",
  }),
);
await fs.writeFile(
  path.join(root, "inputs/hotel-module-view.json"),
  JSON.stringify({
    source: { kind: "inline", evidence: e },
    view: {
      kind: "item",
      collection: "modules",
      selector: { node_id: node.node_id },
    },
  }),
);
const endpoints = nodes
  .filter((n) => n.kind === "endpoint")
  .map((n) => ({
    id: n.node_id,
    value: n.identity.key,
    observations: n.observations.map((o) => ({
      mechanism: o.properties?.mechanism,
      source: o.evidence.location,
    })),
  }));
await fs.writeFile(
  path.join(root, "reports/static-endpoints.json"),
  JSON.stringify(
    {
      evidence_id: e.evidence_id,
      endpoints,
      limitations: [
        "Static endpoint candidates include non-network get() calls; these are not verified API paths.",
      ],
    },
    null,
    2,
  ),
);
await fs.writeFile(
  path.join(root, "reports/static-summary.json"),
  JSON.stringify(
    {
      evidence_id: e.evidence_id,
      statistics: e.normalized_result.statistics,
      coverage: e.normalized_result.graph.coverage,
      graphId: e.normalized_result.graph.graph_id,
      nodesByKind: Object.fromEntries(
        [...new Set(nodes.map((n) => n.kind))].map((k) => [
          k,
          nodes.filter((n) => n.kind === k).length,
        ]),
      ),
      limitations: e.limitations,
    },
    null,
    2,
  ),
);
