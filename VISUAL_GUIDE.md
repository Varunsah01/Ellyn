# Visual Guide: Recruiter Template System UI

## 🖼️ User Interface Flow

### Step 1: LinkedIn Profile Extraction
```
┌─────────────────────────────────────────┐
│ Ellyn                         ↻ Sync   │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ in  LinkedIn Profile Detected     │  │
│  │     Sarah Chen                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │     Extract Contact               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Extracts visible data only - 100%      │
│  LinkedIn safe                          │
└─────────────────────────────────────────┘
```

### Step 2: Extraction Results with Contact Card
```
┌─────────────────────────────────────────┐
│ Extracted Contact                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ ┌──┐                              │ │
│  │ │SC│ Sarah Chen                ✎ │ │
│  │ └──┘ Technical Recruiter          │ │
│  │      Google                       │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Step 3: Template Selector (NEW!)
```
┌─────────────────────────────────────────┐
│ Choose Outreach Type                    │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┬──────────────┐       │
│  │      👔      │      🤝      │       │
│  │              │              │       │
│  │ To Recruiter │   Referral   │       │
│  │   Request    │              │       │
│  │  ⭐ Selected │              │       │
│  │              │              │       │
│  │ Formal       │ Fellow alum/ │       │
│  │ referral     │ employee     │       │
│  │ request      │              │       │
│  └──────────────┴──────────────┘       │
│  ┌──────────────┬──────────────┐       │
│  │      💬      │      ✨      │       │
│  │              │              │       │
│  │   Seeking    │      AI      │       │
│  │    Advice    │  Generated   │       │
│  │              │              │       │
│  │ Informal     │ Personalized │       │
│  │ chat         │ AI draft     │       │
│  └──────────────┴──────────────┘       │
│                                         │
└─────────────────────────────────────────┘
```

### Step 4: Email Patterns
```
┌─────────────────────────────────────────┐
│ Email Patterns                          │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ sarah.chen@google.com           ✓ │ │
│  │ firstname.lastname  [90%]         │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ sarah@google.com                  │ │
│  │ firstname  [75%]                  │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Step 5: AI Draft Preview
```
┌─────────────────────────────────────────┐
│ AI Draft                                │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Subject: Interested in            │ │
│  │ opportunities at Google           │ │
│  │                                   │ │
│  │ Hi Sarah,                         │ │
│  │                                   │ │
│  │ I noticed you're a Technical      │ │
│  │ Recruiter at Google. I'm currently│ │
│  │ exploring opportunities in        │ │
│  │ software engineering and would    │ │
│  │ love to learn more about open     │ │
│  │ positions at Google.              │ │
│  │                                   │ │
│  │ I have experience in [brief       │ │
│  │ relevant skill/project], and I'm  │ │
│  │ particularly excited about        │ │
│  │ Google's mission to organize the  │ │
│  │ world's information.              │ │
│  │                                   │ │
│  │ Would you be open to a brief chat │ │
│  │ about potential opportunities or  │ │
│  │ advice on the application process?│ │
│  │                                   │ │
│  │ Best regards,                     │ │
│  │ [Your Name]                       │ │
│  │ [Your University] | [Your Role]   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌──────────────┐ ┌─────────────────┐ │
│  │  Copy Draft  │ │  Regenerate     │ │
│  └──────────────┘ └─────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Step 6: Action Buttons
```
┌─────────────────────────────────────────┐
│  ┌───────────────────────────────────┐ │
│  │         Save Contact              │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │       Open in Web App             │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🎨 Template Card States

### Default State
```
┌──────────────┐
│      👔      │
│              │
│ To Recruiter │
│              │
│ Formal       │
│ referral     │
│ request      │
└──────────────┘
```

### Hover State
```
┌──────────────┐  ← Blue border
│      👔      │  ← Slight lift
│              │
│ To Recruiter │
│              │
│ Formal       │
│ referral     │
│ request      │
└──────────────┘
```

### Selected State
```
┌──────────────┐  ← Blue background
│      👔      │  ← Blue border
│              │
│ To Recruiter │
│  ⭐ Selected │
│              │
│ Formal       │
│ referral     │
│ request      │
└──────────────┘
```

### Recommended State
```
┌──────────────┐
│ ⭐           │  ← Star badge
│      👔      │
│              │
│ To Recruiter │
│              │
│ Formal       │
│ referral     │
│ request      │
└──────────────┘
```

---

## 📱 Responsive Grid Layout

### 2x2 Grid
```
┌─────────────┬─────────────┐
│   Template  │  Template   │
│      1      │      2      │
├─────────────┼─────────────|
│   Template  │  Template   │
│      3      │      4      │
└─────────────┴─────────────┘
```

### Spacing
- Gap: 8px
- Padding: 12px per card
- Border radius: 8px
- Border: 2px solid

