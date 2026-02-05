# AI Email Generation - Quick Reference

## 🚀 Quick Start (5 Minutes)

### 1. Get API Key
```
1. Visit console.anthropic.com
2. Sign up/Login
3. Create API key
4. Copy key (starts with sk-ant-)
```

### 2. Setup Extension
```
1. Click ⚙️ Settings in Ellyn
2. Paste API key
3. Click "Save & Connect"
4. Enter your name, role, school
5. Done! ✓
```

### 3. Generate First Email
```
1. Extract LinkedIn profile
2. Select email address
3. Choose style & tone
4. Click "✨ Generate with AI"
5. Review & edit draft
6. Open in Gmail/Outlook
```

---

## 💰 Pricing

| Volume | Cost |
|--------|------|
| 1 email | ~$0.001 (0.1¢) |
| 50 emails | ~$0.05 (5¢) |
| 100 emails | ~$0.10 (10¢) |
| 1,000 emails | ~$1.00 ($1) |

---

## ⚙️ Settings

### Style Options
- **Professional** - Corporate, polished
- **Casual** - Friendly, conversational
- **Referral** - Advice-focused

### Tone Options
- **Warm** - Personable, genuine
- **Direct** - Concise, respectful
- **Enthusiastic** - Energetic, passionate

### Custom Instructions
Add specific requirements:
- "Mention my interest in AI"
- "Keep it under 100 words"
- "Reference their blog post"

---

## 🎯 Best Practices

### ✅ DO
- Review and edit ALL drafts
- Add personal touches
- Use custom instructions
- Match tone to recipient
- Keep profile updated

### ❌ DON'T
- Send without reviewing
- Exceed 200 words
- Copy-paste without editing
- Spam generate (rate limits)
- Share your API key

---

## 🚨 Limits

| Limit | Value |
|-------|-------|
| Per Minute | 3 requests |
| Per Day | 50 requests |
| Max Tokens | 300 (~150 words) |

---

## 🔧 Troubleshooting

### "Invalid API Key"
→ Check key starts with `sk-ant-`
→ Copy fresh key from console

### "Rate Limit Exceeded"
→ Wait 60 seconds
→ Maximum 3 per minute

### "Daily Limit Reached"
→ Used 50 generations today
→ Resets at midnight
→ Use templates instead

### "Network Error"
→ Check internet connection
→ Try again in a moment
→ Use template fallback

---

## 💡 Examples

### Professional + Warm
```
Subject: Stanford student interested in Microsoft

Hi Sarah,

I'm John, a Computer Science student at Stanford,
and came across your profile while researching
Microsoft's engineering teams.

Would you have 15 minutes to share your insights
about the culture and opportunities for new grads?

Thanks for considering!
John
```

### Casual + Enthusiastic
```
Subject: Love what you're building!

Hi Alex,

I'm Jane, a Product Designer, and I've been loving
what you're building at TechStartup!

Would you be up for a quick virtual coffee chat to
discuss your experience as a founder?

Looking forward to it!
Jane
```

---

## 🔒 Security

- ✅ API key encrypted locally
- ✅ Never sent to Ellyn servers
- ✅ You can remove anytime
- ✅ No email tracking
- ✅ Full privacy

---

## 📊 Usage Tracking

**View Stats:**
- Top of AI section shows remaining
- Draft shows cost per email
- Settings shows total cost

**Example:**
```
48 generations remaining today
Cost: $0.0012
Total spent: $0.14
```

---

## ⌨️ Keyboard Shortcuts

Currently no shortcuts, but coming soon:
- `Ctrl+Enter` - Generate
- `Ctrl+R` - Regenerate
- `Ctrl+E` - Edit draft

---

## 🆘 Support

### Need Help?
1. Read AI_GENERATION_GUIDE.md
2. Check console logs (`[AI Draft]`)
3. GitHub Issues or Email Support

### Feature Requests
Submit at: github.com/your-repo/issues

---

## 🎓 Pro Tips

1. **Personalize Every Email**
   - Use custom instructions
   - Mention specific details
   - Edit AI suggestions

2. **Match Your Voice**
   - Try different tones
   - Edit to sound like you
   - Save favorites as templates

3. **Optimize Costs**
   - Use clear instructions (fewer regenerations)
   - Batch similar emails
   - Create templates from best AI drafts

4. **Track What Works**
   - Note which style/tone gets responses
   - Refine over time
   - Share learnings

---

**Version:** 1.0.0
**Last Updated:** 2025-01-15

---

### Quick Command Reference

```bash
# View usage stats (console)
chrome.storage.local.get(['aiUsage'])

# Clear usage data (console)
chrome.storage.local.remove(['aiUsage'])

# View API key status (console)
chrome.storage.local.get(['anthropicApiKey'])
  .then(r => console.log(r.anthropicApiKey ? 'Set' : 'Not set'))
```
