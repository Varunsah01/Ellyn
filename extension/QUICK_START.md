# Quick Start Guide - Ellyn Extension

Get the extension running in 5 minutes!

## Step 1: Generate Icons (2 minutes)

1. Open `extension/icons/icon-generator.html` in your browser
2. Right-click on each icon:
   - icon16.png → Save as `icon16.png`
   - icon32.png → Save as `icon32.png`
   - icon48.png → Save as `icon48.png`
   - icon128.png → Save as `icon128.png`
3. Save all files in the `extension/icons/` folder

**Alternative**: Use any 128x128 PNG image temporarily (rename to icon128.png and duplicate for other sizes)

## Step 2: Load Extension in Chrome (1 minute)

1. Open Chrome
2. Navigate to: `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top-right corner)
4. Click **"Load unpacked"**
5. Select the `extension` folder from your project
6. ✅ Extension should now appear in your toolbar!

## Step 3: Pin Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Ellyn - LinkedIn Email Finder"
3. Click the pin icon to keep it visible

## Step 4: Test the Extension (2 minutes)

### Test on a LinkedIn Profile

1. Go to any LinkedIn profile:
   - Example: `https://www.linkedin.com/in/satya-nadella-3145136/`
   - Or search for someone and open their profile

2. Click the **Ellyn** extension icon in your toolbar
   - The sidebar opens on the right side
   - You should see "LinkedIn profile detected" message

3. Click **"Extract Contact Data"**
   - Profile data is extracted
   - Email patterns are generated automatically
   - 8-13 email variations appear with confidence scores

4. Click on an email pattern to select it

5. Try the actions:
   - **Save Contact** → Opens web app with pre-filled data
   - **Generate Draft** → Updates email preview
   - **Open in Gmail** → Opens Gmail compose
   - **Open in Outlook** → Opens Outlook compose

### Test on a Non-LinkedIn Page

1. Go to any other website (e.g., google.com)
2. Click the Ellyn extension icon
3. You should see: "Open a LinkedIn profile to get started"
4. Extract button should be hidden

## Step 5: Check Recent Contacts

1. After saving a contact, scroll down in the sidebar
2. See "Recent Contacts" section
3. Your saved contact appears here
4. Click it to open web app dashboard

## Troubleshooting

### Icons not showing?
- **Fix**: Complete Step 1 above
- **Quick workaround**: Extension works without icons (shows puzzle piece)

### "Extract Contact Data" button not appearing?
- **Fix**: Make sure you're on a profile page (`/in/` in URL)
- **Check**: URL should look like `linkedin.com/in/someone`

### Extraction fails or returns empty data?
- **Fix**: LinkedIn may have updated their HTML
- **Check**: Open browser DevTools (F12) → Console tab
- **Look for**: `[Ellyn]` messages that show extraction process

### Sidebar doesn't open?
- **Fix**: Right-click extension icon → "Inspect views: Side panel"
- **Check**: Any JavaScript errors in console?

## What to Test

✅ **Must Test**:
- [ ] Extension loads without errors
- [ ] Sidebar opens on icon click
- [ ] Detects LinkedIn profile pages
- [ ] Extracts profile data
- [ ] Generates email patterns
- [ ] Saves contacts to storage
- [ ] Shows recent contacts

✅ **Should Test**:
- [ ] Email templates work
- [ ] Gmail button opens compose
- [ ] Outlook button opens compose
- [ ] Web app integration (Save Contact)

## Next Steps

1. **Customize Templates**
   - Edit `sidepanel/sidepanel.js`
   - Update `EMAIL_TEMPLATES` object

2. **Update Web App URL**
   - Change `http://localhost:3001` to your production URL
   - Update in `sidepanel.js` and `footer` links

3. **Test on Different Profiles**
   - Try profiles with different name formats
   - Test hyphenated names, titles, etc.
   - Verify email pattern accuracy

4. **Monitor Console**
   - Open DevTools on LinkedIn page
   - Watch for `[Ellyn]` log messages
   - Check for any errors

## Development Tips

### Reload After Changes

**Content Script Changes** (linkedin-extractor.js):
- Reload the extension: `chrome://extensions/` → Click refresh icon
- Reload the LinkedIn page (F5)

**Sidebar Changes** (sidepanel.html/css/js):
- Close and reopen the sidebar
- Or reload the extension

### Debug Console

**Content Script** (LinkedIn page):
- Press F12 on LinkedIn page
- Console tab shows `[Ellyn]` messages

**Sidebar**:
- Right-click inside sidebar
- Click "Inspect"
- Separate DevTools opens for sidebar

## Support

See full documentation in `extension/README.md`

## File Structure Reference

```
extension/
├── manifest.json              # ← Extension config
├── icons/
│   ├── icon-generator.html   # ← Open this to generate icons
│   └── icon*.png             # ← Save generated icons here
├── sidepanel/
│   ├── sidepanel.html        # ← UI structure
│   ├── sidepanel.css         # ← Styling
│   └── sidepanel.js          # ← Main logic (edit templates here)
├── content/
│   └── linkedin-extractor.js # ← LinkedIn data extraction
└── utils/
    ├── email-patterns.js     # ← Email generation logic
    └── storage.js            # ← Chrome storage helpers
```

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Icons are puzzle pieces | Generate PNG icons from icon-generator.html |
| Sidebar is blank | Check DevTools console for errors |
| Extract button missing | Verify you're on a LinkedIn profile page |
| No email patterns | Check if company name extracted correctly |
| Can't save contacts | Check Chrome storage permissions |

---

**Ready to start?** Jump to Step 1! 🚀
