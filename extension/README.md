# Ellyn Browser Extension

**100% LinkedIn-compliant email discovery workspace** - No scraping, no DOM access, manual input only.

## 🚨 Important: LinkedIn Compliance

This extension is **fully compliant** with LinkedIn's Terms of Service:

✅ **NO LinkedIn scraping or data extraction**
✅ **NO content scripts on LinkedIn**
✅ **NO DOM access or automation**
✅ **Manual input only** - User types/pastes data
✅ **API-based enrichment** - Calls your web app backend

## Features

### ✅ Manual Input Workspace
- Clean form for entering contact details (name, company, role)
- No automation - user manually enters data
- Can be used while browsing any website (not just LinkedIn)

### ✅ API-Powered Enrichment
- Calls your Next.js web app API for enrichment
- Gets company domain, industry, size from free APIs
- Generates email patterns with confidence scores
- All processing happens server-side

### ✅ Contact Management
- Save contacts to web app database
- View recent contacts (synced from web app)
- One-click access to full web app

### ✅ Privacy Focused
- No tracking or analytics
- Data stored locally using Chrome Storage
- API calls only to your own web app
- No third-party data sharing

## Installation

### Development Mode (For Testing)

1. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension` folder
   - The Ellyn icon should appear in your toolbar

2. **Open Sidebar**
   - Click the Ellyn extension icon in the toolbar
   - The sidebar panel will open

3. **Test Manual Input**
   - Enter contact details (First Name, Last Name, Company)
   - Click "Discover Email"
   - Results will show company info + email patterns
   - Select a pattern and save to web app

## File Structure

```
extension/
├── manifest.json                 # Extension configuration (Manifest V3)
├── icons/                        # Extension icons
├── sidepanel/
│   ├── sidepanel.html           # Manual input form UI
│   ├── sidepanel.css            # Styling
│   └── sidepanel.js             # Form logic + API calls
├── utils/
│   ├── api-client.js            # Web app API wrapper
│   └── storage.js               # Chrome storage helper
└── README.md                    # This file
```

**REMOVED FILES (LinkedIn scraping):**
- ❌ `content/linkedin-extractor.js` - DELETED
- ❌ `utils/email-inference.js` - DELETED (now server-side)
- ❌ `utils/ai-draft-generator.js` - DELETED (AI removed)
- ❌ `utils/email-patterns.js` - DELETED (now server-side)

## How It Works

### 1. Manual Input
- User enters contact details in sidebar form
- First Name, Last Name, Company, Role (optional)
- Click "Discover Email" to enrich

### 2. API Enrichment
- Extension calls `POST /api/enrich` on web app
- Server fetches company info (domain, industry, size)
- Server generates 8-12 email patterns with confidence scores
- Results returned to extension

### 3. Display Results
- Company info shown (domain, industry, size)
- Email patterns displayed as selectable cards
- Each pattern has confidence score (high/medium/low)
- User selects best pattern

### 4. Save Contact
- Selected email + contact data sent to web app
- Calls `POST /api/contacts` to save
- Contact stored in database
- Shows in recent contacts list

### 5. Sync with Web App
- Click "Sync" button to fetch recent contacts
- Updates local storage with last 5 contacts
- Keeps extension in sync with web app

## Privacy & Permissions

### Required Permissions
- `storage` - Store recent contacts locally (Chrome Storage)
- `sidePanel` - Display sidebar UI
- `http://localhost:3000/*` - Allow API calls to local dev server

### What We DON'T Do
❌ NO LinkedIn scraping
❌ NO content scripts
❌ NO DOM access
❌ NO automation
❌ NO background scraping
❌ NO tracking or analytics
❌ NO third-party data sharing

### What We DO
✅ Manual user input only
✅ API calls to your own web app
✅ Local storage for recent contacts
✅ 100% LinkedIn compliant

## Configuration

### API URL
By default, the extension calls `http://localhost:3000` for development.

To change for production:

1. Open `extension/utils/api-client.js`
2. Update `baseURL`:
   ```javascript
   this.baseURL = 'https://your-production-domain.com';
   ```

### Manifest Host Permissions
Update `manifest.json` for production:
```json
"host_permissions": [
  "https://your-production-domain.com/*"
]
```

## Troubleshooting

### API calls failing
- **Solution**: Make sure web app is running on `http://localhost:3000`
- Check browser console for errors (`F12` → Console tab)
- Verify CORS is enabled in web app API routes

### Sidebar doesn't open
- **Solution**: Manifest V3 requires Chrome 114+
- Update Chrome to latest version
- Check for extension errors in `chrome://extensions/`

### Recent contacts not loading
- **Solution**: Click "Sync" button to fetch from web app
- Verify web app API is running
- Check `GET /api/contacts` endpoint is working

### Icons not showing
- **Solution**: Rename icons to match manifest.json
- Icons should be named: `icon-16.png`, `icon-48.png`, `icon-128.png`
- Reload extension in `chrome://extensions/`

## Development

### Making Changes

1. **Modify Files**
   - Edit any `.html`, `.css`, or `.js` files
   - Changes require extension reload

2. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click the refresh icon on the Ellyn extension
   - Or toggle the extension off and on

3. **Debug Sidebar**
   - Right-click on the sidebar
   - Select "Inspect"
   - Sidebar DevTools opens with console

## Web App Integration

The extension depends on these API endpoints:

### POST /api/enrich
Enrich contact with company data + email patterns.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "company": "Microsoft",
  "role": "Engineer"
}
```

**Response:**
```json
{
  "success": true,
  "enrichment": {
    "domain": "microsoft.com",
    "industry": "Technology",
    "size": "10000+"
  },
  "emails": [
    { "email": "john.doe@microsoft.com", "pattern": "first.last", "confidence": 85 },
    { "email": "john@microsoft.com", "pattern": "first", "confidence": 65 }
  ],
  "cost": 0
}
```

### POST /api/contacts
Save contact to database.

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "company": "Microsoft",
  "role": "Engineer",
  "inferredEmail": "john.doe@microsoft.com",
  "emailConfidence": 85,
  "companyDomain": "microsoft.com",
  "companyIndustry": "Technology",
  "companySize": "10000+",
  "source": "extension"
}
```

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "123",
    "full_name": "John Doe",
    ...
  }
}
```

### GET /api/contacts?limit=5
Get recent contacts.

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "123",
      "full_name": "John Doe",
      "company": "Microsoft",
      "inferred_email": "john.doe@microsoft.com",
      ...
    }
  ]
}
```

## Chrome Web Store Submission

This extension is designed to pass Chrome Web Store review:

✅ **No LinkedIn scraping** - Complies with LinkedIn ToS
✅ **Manual input only** - No automation
✅ **Clear privacy policy** - No data collection
✅ **Minimal permissions** - Only storage + sidePanel
✅ **No obfuscated code** - All code is readable

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review browser console for errors
3. Verify web app API is running
4. Check API endpoint responses

## License

Part of the Ellyn Email Discovery Platform.
