import test from "node:test";
import assert from "node:assert/strict";
import { aiStlPlanSchema, buildStlFromPlan, safeStlName } from "../../lib/ai-stl";

test("AI STL compiler produces a binary STL with exact cuboid dimensions", () => {
  const result = buildStlFromPlan({
    title: "Test tray",
    summary: "A basic rectangular test solid.",
    design: { op: "cuboid", size: [115, 50, 8], rounded: 3 },
  });
  assert.ok(result.bytes.length > 84);
  assert.equal(result.bytes.readUInt32LE(80), result.dimensions.triangles);
  assert.ok(Math.abs(result.dimensions.x - 115) < 0.01);
  assert.ok(Math.abs(result.dimensions.y - 50) < 0.01);
  assert.ok(Math.abs(result.dimensions.z - 8) < 0.01);
});

test("AI STL compiler supports safe subtractive holes", () => {
  const result = buildStlFromPlan({
    title: "Mount",
    summary: "A plate with a through hole.",
    design: {
      op: "subtract",
      children: [
        { op: "cuboid", size: [40, 30, 4], rounded: 2 },
        { op: "cylinder", radius: 3, height: 8, segments: 48 },
      ],
    },
  });
  assert.ok(result.dimensions.triangles > 12);
  assert.ok(result.bytes.length > 684);
});

test("AI STL compiler creates raised vector text without external fonts", () => {
  const result = buildStlFromPlan({
    title: "Label",
    summary: "A connected plate with raised lettering.",
    design: {
      op: "union",
      children: [
        { op: "cuboid", size: [60, 24, 3], rounded: 2 },
        {
          op: "translate",
          vector: [0, -5, 1.5],
          child: { op: "text", value: "TITAN", size: 10, height: 1.2, stroke: 1.1 },
        },
      ],
    },
  });
  assert.ok(result.dimensions.triangles > 20);
  assert.ok(result.dimensions.z >= 3);
});

test("AI STL schema rejects arbitrary operations and oversized solids", () => {
  assert.equal(aiStlPlanSchema.safeParse({
    title: "Unsafe",
    summary: "Invalid operation.",
    design: { op: "import", path: "/etc/passwd" },
  }).success, false);
  assert.throws(() => buildStlFromPlan({
    title: "Oversized",
    summary: "Too large.",
    design: { op: "cuboid", size: [1000, 1000, 1000] },
  }), /oversized dimensions/i);
});

test("generated STL filenames are safe", () => {
  assert.equal(safeStlName("../../Project TITAN: Pin Tray"), "project-titan-pin-tray.stl");
});


test("AI STL compiler grounds translated models on Z zero", () => {
  const result = buildStlFromPlan({
    title: "Grounded block",
    summary: "A translated block that should be placed on the print bed.",
    design: {
      op: "translate",
      vector: [0, 0, 25],
      child: { op: "cuboid", size: [20, 20, 5] },
    },
  });
  assert.ok(Math.abs(result.dimensions.z - 5) < 0.01);
});
