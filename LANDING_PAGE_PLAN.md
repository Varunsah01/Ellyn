# Ellyn Landing Page Redesign Plan

**Role:** Product Team (Design, Tech, Growth)
**Theme:** Light Theme (Primary)
**Goal:** Align marketing visuals with the new "Day Desk" app aesthetic.

---

## Step 1: Planning Phase

### 1. Landing Page Goals
1.  **De-escalate Anxiety:** The page must feel like a "deep breath." Job searching is stressful; Ellyn is the antidote.
2.  **Build Trust:** Use clean, professional visuals to show we aren't a "growth hack" tool but a legitimate career assistant.
3.  **Drive Action:** Clear path to "Write your first email" (the core value unit).

### 2. Information Architecture
1.  **Hero:** Value Prop + Trust. "Stop applying blindly. Start connecting."
2.  **The Problem (Empathy):** Acknowledging the "Black Hole" of job applications without fear-mongering.
3.  **The Solution (Clarity):** "A calm workspace to find emails and write to humans."
4.  **How It Works:** 3 Simple Steps (Find -> Draft -> Track).
5.  **Feature Highlights:** Focus on *Writing* and *Control*, not just data.
6.  **Trust/Social Proof:** "Used by candidates at [Company X, Y, Z]" (text-based for now).
7.  **Final CTA:** Reassurance. "Start for free. No credit card."
8.  **Footer:** Clean, minimal, navigation.

### 3. Messaging Strategy
-   **Tone:** Supportive, Quiet, Professional.
-   **Avoid:** "Blast," "Scale," "Mass outreach," "Hacks."
-   **Use:** "Connect," "Personalize," "Reach out," "Thoughtful."

---

## Step 2: Visual & UX Design Plan (Light Theme)

### Color System
-   **Background:** `#FAFAFA` (Off-white / Warm Gray). Matches the app's "Day Desk."
-   **Surface:** `#FFFFFF` (Pure White). Used for cards/features to create depth.
-   **Text Primary:** `#2D2B55` (Deep Purple). High contrast, softer than black.
-   **Text Secondary:** `#6B6982` (Muted Purple-Gray).
-   **Accent:** `#FF6B6B` (Coral). Used *only* for primary buttons and key highlights.
-   **Border:** `#E2E2E8` (Subtle Warm Gray).

### Typography
-   **Headings:** `Fraunces` (Serif). Adds the "Premium/Editorial" feel.
-   **Body:** `DM Sans`. Clean, readable, modern.
-   **Hierarchy:**
    -   H1: 4.5rem (Hero).
    -   H2: 3rem (Section headers).
    -   Body: 1.125rem (Large enough to be calm).

### Layout Principles
-   **Spacing:** Generous. 120px between sections.
-   **Width:** Max 1200px container.
-   **Rhythm:** Alternating text/visuals to reduce eye fatigue.
-   **Visuals:** Soft shadows (`shadow-sm`, `shadow-md`), rounded corners (`rounded-2xl`).

---

## Step 3: Implementation Strategy

### Components to Refactor
1.  **Navigation:** Switch from Dark/Transparent to Light/Blur. Logo -> `Ellyn_logo.png`.
2.  **Hero:** Remove dark background. Use `#FAFAFA`. Update typography to Deep Purple.
3.  **Features/HowItWorks:** Convert dark cards to White cards with soft borders.
4.  **Footer:** Switch from `bg-midnight-violet` to `bg-white` or `#F5F5F7`. Logo -> `Ellyn_logo.png`.

### Tech Stack
-   **Tailwind:** Use `bg-background` (mapped to light theme), `text-foreground`.
-   **Images:** Use the CDN logo for all branding.
-   **Responsive:** Stack vertically on mobile, keep padding generous.

---

**Status:** Plan Approved. Proceeding to Build.
