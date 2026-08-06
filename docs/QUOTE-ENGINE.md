# Quote Engine

Project TITAN calculates quotes using:

- Material cost
- Waste allowance
- Machine time
- Setup fee
- Minimum job charge
- Quantity
- Tax
- Packaging and optional labour
- Configurable markup

The default markup is **13%**.

## Pricing Rules

- Setup charges apply once per job.
- Minimum job charges prevent underpriced work.
- Manual overrides require permission.
- TITAN should not invent print time or filament usage.
- Bambu slicing results may provide real weight and time estimates.

## Typical Workflow

1. Upload or select a customer file.
2. Slice using the configured Bambu bridge.
3. Save grams and print time.
4. Choose material and machine rate.
5. Review base cost, markup, tax, and total.
6. Save a draft.
7. Approve before sending.
