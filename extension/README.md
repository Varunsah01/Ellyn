# Ellyn Browser Extension

A Chrome/Edge browser extension that extracts LinkedIn profile data and generates email address patterns locally.

## Features

✅ **LinkedIn Profile Extraction**
- Extracts visible profile data (name, role, company) from LinkedIn
- Only runs on LinkedIn profile pages
- Manual extraction (no automatic background scraping)

✅ **Advanced Email Inference Engine**
- Generates 9+ email pattern variations with intelligent confidence scoring
- Knows 100+ top company domains (Google, Microsoft, Amazon, etc.)
- Role-based heuristics (boosts patterns for recruiters, founders, engineers)
- Company size estimation (large companies prefer first.last format)
- Learning system that caches successful patterns for future accuracy
- No API calls - 100% client-side and privacy-focused

✅ **Email Draft Templates**
- 3 pre-built templates (Cold Outreach, Follow Up, Introduction)
- Variable replacement ({{firstName}}, {{company}}, etc.)
- Preview before sending

✅ **Quick Actions**
- Save contact to web app
- Open in Gmail/Outlook with pre-filled draft
- View recent contacts

✅ **Smart Caching & Learning**
- Stores up to 10 recent contacts locally
- Caches company→domain mappings for instant lookup
- Learns successful email patterns over time
- Boosts confidence scores for cached patterns (+20%)
- No external database required
- Privacy-focused

## Installation

### Development Mode (For Testing)

1. **Generate Extension Icons**
   ```bash
   cd extension/icons
   # Open icon-generator.html in your browser
   # Right-click and save each icon as PNG
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension` folder
   - The Ellyn icon should appear in your toolbar

3. **Open Sidebar**
   - Click the Ellyn extension icon in the toolbar
   - The sidebar will open on the right side

4. **Test on LinkedIn**
   - Navigate to any LinkedIn profile (e.g., `https://www.linkedin.com/in/someone`)
   - Click "Extract Contact Data" in the sidebar
   - Email patterns will be generated automatically

## File Structure

```
extension/
├── manifest.json                 # Extension configuration (Manifest V3)
├── icons/                        # Extension icons (16, 32, 48, 128px)
│   ├── icon-generator.html      # Tool to generate icons
│   └── README.md                # Icon instructions
├── sidepanel/
│   ├── sidepanel.html           # Sidebar UI
│   ├── sidepanel.css            # Styling
│   └── sidepanel.js             # Main sidebar logic
├── content/
│   └── linkedin-extractor.js    # Content script for LinkedIn
├── utils/
│   ├── email-patterns.js        # Basic email pattern generation
│   ├── email-inference.js       # Advanced inference engine with ML-like heuristics
│   └── storage.js               # Chrome storage helpers + caching
└── README.md                    # This file
```

## How It Works

### 1. Profile Detection
- Extension detects when you're on a LinkedIn profile page
- Shows "Extract Contact Data" button in sidebar
- Only works on `https://www.linkedin.com/in/*` pages

### 2. Data Extraction
When you click "Extract Contact Data":
- Content script reads visible DOM elements
- Extracts: name, role, company, LinkedIn URL
- No API calls, no background scraping
- Only data visible on the page

### 3. Advanced Email Inference
After extraction, the inference engine:

**Step 1: Domain Inference**
- Checks 100+ known company domains (e.g., "Microsoft Corp" → "microsoft.com")
- Falls back to cached mappings from previous extractions
- Generates heuristic domain if unknown (cleans company name + .com)

**Step 2: Name Normalization**
- Removes titles (Dr., Mr., etc.), middle names, accents
- Handles hyphenated names (generates with and without hyphens)
- Extracts initials for pattern variations

**Step 3: Pattern Generation with Confidence Scoring**
Generates 9+ patterns with base confidence scores:
  - first.last@domain.com (70% confidence)
  - first@domain.com (50% confidence)
  - f.last@domain.com (40% confidence)
  - flast@domain.com (30% confidence)
  - firstlast@domain.com (25% confidence)
  - first_last@domain.com (20% confidence)
  - lastf@domain.com (15% confidence)
  - last.first@domain.com (10% confidence)

