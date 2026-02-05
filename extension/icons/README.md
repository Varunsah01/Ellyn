# Extension Icons

This folder should contain the following icon files:

- `icon16.png` - 16x16 pixels (for extension toolbar)
- `icon32.png` - 32x32 pixels (for extension management page)
- `icon48.png` - 48x48 pixels (for extension details)
- `icon128.png` - 128x128 pixels (for Chrome Web Store)

## Quick Icon Generation

### Option 1: Use Online Icon Generator
1. Go to https://www.favicon-generator.org/ or similar
2. Upload a simple email/envelope icon image
3. Generate icons in required sizes
4. Save them in this folder

### Option 2: Create with Code (icon-generator.html)
1. Open the `icon-generator.html` file in this folder
2. Right-click each canvas and "Save image as..."
3. Save as the appropriate filename (icon16.png, icon32.png, etc.)

### Option 3: Use Design Tools
1. Open Figma, Canva, or Photoshop
2. Create a 128x128 canvas with blue gradient background
3. Add a white envelope/mail icon in the center
4. Export as PNG at different sizes

## Icon Design Guidelines

- **Theme**: Match the web app's blue-to-purple gradient (#3B82F6 to #8B5CF6)
- **Symbol**: Simple mail/envelope icon (white)
- **Style**: Modern, flat design with slight shadow
- **Corners**: Rounded corners (8-12px radius)
- **Contrast**: Ensure icon is visible on both light and dark backgrounds

## Current Status

**Placeholder icons needed!** The extension will work without proper icons, but Chrome will show a default puzzle piece icon. Create proper icons using one of the methods above for a professional appearance.

## Example SVG Code

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="20" fill="url(#bg)"/>
  <rect x="24" y="36" width="80" height="56" rx="4" fill="none" stroke="white" stroke-width="4"/>
  <path d="M24 40 L64 68 L104 40" fill="none" stroke="white" stroke-width="4"/>
</svg>
```

Convert this SVG to PNG at required sizes.
