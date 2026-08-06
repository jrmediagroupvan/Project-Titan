import { booleans, extrusions, hulls, measurements, primitives, text, transforms } from "@jscad/modeling";
import { serialize } from "@jscad/stl-serializer";
import { z } from "zod";
import type { AiConfiguration } from "@/lib/ai";
import { createAiReply } from "@/lib/ai";

const vector3 = z.tuple([
  z.number().finite().min(-1000).max(1000),
  z.number().finite().min(-1000).max(1000),
  z.number().finite().min(-1000).max(1000),
]);
const positive3 = z.tuple([
  z.number().finite().min(0.2).max(1000),
  z.number().finite().min(0.2).max(1000),
  z.number().finite().min(0.2).max(1000),
]);
const nodeSchema: z.ZodType<any> = z.lazy(() => z.union([
  z.object({ op: z.literal("cuboid"), size: positive3, rounded: z.number().finite().min(0).max(100).optional() }).strict(),
  z.object({ op: z.literal("cylinder"), radius: z.number().finite().min(0.1).max(500), height: z.number().finite().min(0.2).max(1000), rounded: z.number().finite().min(0).max(100).optional(), segments: z.number().int().min(12).max(128).optional() }).strict(),
  z.object({ op: z.literal("sphere"), radius: z.number().finite().min(0.1).max(500), segments: z.number().int().min(12).max(128).optional() }).strict(),
  z.object({ op: z.literal("torus"), innerRadius: z.number().finite().min(0.1).max(250), outerRadius: z.number().finite().min(0.2).max(500), segments: z.number().int().min(12).max(128).optional() }).strict(),
  z.object({ op: z.literal("extrudedPolygon"), points: z.array(z.tuple([z.number().finite().min(-1000).max(1000), z.number().finite().min(-1000).max(1000)])).min(3).max(80), height: z.number().finite().min(0.2).max(1000) }).strict(),
  z.object({ op: z.literal("text"), value: z.string().min(1).max(40), size: z.number().finite().min(2).max(200), height: z.number().finite().min(0.2).max(50), stroke: z.number().finite().min(0.2).max(20).optional() }).strict(),
  z.object({ op: z.enum(["union", "subtract", "intersect"]), children: z.array(nodeSchema).min(2).max(30) }).strict(),
  z.object({ op: z.literal("translate"), vector: vector3, child: nodeSchema }).strict(),
  z.object({ op: z.literal("rotate"), vector: vector3, child: nodeSchema }).strict(),
  z.object({ op: z.literal("scale"), vector: z.tuple([z.number().finite().min(0.05).max(20), z.number().finite().min(0.05).max(20), z.number().finite().min(0.05).max(20)]), child: nodeSchema }).strict(),
]));

export const aiStlPlanSchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(500),
  design: nodeSchema,
}).strict();

export type AiStlPlan = z.infer<typeof aiStlPlanSchema>;
export type StlBuild = {
  bytes: Buffer;
  dimensions: { x: number; y: number; z: number; triangles: number };
};

function complexity(node: any, depth = 1): { count: number; depth: number } {
  const children = node.children || (node.child ? [node.child] : []);
  return children.reduce(
    (result: { count: number; depth: number }, child: any) => {
      const nested = complexity(child, depth + 1);
      return { count: result.count + nested.count, depth: Math.max(result.depth, nested.depth) };
    },
    { count: 1, depth },
  );
}

function compileText(node: any) {
  const stroke = node.stroke || Math.max(0.8, node.size * 0.08);
  const paths = text.vectorText({ input: node.value, height: node.size, align: "center" });
  if (!paths.length) throw new Error("The requested text could not be converted to geometry.");

  // vectorText returns polylines, not just two-point segments. Build every
  // consecutive stroke so letters and numbers are not missing geometry.
  const strokes = paths.flatMap((path) => path.slice(0, -1).map((point, index) => {
    const next = path[index + 1];
    return hulls.hull(
      primitives.circle({ center: point, radius: stroke / 2, segments: 24 }),
      primitives.circle({ center: next, radius: stroke / 2, segments: 24 }),
    );
  }));
  if (!strokes.length) throw new Error("The requested text contains no printable strokes.");
  return extrusions.extrudeLinear({ height: node.height }, booleans.union(...strokes));
}

