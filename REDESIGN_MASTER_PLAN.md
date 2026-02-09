# Ellyn Redesign Master Plan

**Version:** 1.0
**Status:** Approved for Implementation
**Role:** Cross-Functional Product Team (Design, Research, Tech, Product)

---

## Phase 1: User Psychology & Strategy

### 1.1 The Job Seeker's Mindset
Users come to Ellyn in a state of **high-functioning anxiety**.
- **The Fear:** "If I don't send this, I won't get a job. If I send it and it's bad, I've burned a bridge."
- **The Fatigue:** Decision paralysis from rewriting the same sentence 20 times.
- **The Enemy:** "CRM" tools. They feel like work. They demand data entry. They emphasize *volume* (sales) over *connection* (human).

### 1.2 Industry Failure Analysis
Existing tools (Apollo, Outreach, etc.) fail job seekers because:
- **Dashboard Density:** Too many charts/numbers induce panic ("I'm behind on my quota").
- **Aggressive AI:** Generating full emails feels fake and erodes confidence.
- **Cold Aesthetics:** Stark white or dark "hacker" modes feel like enterprise software, not a personal workspace.

### 1.3 Ellyn UX Philosophy
1.  **Calm Over Clever:** No flashing notifications, no "gamification" badges. A quiet digital desk.
2.  **Writing-First:** The editor is the heart. Everything else supports the writing session.
3.  **Human-Scale:** We optimize for sending 5 great emails, not 500 spam emails.
4.  **Progressive Disclosure:** Advanced settings (follow-up intervals, templates) are hidden until explicitly requested.
5.  **Confidence Engineering:** Every interaction should reassure the user ("Draft saved", "Looks good", "Undo available").

---

## Phase 2: Information Architecture

### 2.1 Sitemap & Navigation
**Goal:** Flatten the hierarchy. Remove "Leads", "Prospects", "Campaigns" terminology.

**Sidebar (Left):**
1.  **Write** (Primary Action - Floating/Highlighted)
2.  **Drafts** (The workbench)
3.  **Sent** (History & Replies)
4.  **People** (Not "Contacts" or "Leads" - implies humanity)
5.  **Templates** (Personal library)

**Hidden / Secondary (Profile Menu):**
- Settings
- Analytics (Renamed to "Insights" - focused on reply rates, not volume)
- Billing

### 2.2 Naming Conventions
- ❌ Lead / Prospect -> ✅ Person
- ❌ Campaign -> ✅ Outreach
- ❌ Sequence -> ✅ Follow-up Plan
- ❌ Convert -> ✅ Connect

---

## Phase 3: Core Workflows

### 3.1 The "Monday Morning" Flow (Daily Work)
1.  **Land:** Dashboard is NOT a chart. It is a **"Focus List"**.
    - "Who needs a reply?" (High priority)
    - "Who needs a follow-up?" (Medium priority)
    - "Drafts in progress" (Low priority)
2.  **Action:** One click to open the editor for the top item.

### 3.2 The Writing Flow (The Heart)
1.  **Blank State:** Clean page. "To" field. "Subject" field. Large writing area.
2.  **Drafting:**
    - AI appears *only* on tab/request (e.g., "Help me start" or "Shorten this").
    - Autosave every keystroke with a subtle "Saved" indicator (no spinners).
3.  **Review:**
    - "Check Tone" button (optional).
    - "Preview" shows mobile view (crucial for execs reading on phones).
4.  **Send:**
    - "Send" -> "Undo" (10s buffer) -> "Sent".
    - Success state: "Email sent. Good luck!" (Supportive microcopy).

---

## Phase 4: Editor Design

**Visuals:**
- **Width:** 680px max-width for body text (optimal reading line length).
- **Typography:** Serif for headings (Fraunces), Clean Sans for body (DM Sans).
- **Line Height:** 1.6 (relaxed).
- **Background:** White paper on a soft gray desk (Light Mode).

**Toolbar:**
- **Placement:** Sticky bottom or floating selection bubble (Medium-style).
- **Items:** Bold, Italic, Link, Variable ({{Name}}), AI Assist.
- **Hidden:** Font family, excessive formatting.