**Step 4: Intelligent Adjustments**
- **Role-based boosts**: Recruiters (+10% to first.last), Founders (+15% to first@)
- **Company size adjustments**: Large companies prefer first.last, small companies prefer first@
- **Cache boosts**: Previously successful patterns get +20% confidence

**Step 5: Learning & Caching**
- When you send an email, the extension caches the selected pattern
- Future extractions for the same company/domain will rank that pattern higher
- Improves accuracy over time without any external APIs
- All processing happens locally in your browser

### 4. Actions
- **Save Contact**: Opens web app with pre-filled data
- **Generate Draft**: Creates email from template
- **Open in Gmail**: Opens Gmail compose with draft
- **Open in Outlook**: Opens Outlook compose with draft

## Privacy & Permissions

### Required Permissions
- `storage` - Store recent contacts locally
- `sidePanel` - Display sidebar UI
- `activeTab` - Check current tab URL
- `scripting` - Inject content script on LinkedIn

### What We DON'T Do
❌ No automatic background scraping
❌ No data sent to external servers
❌ No tracking or analytics
❌ No bulk profile extraction
❌ No email verification API calls

### What We DO
✅ Extract only visible profile data
✅ Process everything locally
✅ Store contacts only in your browser
✅ Require manual click to extract

## Troubleshooting

### "Extract Contact Data" button is disabled
- **Solution**: Make sure you're on a LinkedIn profile page (`/in/` in URL)
- Navigate to a profile, then click the extension icon

### Extraction fails / No data shown
- **Solution**: LinkedIn may have updated their DOM structure
- Check browser console for errors (`F12` → Console tab)
- Content script selectors may need updating

### Icons not showing
- **Solution**: Generate proper icon files
- Open `icons/icon-generator.html` and save PNGs
- Reload extension in `chrome://extensions/`

### Sidebar doesn't open
- **Solution**: Manifest V3 requires Chrome 114+
- Update Chrome to latest version
- Check for extension errors in `chrome://extensions/`

## Development

### Making Changes

1. **Modify Files**
   - Edit any `.html`, `.css`, or `.js` files
   - Changes to content scripts require page reload
   - Changes to sidebar require sidebar reload

2. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click the refresh icon on the Ellyn extension
   - Or toggle the extension off and on

3. **Debug Content Script**
   - Open DevTools on LinkedIn page (`F12`)
   - Check Console for `[Ellyn]` messages
   - Content script logs extraction process

4. **Debug Sidebar**
   - Right-click on the sidebar
   - Select "Inspect"
   - Sidebar DevTools opens with console

### Updating LinkedIn Selectors

If LinkedIn changes their HTML structure:

1. Open `content/linkedin-extractor.js`
2. Find the `extractProfileData()` function
3. Update CSS selectors:
   ```javascript
   // Example: Update name selector
   const nameElement = document.querySelector('h1.NEW-CLASS-NAME');
   ```
4. Test on multiple profiles to ensure reliability

## Roadmap / TODOs

### Next Features
- [ ] Email verification (would require API)
- [ ] More email templates
- [ ] Custom template creation
- [ ] Copy email to clipboard
- [ ] Dark mode support
- [ ] Keyboard shortcuts
- [ ] Export contacts to CSV

### Known Limitations
- No email verification (by design - no API calls)
- No bulk extraction (explicitly non-goal)
- No automatic extraction (privacy focused)
- Domain guessing may be inaccurate for complex company names

## Web App Integration

The extension integrates with the Ellyn web app:

### "Save Contact" Action
Opens web app at: `http://localhost:3001/?prefill=true&name=John+Doe&company=Microsoft`

The web app should:
1. Read URL parameters
2. Pre-fill the email discovery form
3. Allow user to verify/save the lead

### Production Deployment
Update `WEB_APP_URL` in `sidepanel.js` to your production domain:
```javascript
const WEB_APP_URL = 'https://yourdomain.com';
```

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review browser console for errors
3. Open an issue on GitHub

## License

Part of the Ellyn Email Discovery Platform.