function compileNode(node: any): any {
  switch (node.op) {
    case "cuboid":
      if (node.rounded) {
        const radius = Math.min(node.rounded, Math.min(...node.size) / 2 - 0.01);
        return primitives.roundedCuboid({ size: node.size, roundRadius: Math.max(0.01, radius), segments: 24 });
      }
      return primitives.cuboid({ size: node.size });
    case "cylinder":
      if (node.rounded) {
        return primitives.roundedCylinder({
          radius: node.radius,
          height: node.height,
          roundRadius: Math.min(node.rounded, node.radius - 0.01, node.height / 2 - 0.01),
          segments: node.segments || 48,
        });
      }
      return primitives.cylinder({ radius: node.radius, height: node.height, segments: node.segments || 48 });
    case "sphere":
      return primitives.sphere({ radius: node.radius, segments: node.segments || 48 });
    case "torus":
      if (node.outerRadius <= node.innerRadius) throw new Error("A torus outer radius must exceed its inner radius.");
      return primitives.torus({ innerRadius: node.innerRadius, outerRadius: node.outerRadius, innerSegments: 24, outerSegments: node.segments || 64 });
    case "extrudedPolygon":
      return extrusions.extrudeLinear({ height: node.height }, primitives.polygon({ points: node.points }));
    case "text":
      return compileText(node);
    case "union":
      return booleans.union(...node.children.map(compileNode));
    case "subtract": {
      const [base, ...cuts] = node.children.map(compileNode);
      return booleans.subtract(base, ...cuts);
    }
    case "intersect":
      return booleans.intersect(...node.children.map(compileNode));
    case "translate":
      return transforms.translate(node.vector, compileNode(node.child));
    case "rotate":
      return transforms.rotate(node.vector.map((degrees: number) => degrees * Math.PI / 180), compileNode(node.child));
    case "scale":
      return transforms.scale(node.vector, compileNode(node.child));
    default:
      throw new Error("The AI returned an unsupported geometry operation.");
  }
}

function combineChunks(chunks: Array<ArrayBuffer | Uint8Array | string>) {
  return Buffer.concat(chunks.map((chunk) => {
    if (typeof chunk === "string") return Buffer.from(chunk);
    if (chunk instanceof Uint8Array) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    return Buffer.from(chunk);
  }));
}

export function buildStlFromPlan(input: unknown): StlBuild {
  const plan = aiStlPlanSchema.parse(input);
  const limits = complexity(plan.design);
  if (limits.count > 100 || limits.depth > 12) throw new Error("The generated design is too complex to compile safely.");
  let geometry = compileNode(plan.design);
  let bounds = measurements.measureBoundingBox(geometry) as [[number, number, number], [number, number, number]];
  if (bounds.flat().some((value) => !Number.isFinite(value))) {
    throw new Error("The generated geometry has invalid coordinates.");
  }

  // Put every exported model flat on the virtual print bed. AI transforms can
  // otherwise leave a valid model floating above or below Z=0.
  if (Math.abs(bounds[0][2]) > 0.0001) {
    geometry = transforms.translate([0, 0, -bounds[0][2]], geometry);
    bounds = measurements.measureBoundingBox(geometry) as [[number, number, number], [number, number, number]];
  }
  const dimensions = {
    x: bounds[1][0] - bounds[0][0],
    y: bounds[1][1] - bounds[0][1],
    z: bounds[1][2] - bounds[0][2],
    triangles: 0,
  };
  if (Object.values(dimensions).slice(0, 3).some((value) => !Number.isFinite(value) || value <= 0 || value > 500)) {
    throw new Error("The generated design has invalid or oversized dimensions.");
  }
  const bytes = combineChunks(serialize({ binary: true }, geometry));
  if (bytes.length < 84) throw new Error("The generated STL is empty.");
  dimensions.triangles = bytes.readUInt32LE(80);
  if (!dimensions.triangles || dimensions.triangles > 2_000_000) throw new Error("The generated STL triangle count is invalid.");
  return { bytes, dimensions };
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || value;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The AI did not return a valid design specification.");
  return JSON.parse(source.slice(start, end + 1));
}

