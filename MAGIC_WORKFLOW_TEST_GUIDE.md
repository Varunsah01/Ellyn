# 🧪 Magic Workflow Testing Guide

## Quick Test Checklist

### ✅ Pre-Test Setup
1. Load extension in Chrome (Developer Mode)
2. Navigate to any LinkedIn profile
3. Open extension sidebar (click extension icon)
4. Verify "LinkedIn Profile Detected" banner appears

---

## 🎯 Test Scenarios

### **Scenario 1: Happy Path - Recruiter at Big Tech**
**Profile:** Google Recruiter
**Expected Result:** Auto-selects "recruiter" template

**Steps:**
1. Visit: `linkedin.com/in/[google-recruiter]`
2. Click "✨ Extract & Generate Draft"
3. Wait for progress (5 steps, ~6 seconds)
4. Verify draft appears with:
   - Subject: Professional, mentions Google
   - Body: Formal, job-seeking tone
   - Word count: 80-120 words
5. Press `Ctrl+E` to edit
6. Verify subject/body become editable
7. Make a change (add a word)
8. Press `Ctrl+Z` to undo
9. Verify change reverts
10. Press `Ctrl+Enter`
11. Verify Gmail opens with draft

**✅ Pass Criteria:**
- All 5 progress steps show
- Draft is personalized (includes name, company)
- Keyboard shortcuts work
- Gmail compose opens correctly

---

### **Scenario 2: Non-Recruiter at Startup**
**Profile:** Software Engineer at a startup
**Expected Result:** Auto-selects "referral" or "advice" template

**Steps:**
1. Visit: `linkedin.com/in/[startup-engineer]`
2. Click magic button
3. Wait for completion
4. Verify template is networking-focused (not job-seeking)
5. Click copy button
6. Verify draft copied to clipboard
7. Paste and verify format: `Subject: ... \n\n Body: ...`

**✅ Pass Criteria:**
- Correct template selected
- Copy to clipboard works
- Format is clean

---

### **Scenario 3: Error Handling**
**Profile:** Empty/incomplete profile
**Expected Result:** Graceful error message

**Steps:**
1. Visit: `linkedin.com/in/[minimal-profile]`
2. Click magic button
3. If extraction fails, verify:
   - Clear error message shown
   - Button re-enables
   - UI resets to LinkedIn mode

**✅ Pass Criteria:**
- No crashes
- Clear error message
- UI resets properly

---

### **Scenario 4: Keyboard Shortcuts**
**Profile:** Any valid profile
**Expected Result:** All shortcuts work

**Steps:**
1. Complete magic workflow
2. Test each shortcut:

| Shortcut | Expected Action |
|----------|----------------|
| `Ctrl+E` | Toggle edit mode |
| `Ctrl+Z` | Undo last change (when editing) |
| `Ctrl+Y` | Redo (when editing) |
| `Ctrl+K` | Copy draft to clipboard |
| `Ctrl+Enter` | Open Gmail compose |
| `Ctrl+/` | Show shortcuts modal |
| `Esc` | Close modal |

**✅ Pass Criteria:**
- All shortcuts respond
- Visual feedback provided
- No console errors

---

### **Scenario 5: Edit History**
**Profile:** Any valid profile
**Expected Result:** Undo/redo works correctly

**Steps:**
1. Complete magic workflow
2. Click edit icon (✏️)
3. Make change #1: Add "Hello" to body
4. Make change #2: Add "World" to body
5. Make change #3: Add "!" to body
6. Press `Ctrl+Z` three times
7. Verify all changes undo in reverse order
8. Press `Ctrl+Y` three times
9. Verify all changes redo

**✅ Pass Criteria:**
- History preserves all changes
- Undo/redo buttons enable/disable correctly
- No data loss

---

### **Scenario 6: Multi-Platform Send**
**Profile:** Any valid profile
**Expected Result:** Both Gmail and Outlook work

**Steps:**
1. Complete magic workflow
2. Test Gmail:
   - Click "📧 Send via Gmail"
   - Verify: `mail.google.com/mail/?view=cm&...` opens
   - Check: To, Subject, Body populated
3. Go back to extension
4. Test Outlook:
   - Click "📧 Send via Outlook"
   - Verify: `outlook.office.com/mail/deeplink/compose?...` opens
   - Check: To, Subject, Body populated

**✅ Pass Criteria:**
- Both platforms open
- All fields populated
- Contact auto-saved

---

### **Scenario 7: Progress Indicators**
**Profile:** Any valid profile
**Expected Result:** Smooth visual feedback

