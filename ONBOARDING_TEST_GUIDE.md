# Onboarding System - Testing Guide

## Quick Start Testing

### Prerequisites
1. Load extension in Chrome (`chrome://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` folder
4. Open the side panel (click extension icon)

---

## Test Scenarios

### 🎯 Scenario 1: First-Time User Experience

**Steps:**
1. Clear extension storage:
   ```javascript
   // In DevTools console (sidepanel context)
   chrome.storage.local.clear();
   ```
2. Reload the sidepanel
3. **Expected:** Welcome screen appears with purple gradient
4. Click "🚀 Take the Tour"
5. **Expected:** Tour starts with overlay + tooltip on Magic Extract button
6. Click "Next" through all 5 steps
7. **Expected:** Tour completes, success toast appears
8. **Expected:** Checklist appears with 5 items

**Validation:**
- ✅ Welcome screen shows on first load only
- ✅ Tour overlay is dark and blurred
- ✅ Target elements have spotlight effect
- ✅ Tooltips position correctly
- ✅ Progress indicator shows "1 of 5", "2 of 5", etc.
- ✅ Success toast animates in smoothly
- ✅ Checklist appears after tour completion

---

### 📋 Scenario 2: Progress Checklist

**Steps:**
1. Complete the tour (if not done)
2. **Check Item 1:** Already completed (Install extension)
3. Visit a LinkedIn profile: `https://linkedin.com/in/any-profile`
4. **Expected:** ✓ "Visit a LinkedIn profile" checkmark + celebration toast
5. Click "Extract & Generate Draft" button
6. **Expected:** ✓ "Extract contact data" checkmark
7. **Expected:** ✓ "Generate email draft" checkmark
8. Click "Send via Gmail"
9. **Expected:** ✓ "Send your first email" checkmark
10. **Expected:** Completion modal with "You're a Pro! 🎉"

**Validation:**
- ✅ Each milestone triggers celebration toast
- ✅ Progress bar updates (0% → 100%)
- ✅ Completed items turn green
- ✅ Check icons animate in
- ✅ Final modal shows stats
- ✅ Checklist hides after completion

---

### 📭 Scenario 3: Empty States

**Test Empty Queue:**
1. Clear all contacts from queue
2. **Expected:** Shows empty queue state with:
   - 📭 Icon
   - "No contacts in queue" message
   - "🔍 Find People on LinkedIn" button
   - "✨ Try with Sample Data" button

**Test Empty Drafts:**
1. Click "📋 View Drafts" button
2. With no drafts generated
3. **Expected:** Shows empty drafts state with:
   - 📝 Icon
   - "No drafts ready" message
   - "← Back to Queue" button
   - "✨ Try Sample Workflow" button

**Test Not on LinkedIn:**
1. Visit any non-LinkedIn page (e.g., `google.com`)
2. **Expected:** Shows prompt:
   - 🔗 Icon
   - "Visit a LinkedIn Profile" message
   - "Open LinkedIn" button
   - Example URL shown

**Validation:**
- ✅ Correct empty state for each context
- ✅ All CTAs are clickable
- ✅ Icons and messages display correctly
- ✅ Buttons have hover states

---

### ✨ Scenario 4: Sample Data Tutorial

**Steps:**
1. Click "✨ Try with Sample Data" button (from empty state)
2. **Expected:** Modal appears with sample contact card
   - Avatar: "SJ"
   - Name: "Sarah Johnson"
   - Role: "Senior Recruiter"
   - Company: "Google"
3. Click "✨ Try Sample Workflow"
4. **Expected:**
   - Modal closes
   - "Running sample workflow..." toast
   - Contact added to queue with draft
   - Drafts view opens automatically
   - Success toast: "✓ Sample draft generated!"

**Validation:**
- ✅ Modal displays correctly
- ✅ Sample data is realistic
- ✅ Workflow completes end-to-end
- ✅ Draft is visible in drafts view
- ✅ Toast notifications appear

---

### 💡 Scenario 5: Contextual Help

**Test LinkedIn Visit Help:**
1. On LinkedIn profile page
2. Without extracting yet
3. **Expected:** Help tooltip appears bottom-right:
   - 👆 Icon
   - "Click 'Extract & Generate Draft' to get started"
   - Can click to scroll to button

**Test First Send Help:**
1. After generating first draft
2. **Expected:** Help tooltip:
   - 📧 Icon
   - "Review your draft, then click 'Send via Gmail'"

**Test First Success:**
1. After sending first email
2. **Expected:** Celebration help:
   - 🎉 Icon
   - "First email sent! You're on your way."
   - Green gradient background
   - Auto-hides after 5 seconds

**Validation:**
- ✅ Help appears at right time
- ✅ Correct icon and message
- ✅ Smooth slide-in animation
- ✅ Close button works
- ✅ Auto-hides appropriately

---

### ⌨️ Scenario 6: Keyboard Shortcuts

**Test Help Menu:**
1. Press `?` key anywhere in sidepanel
2. **Expected:** Shortcuts modal appears with overlay
3. **Expected:** Shows all shortcuts:
   - `Ctrl+Enter` → Send email
   - `Ctrl+E` → Edit draft
   - `Ctrl+Z` / `Ctrl+Y` → Undo/Redo
   - `Ctrl+/` → Show all shortcuts
4. Click overlay or X to close
5. **Expected:** Modal disappears

**Test Send Shortcut:**
1. With draft visible
2. Press `Ctrl+Enter`
3. **Expected:** Opens Gmail with pre-filled email

**Test Edit Shortcut:**
1. With draft visible
2. Press `Ctrl+E`
3. **Expected:** Enables inline editing

**Validation:**
- ✅ Modal displays all shortcuts
- ✅ Keyboard styling is clear
- ✅ Shortcuts actually work
- ✅ Close button and overlay work

---

### 🎨 Scenario 7: Visual Polish

**Check Animations:**
- [ ] Welcome screen logo pulses
- [ ] Tour tooltips slide in
- [ ] Spotlight effect pulses on target
- [ ] Checklist slides up when shown
- [ ] Checkmarks bounce when completed
- [ ] Progress bar smoothly fills
- [ ] Toasts slide in from bottom-right
- [ ] Modals fade in with overlay
- [ ] Buttons have hover effects
- [ ] Empty state icons are visible

**Check Responsiveness:**
- [ ] Tooltips stay on screen (don't overflow)
- [ ] Modals are centered
- [ ] Text is readable
- [ ] Buttons are touch-friendly
- [ ] Scroll works in long lists

---

## 🐛 Common Issues & Fixes

### Tour Doesn't Start
**Problem:** Welcome screen doesn't show
**Fix:** Clear storage and reload:
```javascript
chrome.storage.local.clear();
location.reload();
```

### Checklist Not Updating
**Problem:** Milestones don't check off
**Fix:** Verify `trackOnboardingProgress()` is called:
```javascript
// Check in sidepanel.js
await trackOnboardingProgress('extract');  // After extraction
await trackOnboardingProgress('generate'); // After generation
await trackOnboardingProgress('send');     // After send
```

### Empty States Not Showing
**Problem:** Blank screen instead of empty state
**Fix:** Ensure `updateQueueEmptyState()` is called in `sidepanel.js`

### Tooltips Position Wrong
**Problem:** Tooltips appear off-screen
**Fix:** Check `positionTooltip()` logic in `tour.js`:
- Should keep within viewport bounds
- Should have proper offsets (20px)

### Keyboard Shortcuts Don't Work
**Problem:** Pressing keys does nothing
**Fix:** Verify `keyboard-shortcuts.js` is loaded in HTML:
```html
<script src="../utils/keyboard-shortcuts.js"></script>
```

---

## ✅ Complete Test Checklist

**Interactive Tour:**
- [ ] Welcome screen appears on first launch
- [ ] Tour covers all 5 steps
- [ ] Overlay and spotlight work
- [ ] Tooltips position correctly
- [ ] Navigation (Next/Back/Skip) works
- [ ] Success toast on completion

**Progress Checklist:**
- [ ] Shows after tour completion
- [ ] Tracks all 5 milestones
- [ ] Celebration toasts appear
- [ ] Progress bar updates
- [ ] Completion modal shows
- [ ] Hides after 100% complete

**Empty States:**
- [ ] Empty queue state
- [ ] Empty drafts state
- [ ] Not on LinkedIn state
- [ ] No API key state
- [ ] Sample data tutorial works
- [ ] All CTAs functional

**Contextual Help:**
- [ ] Appears at right times
- [ ] Correct messages
- [ ] Smooth animations
- [ ] Close button works
- [ ] Auto-hide timing

**Keyboard Shortcuts:**
- [ ] Help modal (?)
- [ ] Send (Ctrl+Enter)
- [ ] Edit (Ctrl+E)
- [ ] Undo/Redo (Ctrl+Z/Y)
- [ ] Shortcuts modal (Ctrl+/)

**Visual Polish:**
- [ ] All animations smooth
- [ ] Colors match design
- [ ] Hover states work
- [ ] No layout shifts
- [ ] Readable text

---

## 🎯 Success Criteria

**The onboarding system is working if:**

1. ✅ First-time user sees welcome screen
2. ✅ Tour guides through all features
3. ✅ Checklist tracks progress accurately
4. ✅ Empty states provide clear guidance
5. ✅ Contextual help appears at right moments
6. ✅ Keyboard shortcuts are discoverable
7. ✅ All animations are smooth
8. ✅ User can complete first extraction in < 60 seconds

**If all checkboxes are ✅, the system is production-ready! 🚀**

---

## 📊 Test Results Template

```
Date: _____________
Tester: _____________

Scenario 1 (First-Time): ___/7 passed
Scenario 2 (Checklist):  ___/6 passed
Scenario 3 (Empty):      ___/4 passed
Scenario 4 (Sample):     ___/5 passed
Scenario 5 (Help):       ___/5 passed
Scenario 6 (Keyboard):   ___/4 passed
Scenario 7 (Visual):     ___/10 passed

Total: ___/41 tests passed

Issues Found:
1. _______________
2. _______________
3. _______________

Overall Status: [ ] Pass [ ] Fail
```

---

## 🔧 Developer Tools

**Useful Console Commands:**

```javascript
// Reset onboarding completely
await chrome.storage.local.remove(['hasSeenTour', 'checklistProgress', 'hasExtracted', 'hasGenerated', 'hasSent', 'sentCount']);

// Check onboarding state
const state = await chrome.storage.local.get(['hasSeenTour', 'checklistProgress']);
console.log(state);

// Trigger tour manually
await onboardingTour.restart();

// Show checklist
await onboardingChecklist.show();

// Test contextual help
const context = await EmptyStates.detectContext();
EmptyStates.showContextualHelp(context);

// Simulate progress
await trackOnboardingProgress('extract');
await trackOnboardingProgress('generate');
await trackOnboardingProgress('send');
```

Happy Testing! 🧪✨