const GEOMETRY_GUIDE = `
Return JSON only with: {"title":"...","summary":"...","design":NODE}.
NODE is one of:
{"op":"cuboid","size":[x,y,z],"rounded":optionalRadius}
{"op":"cylinder","radius":r,"height":h,"rounded":optionalRadius,"segments":48}
{"op":"sphere","radius":r,"segments":48}
{"op":"torus","innerRadius":tubeRadius,"outerRadius":centrelineRadius,"segments":64}
{"op":"extrudedPolygon","points":[[x,y],...],"height":h}
{"op":"text","value":"TEXT","size":heightMm,"height":extrusionMm,"stroke":optionalStrokeMm}
{"op":"union|subtract|intersect","children":[NODE,NODE,...]}
{"op":"translate|rotate|scale","vector":[x,y,z],"child":NODE}
Rotate vectors use degrees. All other units are millimetres. The design must be a single connected, printable solid whenever possible.
Use practical wall thicknesses (normally at least 1.2 mm), clearances (normally 0.25-0.4 mm for fitted FDM parts), fillets/rounded edges, a flat build surface, and exact requested dimensions.
Every part intended to be connected must overlap another solid by at least 0.2 mm; touching faces alone are not reliable.
For a hole, subtract a cylinder or other cutting solid that extends at least 0.5 mm beyond both sides of the base.
Avoid zero-thickness walls, coplanar boolean faces, self-intersecting polygons, tiny floating details, and unsupported text.
Do not claim to estimate filament grams or print time; those require TITAN's Bambu Studio bridge after export.
Do not output code, markdown, comments, imports, URLs, or unsupported operations.
`;

export async function generateAiStlPlan(options: {
  config: AiConfiguration;
  prompt: string;
  currentPlan?: unknown;
}) {
  const revisionContext = options.currentPlan
    ? `Revise this existing design specification while preserving anything the user did not ask to change:\n${JSON.stringify(options.currentPlan)}`
    : "Create a new design specification.";
  const response = await createAiReply(
    options.config,
    `You are TITAN's AI STL Developer for professional FDM design. ${GEOMETRY_GUIDE}`,
    [{ role: "user", content: `${revisionContext}\n\nUser request:\n${options.prompt}` }],
  );
  const parsePlan = (value: string) => {
    const plan = aiStlPlanSchema.parse(extractJson(value));
    // Validate the actual compiled solid, not only the JSON shape. This catches
    // impossible fillets, empty booleans, bad polygons, and oversized output
    // before a design is saved.
    buildStlFromPlan(plan);
    return plan;
  };
  try {
    return parsePlan(response);
  } catch (firstError) {
    const issue = firstError instanceof z.ZodError
      ? firstError.issues[0]?.message || "schema error"
      : firstError instanceof Error ? firstError.message : "invalid JSON";
    const repaired = await createAiReply(
      options.config,
      `Repair an invalid TITAN STL design response. ${GEOMETRY_GUIDE}`,
      [{
        role: "user",
        content: `The previous response failed validation because: ${issue}\nReturn a corrected JSON design for this request: ${options.prompt}\n\nInvalid response:\n${response.slice(0, 12_000)}`,
      }],
    );
    try {
      return parsePlan(repaired);
    } catch (error) {
      if (error instanceof z.ZodError) throw new Error(`The AI returned an invalid STL design: ${error.issues[0]?.message || "schema error"}`);
      if (error instanceof SyntaxError) throw new Error("The AI returned malformed design JSON. Try a more specific prompt.");
      throw error;
    }
  }
}

export function safeStlName(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${base || "titan-ai-design"}.stl`;
}
