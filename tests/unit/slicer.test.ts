import test from "node:test";
import assert from "node:assert/strict";
import { parseBambuGcodeEstimate } from "../../lib/slicer";

test("parses current Bambu Studio G-code estimates", () => {
  const result = parseBambuGcodeEstimate(`
; BambuStudio 02.05.00.66
; model printing time: 40m 45s; total estimated time: 48m 41s
; total filament weight [g] : 11.46
`);
  assert.equal(result.materialGrams, 11.46);
  assert.equal(result.modelTimeSeconds, 2445);
  assert.equal(result.totalTimeSeconds, 2921);
  assert.equal(result.slicerVersion, "02.05.00.66");
});

test("rejects incomplete slicer output", () => {
  assert.throws(() => parseBambuGcodeEstimate("; no estimates"), /did not contain usable/);
});
