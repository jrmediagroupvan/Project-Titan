declare module "occt-import-js" {
  type ImportResult = {
    success: boolean;
    meshes: Array<{
      name?: string;
      color?: [number, number, number];
      attributes: {
        position: { array: number[] };
        normal?: { array: number[] };
      };
      index?: { array: number[] };
    }>;
  };
  type OcctApi = {
    ReadStepFile(content: Uint8Array, params: Record<string, unknown> | null): ImportResult;
  };
  const createOcct: () => Promise<OcctApi>;
  export default createOcct;
}
