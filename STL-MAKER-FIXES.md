# AI STL Maker Reliability Fixes

This build improves the AI STL Developer in four important areas:

- Vector text now builds every stroke in each letter and number instead of only the first segment.
- AI plans are compiled and geometry-validated before they are saved. Invalid designs receive one automatic AI repair attempt.
- Exported models are automatically placed on the print bed at Z=0.
- The AI design guide now enforces overlap, through-cut, minimum-wall, clearance, and anti-coplanar rules for more reliable FDM solids.

A regression test was added for automatic Z=0 grounding.

## Validation note

Automated tests could not be executed in the build environment because the configured npm registry returned HTTP 404 for the locked `zod-3.25.76.tgz` package. Run these commands on the deployment machine after dependency installation:

```bash
npm ci
npm test
npm run typecheck
npm run build
```