**AI Rules:**
- AI suggestions appear in `Ghost Text` (grayed out).
- Press `Tab` to accept.
- `Esc` to dismiss.
- Never auto-rewrite user text without highlighting the change.

---

## Phase 5: Layout & Visual System

### 5.1 Light Theme (Primary - "The Day Desk")
- **Surface:** `#FAFAFA` (Off-white canvas)
- **Paper:** `#FFFFFF` (Pure white writing areas)
- **Text:** `#2D2B55` (Deep Purple - softer than black)
- **Border:** `#E2E2E8` (Warm gray)
- **Accent:** `#FF6B6B` (Coral - used sparingly for primary buttons)

### 5.2 Dark Theme (Secondary - "The Night Study")
- **Surface:** `#180B26` (Midnight Violet)
- **Paper:** `#231236` (Slightly lighter violet)
- **Text:** `#EAEAEA` (Soft white)
- **Border:** `#3B2052` (Muted violet)
- **Accent:** `#FF7A5C` (Sunset Coral - brighter for contrast)

---

## Phase 6: Brand & Design System

### 6.1 Colors (Inferred from Logo)
- **Primary Brand:** `Deep Purple` (#2D2B55) - Trust, Authority.
- **Primary Action:** `Coral` (#FF6B6B) - Warmth, Energy.
- **Secondary Action:** `Soft Gray` (#F5F5F7) - Calm, Structure.
- **Success:** `Sage Green` (#4B9C8E) - Not neon green.
- **Warning:** `Amber` (#F59E0B) - Subtle.

### 6.2 Typography
- **Headings:** `Fraunces` (Serif, variable weight).
    - Use for Page Titles, Modal Headers.
    - Emotional feel: Editorial, Premium.
- **Body:** `DM Sans` (Sans-serif).
    - Use for UI, inputs, long-form text.
    - Emotional feel: Clean, Modern, Legible.

### 6.3 Design Tokens

| Token | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#FAFAFA` | `#180B26` | Main window background |
| `--bg-card` | `#FFFFFF` | `#231236` | Content containers |
| `--text-primary` | `#2D2B55` | `#FAFAFA` | Main headings, body |
| `--text-secondary` | `#6B6982` | `#B0A1C2` | Labels, hints |
| `--border-subtle` | `#E2E2E8` | `#3B2052` | Dividers, inputs |
| `--accent-main` | `#FF6B6B` | `#FF7A5C` | Primary buttons |
| `--accent-hover` | `#E05263` | `#FF9E85` | Button hover state |

---

## Phase 7: Component Behavior

- **Inputs:**
    - Default: Gray border.
    - Focus: Deep Purple border (2px) + subtle shadow.
    - Error: Red border + descriptive text below.
- **Modals:**
    - Centered, generous padding (32px).
    - Backdrop blur (frosted glass).
    - "Click outside" always closes.
- **Buttons:**
    - Primary: Solid Coral, White text, rounded-lg.
    - Secondary: White background, Purple border.
    - Ghost: Text only, hover background.
- **Toasts:**
    - Bottom right.
    - Minimal text.
    - "Undo" action prominent.

---

## Phase 8: Accessibility & Comfort

- **Contrast:** All text must meet WCAG AA (4.5:1).
- **Focus States:** High-visibility rings (Purple/Coral) for keyboard nav.
- **Motion:**
    - `reduced-motion` respected.
    - Transitions: 200ms ease-out (snappy but smooth).
    - No layout shifts (CLS).
- **Hit Targets:** Minimum 44x44px for all clickable elements.

---

## Phase 9: Implementation Checklist

1.  [ ] **Theme Setup:** Update `tailwind.config.ts` and `app/globals.css` with new CSS variables.
2.  [ ] **Layout Refactor:** Update `DashboardLayout` to support the new sidebar and "Focus List" dashboard.
3.  [ ] **Sidebar Redesign:** Implement the flattened hierarchy (Write, Drafts, Sent, People).
4.  [ ] **Editor Polish:** Refactor `EmailEditor` to match the "clean notebook" aesthetic.
5.  [ ] **Typography Update:** Ensure `Fraunces` and `DM Sans` are correctly applied via Tailwind classes.
6.  [ ] **Component Library:** Update basic UI components (Button, Input, Card) to use new tokens.

---
**Signed,**
The Ellyn Product Team