**Steps:**
1. Click magic button
2. Observe each step:
   - Step 1/5: "Extracting profile..."
   - Step 2/5: "Finding best email..."
   - Step 3/5: "Detecting role type..."
   - Step 4/5: "Generating personalized draft..."
   - Step 5/5: "Draft ready!"
3. Verify:
   - Progress bar animates smoothly
   - Each step shows for at least 300ms
   - Total time: 5-8 seconds

**✅ Pass Criteria:**
- All steps display
- Progress bar reaches 100%
- Smooth transitions

---

### **Scenario 8: Auto-Save**
**Profile:** Any valid profile
**Expected Result:** Contact saved automatically

**Steps:**
1. Complete magic workflow
2. Click "Send via Gmail"
3. Wait for Gmail to open
4. Go back to extension
5. Scroll to "Recent Contacts"
6. Verify new contact appears

**✅ Pass Criteria:**
- Contact appears in recent list
- Name, company, email shown
- Recent list updates instantly

---

## 🐛 Known Edge Cases

### **Edge Case 1: No Company Name**
**Expected:** Uses email domain as fallback

### **Edge Case 2: No Role/Title**
**Expected:** Defaults to "advice" template

### **Edge Case 3: Special Characters in Name**
**Expected:** Properly escapes (O'Brien → O'Brien)

### **Edge Case 4: API Timeout**
**Expected:** Falls back to local email inference

### **Edge Case 5: Duplicate Emails**
**Expected:** Deduplicates, keeps highest confidence

---

## 📊 Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Extraction Time | < 2s | Time to complete Step 1 |
| Email Inference | < 1s | Time to complete Step 2 |
| Draft Generation | < 3s | Time to complete Step 4 |
| Total Workflow | < 8s | Click to draft ready |
| UI Responsiveness | < 100ms | Click to visual feedback |
| Memory Usage | < 50MB | Chrome Task Manager |

---

## 🎨 Visual Regression Checklist

### **Button States**
- [ ] Default: Gradient purple, sparkle animation
- [ ] Hover: Slight lift, shadow
- [ ] Active: Press down effect
- [ ] Disabled: Gray, no hover
- [ ] Loading: Hourglass icon, "Working Magic..."

### **Progress UI**
- [ ] Spinner: Rotates smoothly
- [ ] Progress bar: Fills left-to-right
- [ ] Text: Updates for each step
- [ ] Step counter: "Step X of 5"

### **Draft Preview**
- [ ] Subject: Bold, prominent
- [ ] Body: Clean, readable font
- [ ] Word count: Bottom left, gray
- [ ] Char count: Bottom left, gray
- [ ] Edit icon: Top right, hover effect

### **Undo/Redo Buttons**
- [ ] Disabled: Faded, no hover
- [ ] Enabled: Normal, hover effect
- [ ] Active: Click animation

### **Toast Notifications**
- [ ] Fade in: 0.3s smooth
- [ ] Stay: 3s
- [ ] Fade out: 0.3s smooth
- [ ] Position: Top-right, fixed

---

## 🚀 Quick Test Commands

### Run All Tests (Manual)
```
1. Visit 5 different LinkedIn profiles
2. Run magic workflow on each
3. Test all keyboard shortcuts
4. Test both send platforms
5. Verify auto-save
```

### Expected Total Time
- 5 profiles × 8s = 40s workflow time
- 5 min testing shortcuts/features
- **Total: ~6 minutes**

---

## ✅ Sign-Off Checklist

Before marking as complete:
- [ ] All 8 test scenarios pass
- [ ] All keyboard shortcuts work
- [ ] Both Gmail and Outlook send work
- [ ] Auto-save verified
- [ ] No console errors
- [ ] Performance benchmarks met
- [ ] Visual states all correct
- [ ] Error handling graceful
- [ ] Memory usage acceptable
- [ ] Works on Windows/Mac/Linux

---

## 📝 Bug Report Template

If you find issues, report with:

```markdown
**Bug:** [Short description]
**Severity:** [Critical/High/Medium/Low]
**Scenario:** [Test scenario number]
**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected:** [What should happen]
**Actual:** [What actually happened]
**Console Errors:** [Paste any errors]
**Screenshot:** [If applicable]
```

---

## 🎉 Success Criteria

The Magic Workflow is considered **100% complete** when:
1. ✅ All 8 test scenarios pass
2. ✅ All keyboard shortcuts work
3. ✅ Performance benchmarks met
4. ✅ Zero console errors
5. ✅ Visual polish complete
6. ✅ Documentation complete

**Status: READY FOR TESTING** ✨
