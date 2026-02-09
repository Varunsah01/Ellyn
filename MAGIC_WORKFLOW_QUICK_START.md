# ⚡ Magic Workflow - Quick Start Guide

## 🎯 What is the Magic Workflow?

**One-click LinkedIn outreach** - Extract profile data, generate a personalized email draft, and send it to Gmail/Outlook in just **3 clicks** and **~6 seconds**.

---

## 🚀 How to Use

### **Step 1: Visit a LinkedIn Profile**
Navigate to any LinkedIn profile URL:
```
linkedin.com/in/john-doe
```

The extension will automatically detect you're on LinkedIn and show:
```
┌─────────────────────────────────┐
│ in  LinkedIn Profile Detected   │
│     [Detected Name]              │
└─────────────────────────────────┘
```

---

### **Step 2: Click the Magic Button**
Click the big purple button:
```
┌─────────────────────────────────┐
│  ✨  Extract & Generate Draft   │
│      One-click complete setup    │
└─────────────────────────────────┘
```

Watch the magic happen (5 steps, ~6 seconds):
```
⏳ Step 1/5: Extracting profile...
⏳ Step 2/5: Finding best email...
⏳ Step 3/5: Detecting role type...
⏳ Step 4/5: Generating draft...
✓  Step 5/5: Draft ready!
```

---

### **Step 3: Review Your Draft**
Your personalized draft appears instantly:
```
┌─────────────────────────────────┐
│ Draft Ready!              ✏️ ↶ ↷│
├─────────────────────────────────┤
│ Subject: Connecting for [Role]  │
│                                  │
│ Hi John,                         │
│                                  │
│ I came across your profile...   │
│ [Personalized content]           │
│                                  │
│ Best regards,                    │
│ [Your name]                      │
│                                  │
│ 94 words • 562 characters        │
├─────────────────────────────────┤
│ [📧 Send via Gmail]             │
│ [📧 Send via Outlook]           │
│ [📋 Copy to Clipboard]          │
└─────────────────────────────────┘
```

---

### **Step 4 (Optional): Quick Edit**
Want to personalize further? Click the edit icon (✏️) or press `Ctrl+E`:
```
- Subject and body become editable
- Real-time word/character count
- Undo/redo support (Ctrl+Z/Y)
- Click save icon when done
```

---

### **Step 5: Send!**
Click **"Send via Gmail"** or press `Ctrl+Enter`:
```
→ Gmail compose opens in new tab
→ To, Subject, Body all pre-filled
→ Contact automatically saved
→ Done! 🎉
```

---

## ⌨️ Power User Shortcuts

Once you learn these, you'll never use the mouse again:

| Shortcut | What it does |
|----------|-------------|
| **Ctrl+M** | Start magic workflow |
| **Ctrl+Enter** | Send via Gmail |
| **Ctrl+E** | Quick edit draft |
| **Ctrl+Z** | Undo changes |
| **Ctrl+Y** | Redo changes |
| **Ctrl+K** | Copy to clipboard |
| **Ctrl+/** | Show all shortcuts |
| **Esc** | Close/cancel |

**Pro tip:** After clicking the magic button, you can:
1. Wait for draft to appear
2. Press `Ctrl+Enter` immediately
3. Done in **2 clicks + 1 keypress** ⚡

---

## 🎨 Visual Guide

### **Magic Button States**

**Idle:**
```
✨ Extract & Generate Draft
   One-click complete setup
```

**Loading:**
```
⏳ Working Magic...
   This will take ~6 seconds
```

**Disabled:**
```
[Gray, non-clickable]
```

---

### **Draft States**

**Read-only (default):**
```
Subject: [Locked, light gray background]
Body: [Locked, light gray background]
Edit icon: ✏️
```

**Editing:**
```
Subject: [White background, cursor]
Body: [White background, cursor]
Edit icon: 💾
Undo/Redo: Enabled (↶ ↷)
```

---

## 🧠 Smart Auto-Selection

The workflow automatically picks the best options for you:

### **Email Selection**
Chooses the highest confidence pattern:
```
✓ john.doe@company.com    [95% confidence] ← Auto-selected
  j.doe@company.com        [85%]
  john@company.com         [60%]
```

### **Template Selection**
Detects role and picks the right tone:

| Detected Role | Template Used | Tone |
|---------------|---------------|------|
| Recruiter @ Google | Recruiter | Formal, job-seeking |
| Engineer @ Startup | Referral | Friendly, networking |
| Manager @ Enterprise | Advice | Professional, curious |

---

## 🎯 What Gets Extracted?

The workflow grabs only **publicly visible** data:

✅ **Extracted:**
- First name & last name
- Current company
- Job title/role
- Headline
- Location
- Profile URL

❌ **NOT extracted:**
- Email address (we infer it)
- Phone number
- Private messages
- Connections
- Activity feed

**100% LinkedIn-safe** - only scrapes visible data

---

## 💾 Auto-Save

After you send an email, the contact is **automatically saved** to your database:

```
Recent Contacts
┌─────────────────────────────────┐
│ John Doe                         │
│ Acme Corp                        │
└─────────────────────────────────┘
```

Access all contacts in the web app:
```
http://localhost:3000/contacts
```

---

## 🔧 Troubleshooting

### **"Extraction failed"**
**Cause:** Not on a valid LinkedIn profile
**Fix:** Make sure URL is `linkedin.com/in/[username]`

### **"No email patterns found"**
**Cause:** Missing company name
**Fix:** Click edit (✏️) and add company manually

### **"Draft generation failed"**
**Cause:** API timeout or no template match
**Fix:** Workflow auto-falls back to default template

### **Keyboard shortcuts not working**
**Cause:** Focus is on input field
**Fix:** Click outside input first, then press shortcut

### **Gmail/Outlook not opening**
**Cause:** Popup blocker
**Fix:** Allow popups for the extension

---

## 📊 Expected Performance

| Metric | Value |
|--------|-------|
| Extraction time | ~2 seconds |
| Email inference | ~1 second |
| Draft generation | ~3 seconds |
| **Total time** | **~6 seconds** |
| Clicks required | **2-3** |
| Manual steps saved | **15+** |

---

## 🎉 Tips & Tricks

### **Tip 1: Use Templates**
The workflow picks the best template automatically, but you can customize templates in the settings.

### **Tip 2: Batch Processing**
Open multiple LinkedIn tabs, run magic workflow on each, then bulk send via Gmail.

### **Tip 3: Copy & Customize**
Use `Ctrl+K` to copy the draft, then paste into your email client for further customization.

### **Tip 4: Undo is Your Friend**
Made a mistake while editing? Press `Ctrl+Z` - all changes are tracked.

### **Tip 5: Keyboard-Only Workflow**
1. Click magic button (or `Ctrl+M`)
2. Wait for draft
3. Press `Ctrl+Enter`
4. Done! Never touch the mouse 🎯

---

## 🚀 Advanced Features

### **Draft History**
Every change you make is saved:
```
History:
1. Original draft (AI-generated)
2. Added greeting
3. Changed subject line
4. Fixed typo
```

Use `Ctrl+Z` to go back, `Ctrl+Y` to go forward.

### **Multi-Platform Send**
The same draft works for:
- Gmail (Ctrl+Enter)
- Outlook (click Outlook button)
- Copy to any platform (Ctrl+K)

### **Company Context**
Drafts are enhanced with company-specific details:
```
"I'm excited about Google's recent work in AI..."
"Meta's vision for the metaverse aligns with..."
```

---

## 📚 Need More Help?

- **Full Documentation:** `MAGIC_WORKFLOW_COMPLETE.md`
- **Test Guide:** `MAGIC_WORKFLOW_TEST_GUIDE.md`
- **Keyboard Shortcuts:** Press `Ctrl+/` in the extension
- **Web App:** http://localhost:3000

---

## ✨ That's It!

You're now ready to use the **Magic Workflow**. Go find someone amazing on LinkedIn and send them a message in under 10 seconds!

**Happy networking! 🎉**