---

## 🎯 Detection Indicators

### Recruiter Detected
```
Contact: Sarah Chen
Role: Technical Recruiter
Company: Google

Detection Result:
✓ Is Recruiter: YES
✓ Big Tech: YES
⭐ Recommended: "To Recruiter"
```

### Employee Detected
```
Contact: Alex Kim
Role: Software Engineer
Company: Meta

Detection Result:
✗ Is Recruiter: NO
✓ Big Tech: YES
⭐ Recommended: "Referral Request"
```

### General Contact
```
Contact: Mike Johnson
Role: CTO
Company: TechStartup

Detection Result:
✗ Is Recruiter: NO
✗ Big Tech: NO
⭐ Recommended: "Seeking Advice"
```

---

## 🖌️ Color Scheme

### Template Cards
- **Default:** White background, gray border (#e5e7eb)
- **Hover:** Light blue background (#f0f9ff), blue border (#3b82f6)
- **Selected:** Blue background (#eff6ff), blue border + shadow

### Confidence Badges
- **High (70%+):** Green (#dcfce7, #166534)
- **Medium (50-69%):** Yellow (#fef3c7, #92400e)
- **Low (<50%):** Gray (#f3f4f6, #4b5563)

### Icons
- Font size: 24px
- Spacing: 2px margin-bottom

---

## 🔄 Interaction Flow

```
User Action                 System Response
───────────                ─────────────────

1. Click Template Card  →  Card highlights (blue)
                        →  Other cards deselect
                        →  Draft regenerates

2. Click Regenerate     →  New draft appears
                        →  Same template used

3. Click Copy Draft     →  Copies to clipboard
                        →  Button shows "Copied!"
                        →  Returns to "Copy Draft" after 2s

4. Click Save Contact   →  Saves to database
                        →  Button shows "Saving..."
                        →  Shows "Saved!" when complete
```

---

## 📐 Dimensions

### Template Selector Section
- Width: 100% of container
- Max-width: 400px
- Margin-bottom: 16px

### Template Card
- Min-height: 120px
- Padding: 12px 8px
- Text-align: center
- Flex direction: column

### Grid
- Columns: 2 (1fr 1fr)
- Gap: 8px
- Display: grid

---

## 🎭 Animation Details

### Hover Effect
```css
transition: all 0.2s;
transform: translateY(-1px);
border-color: #3b82f6;
background: #f0f9ff;
```

### Selection
```css
border-color: #3b82f6;
background: #eff6ff;
box-shadow: 0 0 0 1px #3b82f6;
```

### Loading State
```css
.draft-loading {
  text-align: center;
  color: #9ca3af;
  padding: 16px 0;
}
```

---

## 💡 User Feedback Visual Cues

### Success States
- ✅ Green background flash
- ✓ Checkmark icon
- "Saved!" text

### Loading States
- 🔄 Spinner animation
- "Generating..." text
- Disabled buttons

### Error States
- ❌ Red text
- Alert modal
- Error message display

---

## 📊 Before/After Comparison

### Before (Generic)
```
┌─────────────────────────────────┐
│ AI Draft                        │
├─────────────────────────────────┤
│ Hi there,                       │
│                                 │
│ I came across your profile and  │
│ was impressed. Would you be     │
│ open to a chat?                 │
│                                 │
│ Best regards                    │
└─────────────────────────────────┘
```

### After (Specialized)
```
┌─────────────────────────────────┐
│ Choose Outreach Type            │
│ ┌────────┬────────┐             │
│ │👔 Rec. │🤝 Ref. │             │
│ │  ⭐    │        │             │
│ └────────┴────────┘             │
├─────────────────────────────────┤
│ AI Draft                        │
├─────────────────────────────────┤
│ Subject: Interested in          │
│ opportunities at Google         │
│                                 │
│ Hi Sarah,                       │
│                                 │
│ I noticed you're a Technical    │
│ Recruiter at Google. I'm        │
│ exploring opportunities in      │
│ software engineering...         │
│                                 │
│ I'm particularly excited about  │
│ Google's mission to organize    │
│ the world's information.        │
│                                 │
│ Best regards,                   │
│ Jane Smith                      │
│ Stanford | CS '25               │
└─────────────────────────────────┘
```

**Improvement:**
- ✅ Specific role acknowledgment
- ✅ Company-specific talking point
- ✅ Professional signature
- ✅ Clear subject line
- ✅ Personalized with user info

---

## 🎯 Final Result

A beautiful, intuitive template selector that:
- Appears automatically after profile extraction
- Shows 4 clear options with icons and descriptions
- Highlights the recommended choice with ⭐
- Generates instant, personalized drafts
- Includes company-specific context
- Provides professional formatting

**User Delight:** "Wow, it knew they were a recruiter and gave me the perfect template!"
