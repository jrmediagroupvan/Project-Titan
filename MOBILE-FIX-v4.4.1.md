# Project TITAN v4.4.1 Mobile Fix

## Root cause corrected

The previous source did not explicitly define a device-width viewport. Mobile
Safari and Android browsers could therefore render the layout using a desktop-
sized virtual viewport, preventing the hamburger breakpoint from activating.

## Corrections

- Explicit Next.js `Viewport` export with `width: device-width`
- iPhone `viewport-fit=cover`
- Hamburger breakpoint increased to 900px
- Reliable fixed off-canvas drawer
- Backdrop visibility and pointer-event controls
- Escape-key closing
- Focus moves to the drawer close button
- Menu closes immediately after selecting a page
- iPhone notch and bottom safe-area padding
- Touch-friendly 44–46px controls
- Scrollable menu with sticky group labels
- One-column phone layouts and two-column tablet layouts
- Horizontal scrolling for large tables and calendars

## Test

Use actual devices or browser device emulation at:

- iPhone SE
- iPhone 14/15 Pro
- iPhone Pro Max
- Google Pixel
- Samsung Galaxy
- iPad and Android tablet

After deploying, clear the browser cache or open a private tab.
