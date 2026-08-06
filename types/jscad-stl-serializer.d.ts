declare module "@jscad/stl-serializer" {
  export const mimeType: string;
  export function serialize(
    options: { binary?: boolean },
    ...objects: unknown[]
  ): Array<ArrayBuffer | Uint8Array | string>;
}
