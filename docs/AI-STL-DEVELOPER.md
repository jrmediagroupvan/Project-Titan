# AI STL Developer

The AI STL Developer converts a natural-language part description into a restricted geometry plan, validates it, and generates a binary STL.

## Recommended Prompt Details

- Overall dimensions in millimetres
- Wall and base thickness
- Hole sizes and locations
- Tolerances
- Raised or engraved text
- Edge radii
- Printer, material, and orientation
- Intended use

## Safety Model

The geometry engine accepts validated primitives and Boolean operations. It must not execute generated shell commands, JavaScript, arbitrary OpenSCAD, imports, URLs, or filesystem operations.

## Workflow

1. Describe the part.
2. Review the generated plan.
3. Preview dimensions and geometry.
4. Submit revision instructions.
5. Export to Customer Files.
6. Slice and test print.
