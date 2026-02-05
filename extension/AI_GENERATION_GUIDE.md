# AI-Powered Email Generation - Complete Guide

## Overview

Ellyn now includes AI-powered email draft generation using Claude 3.5 Haiku (Anthropic's most cost-effective model). This feature generates personalized, context-aware cold outreach emails with full user control and transparency.

---

## ✨ Key Features

### User Control & Safety
- ✅ **Explicit user action required** - User must click "Generate with AI" button
- ✅ **Cost transparency** - Shows estimated cost before generation (~$0.001 per email)
- ✅ **Human review mandatory** - All AI outputs are editable before sending
- ✅ **Rate limiting** - 3 requests per minute, 50 per day
- ✅ **Graceful fallback** - Template system available if AI fails

### Privacy & Security
- 🔒 **API key stored locally** - Encrypted by Chrome, never sent to Ellyn servers
- 🔒 **No backend tracking** - All processing happens client-side
- 🔒 **User owns their key** - Can be removed anytime
- 🔒 **Transparent costs** - Real-time usage tracking

### Intelligence
- 🧠 **Context-aware** - Uses recipient's role, company, and your profile
- 🧠 **Style customization** - Professional, casual, or referral-focused
- 🧠 **Tone adjustment** - Warm, direct, or enthusiastic
- 🧠 **Custom instructions** - Add specific requirements
- 🧠 **Under 150 words** - Respects brevity for cold outreach

---

## 🚀 Setup Guide

### Step 1: Get Anthropic API Key

1. Visit [console.anthropic.com](https://console.anthropic.com/)
2. Create an account or sign in
3. Navigate to "API Keys" section
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)

**Cost Information:**
- ~$0.001 per email (~0.1¢)
- 50 emails ≈ $0.05
- 1000 emails ≈ $1.00

### Step 2: Configure Ellyn

1. Open Ellyn sidebar
2. Click ⚙️ Settings button (bottom right)
3. Paste your API key
4. Click "Save & Connect"

### Step 3: Set Up Your Profile

1. Click "Set up profile" prompt (appears after API key setup)
2. Enter:
   - Your Name (required)
   - Your Role/Major (optional but recommended)
   - Your School/Company (optional but recommended)
3. Click "Save Profile"

**Why profile matters:**
- Helps AI personalize emails from your perspective
- Includes relevant context (e.g., "Fellow Stanford grad")
- Makes emails feel authentic

---

## 📝 Usage Guide

### Basic Workflow

```
1. Extract LinkedIn Profile
   ↓
2. Select Email Address
   ↓
3. Customize Generation Settings
   ↓
4. Click "Generate with AI"
   ↓
5. Review & Edit Draft
   ↓
6. Open in Gmail/Outlook
```

### Generation Settings

**Style Options:**
- **Professional** - Polished, suitable for corporate settings
- **Casual** - Friendly and conversational while remaining respectful
- **Referral-Focused** - Emphasizes seeking advice/insights, not asking for jobs

**Tone Options:**
- **Warm** - Personable, showing genuine interest
- **Direct** - Concise, respecting their time
- **Enthusiastic** - Energetic, showing passion

**Additional Instructions:**
- Optional field for custom requirements
- Examples:
  - "Mention my interest in AI"
  - "Keep it very brief"
  - "Reference their recent blog post"
  - "Ask about internship opportunities"

---

## 💡 Example Generations

### Example 1: Professional + Warm

**Input:**
- Recipient: Sarah Johnson, Senior Recruiter at Microsoft
- Your Profile: John Doe, Computer Science Student at Stanford
- Style: Professional
- Tone: Warm

**Generated Output:**
```
Subject: Stanford student interested in Microsoft

Hi Sarah,

I hope this email finds you well. I'm John, a Computer Science student at Stanford, and came across your profile while researching Microsoft's engineering teams.

I'm particularly interested in learning about the culture and opportunities for new grads. Would you have 15 minutes for a brief call to share your insights?

I understand you're busy, so no pressure at all. Thanks for considering!

Best regards,
John
```

### Example 2: Casual + Enthusiastic

**Input:**
- Recipient: Alex Chen, Founder at TechStartup
- Your Profile: Jane Smith, Product Designer
- Style: Casual
- Tone: Enthusiastic
- Custom: "Mention I love their product design"

**Generated Output:**
```
Subject: Love what you're building at TechStartup!

Hi Alex,

I'm Jane, a Product Designer, and I've been absolutely loving what you're building at TechStartup—especially the design aesthetic!

I'm exploring opportunities in the startup space and would love to learn from your experience as a founder. Would you be up for a quick virtual coffee chat?

Looking forward to hearing from you!

Jane
```

### Example 3: Referral-Focused + Direct

**Input:**
- Recipient: Michael Brown, Engineering Manager at Google
- Your Profile: David Lee, Software Engineering Student at MIT
- Style: Referral-Focused
- Tone: Direct

**Generated Output:**
```
Subject: MIT student seeking advice about Google

Hi Michael,

I'm David, an SWE student at MIT, and I'm reaching out to learn more about your experience as an Engineering Manager at Google.

Would you have 10-15 minutes to discuss the team culture and what you look for in new grad candidates?

Thank you for your time,
David
```

---

## 🔧 Technical Details

### API Configuration

**File:** `config/api-config.js`

```javascript
const API_CONFIG = {
  anthropic: {
    model: 'claude-3-5-haiku-20241022', // Cost-effective
    maxTokens: 300, // Keeps responses concise
    temperature: 0.7 // Balanced creativity
  },
  dailyLimit: 50, // Max generations per day
  rateLimitWindow: 60000, // 1 minute
  rateLimitMax: 3 // Max 3 per minute
};
```

### Cost Calculation

**Pricing (per million tokens):**
- Input: $0.25
- Output: $1.25

**Average per email:**
- Input tokens: ~200
- Output tokens: ~200
- Cost: ~$0.001 (0.1¢)

### Rate Limiting

**Per-Minute Limit:**
- Max 3 requests per 60-second window
- Prevents accidental spam
- Error message shows wait time

**Daily Limit:**
- Max 50 generations per day
- Resets at midnight local time
- Tracks usage in Chrome Storage

### Usage Tracking

**Stored Data:**
```javascript
{
  aiUsage: {
    "2025-01-15": {
      count: 12,
      totalCost: 0.012,
      firstUsed: "2025-01-15T10:30:00Z",
      lastUsed: "2025-01-15T15:45:00Z"
    }
  }
}
```

**Displays:**
- Remaining generations today
- Total cost (all time)
- Color-coded warnings:
  - Green: 11+ remaining
  - Yellow: 6-10 remaining
  - Red: 0-5 remaining

---

## 🎨 UI Components

### Generation Section

```
┌──────────────────────────────────────┐
│ ✨ Generate with AI                  │
├──────────────────────────────────────┤
│                                      │
│ Style: [Professional ▼]             │
│ Tone:  [Warm ▼]                     │
│                                      │
│ Additional Instructions:             │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 48 generations remaining   ~$0.001  │
│                                      │
│ [✨ Generate with AI]               │
│ [📝 Use Template Instead]           │
└──────────────────────────────────────┘
```

### Draft Preview

```
┌──────────────────────────────────────┐
│ Your Draft                [🔄] [✏️]  │
├──────────────────────────────────────┤
│                                      │
│ Subject:                             │
│ ┌──────────────────────────────────┐ │
│ │ Quick question about Microsoft   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Body:                                │
│ ┌──────────────────────────────────┐ │
│ │ Hi Sarah,                        │ │
│ │                                  │ │
│ │ I hope this email finds you...   │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ 92 words          Cost: $0.0012     │
└──────────────────────────────────────┘
```

### API Setup Modal

```
┌──────────────────────────────────────┐
│ AI Email Generation Setup        [×] │
├──────────────────────────────────────┤
│                                      │
│ To generate personalized emails      │
│ with AI, you'll need an Anthropic    │
│ API key.                             │
│                                      │
│ How to get your API key:             │
│ 1. Go to console.anthropic.com       │
│ 2. Create account or sign in         │
│ 3. Navigate to "API Keys"            │
│ 4. Click "Create Key" and copy it    │
│ 5. Paste it below                    │
│                                      │
│ Anthropic API Key:                   │
│ ┌──────────────────────────────┐     │
│ │ sk-ant-...              [👁️] │     │
│ └──────────────────────────────┘     │
│                                      │
│ 💡 Cost: ~$0.001 per email           │
│    50 emails ≈ $0.05                 │
│                                      │
│ 🔒 Stored locally, never shared      │
│                                      │
│ [Save & Connect]  [Cancel]           │
└──────────────────────────────────────┘
```

---

## ⚠️ Error Handling

### Rate Limit Exceeded

**Error:** "Rate limit exceeded. Please wait 45 seconds."

**Solution:** Wait for the cooldown period. This prevents accidental spam.

### Daily Limit Reached

**Error:** "Daily generation limit reached (50 emails). Resets at midnight!"

**Solution:** Wait until midnight or use templates as fallback.

### Invalid API Key

**Error:** "Invalid API key. Please check your settings."

**Solution:**
1. Open Settings
2. Verify API key starts with `sk-ant-`
3. Copy fresh key from Anthropic console
4. Save again

### Network Error

**Error:** "Network error. Check your connection and try again."

**Solution:**
1. Check internet connection
2. Verify Anthropic API status
3. Try again in a few moments
4. Use template as fallback

### API Error (429, 500, etc.)

**Automatic Fallback:**
- After 2 consecutive failures, extension offers template option
- User can choose to retry or use template
- Error details logged to console

---

## 🎯 Best Practices

### 1. Personalize with Instructions

**Good:**
```
Additional Instructions: "Mention I saw their talk at TechCrunch Disrupt"
```

**Result:** AI incorporates specific context into email.

### 2. Choose Appropriate Style/Tone

**For Recruiters:** Professional + Warm
**For Founders:** Casual + Enthusiastic
**For Managers:** Professional + Direct
**For Alumni:** Casual + Warm

### 3. Always Review and Edit

- AI generates good drafts, but not perfect
- Add personal touches
- Fix any awkward phrasing
- Verify facts (names, companies, etc.)

### 4. Keep Profile Updated

- Update role when you graduate or change jobs
- Remove school if no longer relevant
- Keep name consistent with your email signature

### 5. Monitor Usage

- Check remaining generations before bulk outreach
- Track costs if doing high-volume outreach
- Consider upgrading model if quality matters more than cost

---

## 🔄 Regeneration

### When to Regenerate

- Draft doesn't match your voice
- Tone feels off for the recipient
- Want to try different style/tone
- Made significant changes to custom instructions

### How to Regenerate

1. Click 🔄 Regenerate button (top right of draft)
2. Confirm prompt (uses another generation)
3. Review new draft
4. Edit as needed

**Note:** Each regeneration counts toward daily limit and incurs cost.

---

## 💾 Draft Management

### Editing Drafts

- Subject and body are fully editable
- Changes are saved in memory (not persistent)
- Word count updates in real-time
- Warn if exceeds 200 words (too long)

### Sending Drafts

1. Review and edit draft
2. Click "Open in Gmail" or "Open in Outlook"
3. Email client opens in new tab with pre-filled draft
4. **YOU must click Send** in your email client
5. Return to sidebar to track outreach

**Important:** Ellyn never sends emails. You maintain full control.

---

## 📊 Usage Statistics

### View Your Stats

**In Extension:**
- Remaining generations: Top of AI section
- Daily cost: Draft meta info
- Total cost: Available in settings

**Example Display:**
```
48 generations remaining today
Cost: $0.0012
Total spent: $0.14
```

### Reset Usage Data

**Option 1:** Automatic reset at midnight
**Option 2:** Manual reset in console:
```javascript
await chrome.storage.local.remove(['aiUsage']);
```

---

## 🛡️ Privacy & Security

### What's Stored Locally

- **API Key:** Encrypted by Chrome Storage API
- **User Profile:** Name, role, school (unencrypted)
- **Usage Stats:** Generation counts and costs
- **Draft History:** NOT stored (intentional)

### What's Never Stored

- Generated email content
- Recipient information
- API responses beyond current session
- Tracking or analytics data

### What's Sent to Anthropic

**Per Generation:**
- Contact name, role, company
- Your name, role, school
- Style, tone, custom instructions

**Never Sent:**
- API key (only in headers)
- Email addresses
- Other generated drafts
- Usage statistics

### API Key Security

- Stored in `chrome.storage.local`
- Encrypted by Chrome (same security as passwords)
- Never logged or displayed (except masked)
- Can be removed anytime
- Never transmitted to Ellyn servers

---

## 🆚 AI vs. Templates

### When to Use AI

✅ Personalized outreach
✅ High-value targets
✅ Unique contexts
✅ Want to learn recipient's background
✅ Have specific customization needs

### When to Use Templates

✅ Bulk outreach
✅ Similar recipients
✅ Proven message works
✅ Want consistency
✅ Conserve API credits
✅ AI is unavailable

### Hybrid Approach

1. Use AI for first 10-20 drafts
2. Identify patterns in good drafts
3. Create custom template based on AI style
4. Use template for bulk, AI for special cases

---

## 🚨 Troubleshooting

### Generation Button Shows "Set up AI Generation"

**Cause:** No API key configured

**Fix:**
1. Click button (opens settings)
2. Enter API key
3. Button will change to "Generate with AI"

### "Please set up your profile first"

**Cause:** User profile incomplete

**Fix:**
1. Click profile prompt
2. Enter at least your name
3. Save profile

### Draft Quality Issues

**Problem:** Generic or doesn't match voice

**Solutions:**
1. Add more custom instructions
2. Try different style/tone
3. Regenerate
4. Edit manually
5. Switch to templates

### Popup Blocked

**Cause:** Browser blocking new tabs

**Fix:**
1. Allow popups for Ellyn
2. Check browser settings
3. Use "Copy Draft" as fallback

---

## 📈 Advanced Usage

### Batch Generation Strategy

1. Extract 10 profiles in different tabs
2. Generate 3 drafts per minute (rate limit)
3. Save best drafts to notes
4. Edit and personalize later
5. Send in batches

### Cost Optimization

1. Use clear custom instructions (reduces regenerations)
2. Batch similar recipients (reuse learnings)
3. Create templates from AI drafts
4. Reserve AI for high-priority contacts

### Quality Improvement Tips

1. **Be specific in instructions**
   - ❌ "Make it friendly"
   - ✅ "Mention we met at XYZ conference"

2. **Provide context**
   - ❌ No custom instructions
   - ✅ "They recently published a paper on AI safety"

3. **Match tone to relationship**
   - Cold contact → Professional
   - Referral → Warm
   - Alumni → Enthusiastic

---

## 🎓 Learning Resources

### Understanding Claude 3.5 Haiku

- **Model:** claude-3-5-haiku-20241022
- **Strengths:** Fast, cost-effective, good at short-form content
- **Limitations:** Less nuanced than Opus, occasional awkward phrasing
- **Best for:** Cold outreach emails under 200 words

### Prompt Engineering Tips

1. **Be specific:** "Mention their role as Engineering Manager"
2. **Set expectations:** Automatically limited to 150 words
3. **Provide examples:** "Similar to how alumni reach out"
4. **Iterate:** Use regenerate to refine

### Anthropic API Resources

- [API Documentation](https://docs.anthropic.com/)
- [Pricing Calculator](https://anthropic.com/pricing)
- [Model Comparison](https://anthropic.com/claude)
- [Best Practices](https://docs.anthropic.com/claude/docs/prompt-engineering)

---

## 🔮 Future Enhancements

### Planned Features

- [ ] Template learning from AI drafts
- [ ] A/B testing different styles
- [ ] Response rate tracking
- [ ] Email verification before generation
- [ ] Multi-language support
- [ ] Tone analysis of generated drafts

### Community Requests

Submit feature requests at: [GitHub Issues](https://github.com/your-repo/issues)

---

## 📞 Support

### Getting Help

1. Check this guide first
2. Review error messages
3. Check console logs (`[AI Draft]` prefix)
4. Contact support with:
   - Error message
   - Browser console screenshot
   - Steps to reproduce

### Known Issues

None currently reported. Extension is in beta.

---

## 📄 License & Terms

- API key is user's responsibility
- Ellyn does not pay for API usage
- Anthropic's terms of service apply
- No warranty on draft quality
- User reviews all generated content

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0
**Compatible With:** Chrome/Edge Manifest V3
