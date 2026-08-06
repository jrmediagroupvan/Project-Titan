export type StlAnalysis = {
  format: "binary" | "ascii" | "unknown";
  triangles?: number;
  bounds?: { min: [number, number, number]; max: [number, number, number] };
  dimensionsMm?: [number, number, number];
  warning?: string;
};

export function analyseStl(buffer: Buffer): StlAnalysis {
  if (buffer.length < 84) {
    return { format: "unknown", warning: "File is too small to be a valid STL." };
  }

  const declaredTriangles = buffer.readUInt32LE(80);
  const expectedSize = 84 + declaredTriangles * 50;

  if (expectedSize === buffer.length) {
    let min: [number, number, number] = [Infinity, Infinity, Infinity];
    let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < declaredTriangles; i++) {
      const base = 84 + i * 50 + 12;
      for (let vertex = 0; vertex < 3; vertex++) {
        const offset = base + vertex * 12;
        const values: [number, number, number] = [
          buffer.readFloatLE(offset),
          buffer.readFloatLE(offset + 4),
          buffer.readFloatLE(offset + 8)
        ];
        values.forEach((v, axis) => {
          if (Number.isFinite(v)) {
            min[axis] = Math.min(min[axis], v);
            max[axis] = Math.max(max[axis], v);
          }
        });
      }
    }

    return {
      format: "binary",
      triangles: declaredTriangles,
      bounds: { min, max },
      dimensionsMm: [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
    };
  }

  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8").trimStart();
  if (head.startsWith("solid")) {
    const text = buffer.toString("utf8");
    const vertices = [...text.matchAll(/vertex\s+(-?[\d.e+]+)\s+(-?[\d.e+]+)\s+(-?[\d.e+]+)/gi)];
    if (!vertices.length) return { format: "ascii", warning: "No vertices were detected." };

    let min: [number, number, number] = [Infinity, Infinity, Infinity];
    let max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const match of vertices) {
      [Number(match[1]), Number(match[2]), Number(match[3])].forEach((v, axis) => {
        min[axis] = Math.min(min[axis], v);
        max[axis] = Math.max(max[axis], v);
      });
    }
    return {
      format: "ascii",
      triangles: Math.floor(vertices.length / 3),
      bounds: { min, max },
      dimensionsMm: [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
    };
  }

  return { format: "unknown", warning: "The STL format could not be identified." };
}
