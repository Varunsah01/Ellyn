# Product Requirements Document (PRD)
## LinkedIn Email Finder Extension v2.0 - Premium Accuracy Pipeline

**Product:** Ellyn - Email Discovery Workspace  
**Feature:** LinkedIn Email Finder Chrome Extension  
**Owner:** Varun Sah  
**Status:** Approved for Development  
**Priority:** P0 (Core Revenue Feature)  
**Target Launch:** 6 weeks from kickoff  
**Last Updated:** February 13, 2026

---

## 1. Executive Summary

### 1.1 Problem Statement

Current email finding solutions have critical limitations:
- **Hunter.io/Apollo:** Expensive ($49-150/month), database-dependent, stale data
- **Free methods:** Low accuracy (70-85%), unreliable for user trust
- **Existing tools:** High LinkedIn ban risk, violate TOS aggressively

**Impact on Ellyn users:**
- 35% abandonment rate during email lookup phase
- Low conversion from Free â†’ Pro (18%)
- Support tickets: "Email finder doesn't work" (42% of volume)

### 1.2 Solution Overview

Build a **Chrome extension** with intelligent email extraction that achieves:
- âœ… **95-98% accuracy** through LLM-powered pattern prediction + API verification
- âœ… **$0.0012-0.0020 cost per lookup** (50-100Ã— cheaper than competitors)
- âœ… **Zero LinkedIn ban risk** through compliant DOM extraction
- âœ… **Progressive enhancement** (works partially even when APIs fail)
- âœ… **Self-improving cache** (costs decrease over time)

### 1.3 Success Criteria

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Email accuracy** | 72% | 95%+ | User-reported success rate |
| **Cost per lookup** | N/A | <$0.0025 | Backend analytics |
| **Cache hit rate** | 0% | 40%+ by Month 2 | Extension telemetry |
| **Pro conversion** | 18% | 35%+ | Funnel analysis |
| **Support tickets** | 42% volume | <10% volume | Zendesk data |
| **LinkedIn bans** | 0 (no feature) | 0 (maintain) | User reports |

### 1.4 Business Impact

**Revenue Projections (6 months post-launch):**
- Free users: 5,000 Ã— $0.04/month = -$200/month (acquisition cost)
- Pro users: 500 Ã— â‚¹349 = â‚¹174,500/month (~$2,100/month)
- Total costs: ~$700/month (API + infrastructure)
- **Net revenue: ~$1,400/month or $16,800/year**

**Strategic value:**
- Differentiated feature vs Hunter.io/Apollo
- Retention anchor (users rely on extension daily)
- Data moat (pattern cache improves over time)
- Upsell driver (Free â†’ Pro conversion)

---

## 2. Product Scope

### 2.1 In Scope

**Core Features:**
- âœ… LinkedIn profile data extraction (name, company, role)
- âœ… Smart domain resolution with fallback cascade
- âœ… LLM-powered email pattern prediction
- âœ… Multi-tier verification (MX, Abstract API)
- âœ… Pattern caching and learning
- âœ… Chrome extension UI with confidence indicators
- âœ… Save to Ellyn contacts
- âœ… Copy to clipboard
- âœ… Usage tracking and limits (Free: 25/month, Pro: 1,500/month)

**Technical Infrastructure:**
- âœ… Manifest V3 Chrome extension
- âœ… Service worker orchestration
- âœ… IndexedDB pattern cache
- âœ… Backend API endpoints (Next.js)
- âœ… Claude Haiku 3.5 integration
- âœ… Abstract API integration
- âœ… Supabase authentication & storage
- âœ… Analytics and cost monitoring

### 2.2 Out of Scope (v1)

- âŒ Bulk processing (remains manual, 1-at-a-time)
- âŒ LinkedIn automation (clicking, scrolling, messaging)
- âŒ Company profile extraction
- âŒ Email sending from extension
- âŒ Phone number extraction
- âŒ Firefox/Safari versions (Chrome only)
- âŒ Offline mode
- âŒ Email warmup/deliverability tracking

### 2.3 Future Considerations (v2+)

- ðŸ”® Pattern learning from user feedback ("This email worked")
- ðŸ”® Batch processing (upload CSV of LinkedIn URLs)
- ðŸ”® Direct integration with Ellyn drafting workflow
- ðŸ”® Company-level pattern detection
- ðŸ”® Alternative email finder (personal emails via WHOIS)
- ðŸ”® Chrome extension â†’ Firefox/Edge ports

---

## 3. User Personas & Use Cases

### 3.1 Primary Personas

**Persona 1: Active Job Seeker (85% of users)**
- **Name:** Priya, 28, Software Engineer
- **Goal:** Find hiring manager emails to get referrals
- **Pain:** Cold applications go to black hole
- **Usage:** 5-10 email lookups per day, wants high accuracy
- **Plan:** Starts Free, converts to Pro after seeing value

**Persona 2: Sales/BD Professional (10% of users)**
- **Name:** Rahul, 32, SaaS Sales
- **Goal:** Find decision-maker emails for outreach
- **Pain:** Paying $150/month for Apollo, wants cheaper alternative
- **Usage:** 30-50 lookups per day
- **Plan:** Direct to Pro

**Persona 3: Recruiter (5% of users)**
- **Name:** Sarah, 35, Tech Recruiter
- **Goal:** Find passive candidate emails
- **Pain:** LinkedIn InMail expensive, low response rate
- **Usage:** 10-20 lookups per day
- **Plan:** Pro from day 1

### 3.2 Core User Flows

#### **Flow 1: First-time user discovers email (Happy path)**

```
1. User installs extension from Chrome Web Store
2. Opens LinkedIn profile (e.g., hiring manager)
3. Clicks Ellyn extension icon in toolbar
4. Extension popup shows:
   - "Find Email" button
   - Remaining credits: 25/25 (Free plan)
5. Clicks "Find Email"
6. Loading state (2-3 seconds)
7. Results appear:
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ âœ“ Email Found (98% confidence)      â”‚
   â”‚                                      â”‚
   â”‚ john.doe@acme.com                   â”‚
   â”‚ [Copy] [Save to Contacts]           â”‚
   â”‚                                      â”‚
   â”‚ Pattern: first.last@domain.com      â”‚
   â”‚ Source: Verified via API             â”‚
   â”‚                                      â”‚
   â”‚ Credits remaining: 24/25             â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
8. User clicks "Copy"
9. Toast notification: "Copied to clipboard"
10. User pastes into email client
```

#### **Flow 2: Pattern cache hit (Instant result)**

```
1. User opens LinkedIn profile at same company (Acme Corp)
2. Clicks "Find Email"
3. Extension recognizes cached pattern for acme.com
4. Results appear INSTANTLY (<100ms):
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ âœ“ Email Found (95% confidence)      â”‚
   â”‚                                      â”‚
   â”‚ jane.smith@acme.com                 â”‚
   â”‚ [Copy] [Save to Contacts]           â”‚
   â”‚                                      â”‚
   â”‚ Pattern: first.last@domain.com      â”‚
   â”‚ Source: Cached pattern (verified)    â”‚
   â”‚                                      â”‚
   â”‚ Credits remaining: 23/25             â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
5. Note: Still counts toward quota (anti-abuse)
```

#### **Flow 3: Partial failure with graceful degradation**

```
1. User finds profile with unusual name/company
2. Clicks "Find Email"
3. LLM predicts patterns, Abstract API times out
4. Results show:
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ âš  Email Suggested (75% confidence)  â”‚
   â”‚                                      â”‚
   â”‚ maria.garcia@banco-santander.com    â”‚
   â”‚ [Copy] [Save to Contacts]           â”‚
   â”‚                                      â”‚
   â”‚ Alternative options:                 â”‚
   â”‚ â€¢ mgarcia@banco-santander.com       â”‚
   â”‚ â€¢ m.garcia@banco-santander.com      â”‚
   â”‚                                      â”‚
   â”‚ Note: Could not verify delivery.     â”‚
   â”‚ [Mark as Working] if you confirm it  â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### **Flow 4: Free tier limit reached (Conversion trigger)**

```
1. User attempts 26th lookup
2. Modal appears:
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚ ðŸš€ You've reached your Free limit   â”‚
   â”‚                                      â”‚
   â”‚ Great news! You've found 25 emails  â”‚
   â”‚ this month using Ellyn.             â”‚
   â”‚                                      â”‚
   â”‚ Upgrade to Pro for:                  â”‚
   â”‚ âœ“ 1,500 lookups/month               â”‚
   â”‚ âœ“ Unlimited AI drafts               â”‚
   â”‚ âœ“ Advanced tracking                  â”‚
   â”‚                                      â”‚
   â”‚ â‚¹349/month or $12/month             â”‚
   â”‚                                      â”‚
   â”‚ [Upgrade to Pro] [Maybe Later]      â”‚
   â”‚                                      â”‚
   â”‚ Resets on March 1, 2026             â”‚
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 4. Technical Architecture

### 4.1 System Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     CHROME EXTENSION                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                 â”‚
â”‚  â”‚   Content    â”‚â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚   Service    â”‚                 â”‚
â”‚  â”‚   Script     â”‚         â”‚   Worker     â”‚                 â”‚
â”‚  â”‚ (Extraction) â”‚         â”‚(Orchestrator)â”‚                 â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚
â”‚         â”‚                         â”‚                          â”‚
â”‚         â”‚                         â”‚                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”                 â”‚
â”‚  â”‚   Popup     â”‚         â”‚  IndexedDB   â”‚                 â”‚
â”‚  â”‚     UI      â”‚         â”‚    Cache     â”‚                 â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                 â”‚
â”‚                                  â”‚                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚
                                   â”‚ API Calls
                                   â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    BACKEND (Next.js)                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”            â”‚
â”‚  â”‚ /api/enrich     â”‚      â”‚ /api/verify-emailâ”‚            â”‚
â”‚  â”‚ (Main endpoint) â”‚      â”‚ (Abstract API)   â”‚            â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜            â”‚
â”‚           â”‚                         â”‚                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”              â”‚
â”‚  â”‚        Email Finder Pipeline            â”‚              â”‚
â”‚  â”‚  1. Domain Resolution (Clearbit)        â”‚              â”‚
â”‚  â”‚  2. LLM Prediction (Claude Haiku)       â”‚              â”‚
â”‚  â”‚  3. MX Verification (DNS)               â”‚              â”‚
â”‚  â”‚  4. Abstract Validation                  â”‚              â”‚
â”‚  â”‚  5. Cache Management                     â”‚              â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜              â”‚
â”‚           â”‚                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”               â”‚
â”‚  â”‚   Supabase      â”‚      â”‚  Analytics   â”‚               â”‚
â”‚  â”‚ (Auth + Store)  â”‚      â”‚  (Posthog)   â”‚               â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜               â”‚
â”‚                                                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                          â”‚
                          â”‚ External APIs
                          â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    EXTERNAL SERVICES                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚   Claude     â”‚  â”‚   Abstract   â”‚  â”‚    Clearbit     â”‚  â”‚
â”‚  â”‚   Haiku      â”‚  â”‚     API      â”‚  â”‚  Autocomplete   â”‚  â”‚
â”‚  â”‚($0.0002/call)â”‚  â”‚($0.001/check)â”‚  â”‚     (Free)      â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                        â”‚
â”‚  â”‚   Google     â”‚  â”‚  Brandfetch  â”‚                        â”‚
â”‚  â”‚   DNS/HTTPS  â”‚  â”‚     API      â”‚                        â”‚
â”‚  â”‚   (Free)     â”‚  â”‚   (Free)     â”‚                        â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 4.2 Component Specifications

#### **4.2.1 Content Script (LinkedIn Extraction)**

**File:** `content.js`  
**Injected on:** `https://www.linkedin.com/in/*`  
**Responsibility:** Extract profile data from LinkedIn DOM

**Extraction Strategy (Priority-based fallback):**

```javascript
// Strategy Pattern for resilient extraction
class LinkedInExtractor {
  
  async extractProfile() {
    return {
      name: await this.extractName(),
      company: await this.extractCompany(),
      role: await this.extractRole(),
      location: await this.extractLocation(),
      profileUrl: window.location.href
    };
  }
  
  // Priority 1: JSON-LD (Most stable - for SEO)
  extractFromJsonLd() {
    const script = document.querySelector('script[type="application/ld+json"]');
    if (!script) return null;
    
    try {
      const data = JSON.parse(script.textContent);
      if (data['@type'] === 'Person') {
        return {
          firstName: data.givenName,
          lastName: data.familyName,
          headline: data.jobTitle,
          url: data.url
        };
      }
    } catch (e) {
      console.warn('JSON-LD parse failed:', e);
    }
    return null;
  }
  
  // Priority 2: Open Graph meta tags
  extractFromOpenGraph() {
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const ogDescription = document.querySelector('meta[property="og:description"]')?.content;
    
    if (!ogTitle) return null;
    
    // Parse "John Doe - Software Engineer | LinkedIn"
    const [name, ...rest] = ogTitle.split(' - ');
    const headline = rest.join(' - ').replace(' | LinkedIn', '');
    
    return {
      fullName: name.trim(),
      headline: headline.trim()
    };
  }
  
  // Priority 3: Semantic HTML with ARIA
  extractFromDom() {
    // Name from h1
    const nameH1 = document.querySelector('h1.text-heading-xlarge')?.textContent?.trim();
    
    // Company from experience section
    const experienceSection = document.querySelector('#experience');
    let company = null;
    
    if (experienceSection) {
      // Find first "Current" position
      const currentRole = experienceSection.querySelector('[aria-label*="Current"]');
      if (currentRole) {
        company = currentRole.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim();
      }
    }
    
    return {
      fullName: nameH1,
      company: company
    };
  }
  
  // Orchestrate fallback chain
  async extractName() {
    // Try JSON-LD
    const jsonLd = this.extractFromJsonLd();
    if (jsonLd?.firstName && jsonLd?.lastName) {
      return {
        firstName: jsonLd.firstName,
        lastName: jsonLd.lastName,
        source: 'json-ld',
        confidence: 0.98
      };
    }
    
    // Try Open Graph
    const og = this.extractFromOpenGraph();
    if (og?.fullName) {
      const [firstName, ...lastNameParts] = og.fullName.split(' ');
      return {
        firstName,
        lastName: lastNameParts.join(' '),
        source: 'open-graph',
        confidence: 0.90
      };
    }
    
    // Fallback to DOM
    const dom = this.extractFromDom();
    if (dom?.fullName) {
      const [firstName, ...lastNameParts] = dom.fullName.split(' ');
      return {
        firstName,
        lastName: lastNameParts.join(' '),
        source: 'dom',
        confidence: 0.75
      };
    }
    
    throw new Error('Could not extract name from profile');
  }
  
  async extractCompany() {
    // Similar fallback chain for company
    // Priority: JSON-LD â†’ DOM experience section â†’ OG description
    // ...
  }
}
```

**Communication with Service Worker:**

```javascript
// content.js
chrome.runtime.sendMessage({
  type: 'EXTRACT_PROFILE',
  data: await extractor.extractProfile()
});

// Listen for results
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'EMAIL_FOUND') {
    showResultInPage(message.data);
  }
});
```

---

#### **4.2.2 Service Worker (Orchestrator)**

**File:** `background.js`  
**Responsibility:** Coordinate email finding pipeline

**Main Pipeline Logic:**

```javascript
class EmailFinderPipeline {
  
  async findEmail(profileData) {
    const { firstName, lastName, company } = profileData;
    
    // STAGE 0: Check cache
    const cached = await this.checkCache(company);
    if (cached) {
      return this.applyCachedPattern(firstName, lastName, cached);
    }
    
    // STAGE 1: Resolve domain
    const domain = await this.resolveDomain(company);
    if (!domain) {
      throw new Error('Could not resolve company domain');
    }
    
    // STAGE 2: Get LLM prediction
    const patterns = await this.getLlmPrediction({
      domain,
      company,
      role: profileData.role
    });
    
    // STAGE 3: Generate email candidates
    const candidates = this.generateEmails(firstName, lastName, domain, patterns);
    
    // STAGE 4: MX verification (free filter)
    const mxValid = await this.verifyMx(domain);
    if (!mxValid) {
      throw new Error('Domain cannot receive emails');
    }
    
    // STAGE 5: Abstract API verification
    
    // STAGE 6: Cache successful pattern
    if (verified.deliverable) {
      await this.cachePattern(domain, verified.pattern);
    }
    
    return verified;
  }
  
  async resolveDomain(companyName) {
    // Try known domains first
    const known = KNOWN_DOMAINS[companyName.toLowerCase()];
    if (known) return known;
    
    // Try Clearbit Autocomplete
    try {
      const response = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`
      );
      const data = await response.json();
      if (data.length > 0) {
        return data[0].domain;
      }
    } catch (e) {
      console.warn('Clearbit failed:', e);
    }
    
    // Fallback to heuristic
    return this.guessDomain(companyName);
  }
  
  async getLlmPrediction(context) {
    const response = await fetch('https://api.ellyn.app/api/predict-patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify(context)
    });
    
    return await response.json();
  }
  
    // Sort by LLM confidence
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    // Try top 2 patterns
    for (let i = 0; i < Math.min(2, candidates.length); i++) {
      const result = await this.callAbstractApi(candidates[i].email);
      
      if (result.deliverable && !result.isCatchAll) {
        return {
          email: candidates[i].email,
          pattern: candidates[i].pattern,
          confidence: 0.98,
          deliverable: true,
          source: 'abstract-verified'
        };
      }
    }
    
    // No verification success - return best guess
    return {
      email: candidates[0].email,
      pattern: candidates[0].pattern,
      confidence: 0.70,
      deliverable: 'unknown',
      source: 'llm-prediction'
    };
  }
  
  async cachePattern(domain, pattern) {
    await chrome.storage.local.set({
      [`pattern_${domain}`]: {
        pattern,
        confidence: 0.95,
        verified: true,
        timestamp: Date.now(),
        successCount: 1
      }
    });
  }
}
```

---

#### **4.2.3 Backend API Endpoints**

**File:** `app/api/predict-patterns/route.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: Request) {
  const { domain, company, role, industry } = await req.json();
  
  // Check rate limits
  const user = await getAuthenticatedUser(req);
  await checkRateLimit(user.id);
  
  // Estimate company size
  const estimatedSize = estimateCompanySize(company, domain);
  
  // Call Claude Haiku with prompt caching
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  const systemPrompt = `You are an email pattern prediction expert. Based on company information, predict the most likely email patterns used.

Common patterns by company size:
- Enterprise (5000+): first.last@domain.com (56%)
- Mid-market (200-1000): flast@domain.com (42%)
- Startup (1-50): first@domain.com (61%)

Consider:
- Company size and industry
- Domain TLD (.com vs .io vs country-specific)
- Role level (executives often have simpler patterns)
- Cultural context (US vs Europe vs Asia)

Return ONLY valid JSON with this exact structure:
{
  "patterns": [
    {"template": "first.last", "confidence": 0.85},
    {"template": "flast", "confidence": 0.12},
    {"template": "first", "confidence": 0.03}
  ],
  "reasoning": "Brief explanation"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-3.5-20241022',
    max_tokens: 300,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Domain: ${domain}
Company: ${company}
Size: ${estimatedSize}
Role: ${role || 'unknown'}
Industry: ${industry || 'unknown'}

Predict the top 3 email patterns for this company.`
      }
    ]
  });
  
  // Parse LLM response
  const content = message.content[0].text;
  const prediction = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
  
  // Track cost
  await trackApiCost({
    userId: user.id,
    service: 'anthropic',
    cost: calculateAnthropicCost(message.usage),
    metadata: { domain, company }
  });
  
  return Response.json(prediction);
}
```

**File:** `app/api/verify-email/route.ts`

```typescript
export async function POST(req: Request) {
  const { email } = await req.json();
  
  // Check rate limits & auth
  const user = await getAuthenticatedUser(req);
  await checkRateLimit(user.id);
  
  // Call Abstract API
  const response = await fetch(
  );
  
  const data = await response.json();
  
  // Track cost
  await trackApiCost({
    userId: user.id,
    service: 'abstract',
    cost: 0.001,
    metadata: { email, result: data.deliverability }
  });
  
  return Response.json({
    email,
    deliverable: data.deliverability === 'DELIVERABLE',
    isValidFormat: data.is_valid_format?.value,
    isCatchAll: data.is_catchall_email?.value,
    isFreeEmail: data.is_free_email?.value,
    smtpScore: data.quality_score
  });
}
```

---

#### **4.2.4 IndexedDB Cache Schema**

```javascript
// db.js - IndexedDB setup
const DB_NAME = 'ellyn_email_finder';
const DB_VERSION = 1;

const schema = {
  patterns: {
    keyPath: 'domain',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'confidence', keyPath: 'confidence' }
    ]
  },
  lookupHistory: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: [
      { name: 'domain', keyPath: 'domain' },
      { name: 'timestamp', keyPath: 'timestamp' }
    ]
  }
};

// Pattern cache entry structure
interface PatternCache {
  domain: string;              // Primary key
  pattern: string;             // e.g., "first.last"
  confidence: number;          // 0-1
  verified: boolean;           // Has been Abstract-verified
  verifiedBy: string;          // 'abstract_api' | 'user_feedback'
  successCount: number;        // Times successfully used
  failCount: number;           // Times reported as wrong
  timestamp: number;           // Last updated
  createdAt: number;           // First cached
  lastValidated: number;       // Last re-verified
}

// Lookup history entry
interface LookupHistory {
  id?: number;                 // Auto-increment
  profileUrl: string;
  domain: string;
  email: string;
  pattern: string;
  confidence: number;
  source: string;              // 'cache' | 'llm' | 'api'
  cost: number;                // USD
  timestamp: number;
  userFeedback?: 'worked' | 'failed';
}
```

---

#### **4.2.5 Extension Popup UI**

**File:** `popup.html` + `popup.jsx`

```jsx
function EmailFinderPopup() {
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [usage, setUsage] = useState({ used: 0, limit: 25 });
  
  const handleFindEmail = async () => {
    setState('loading');
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'FIND_EMAIL'
      });
      
      if (response.success) {
        setResult(response.data);
        setState('success');
        setUsage(prev => ({ ...prev, used: prev.used + 1 }));
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      setState('error');
      console.error(error);
    }
  };
  
  return (
    <div className="w-[400px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Ellyn Email Finder</h1>
        <Badge>{usage.used}/{usage.limit}</Badge>
      </div>
      
      {/* Main Content */}
      {state === 'idle' && (
        <Button onClick={handleFindEmail} className="w-full">
          Find Email
        </Button>
      )}
      
      {state === 'loading' && (
        <div className="flex flex-col items-center py-8">
          <Spinner />
          <p className="mt-2 text-sm text-gray-600">Finding email...</p>
        </div>
      )}
      
      {state === 'success' && (
        <div className="space-y-4">
          {/* Confidence Indicator */}
          <div className="flex items-center gap-2">
            {result.confidence > 0.9 ? (
              <CheckCircle className="text-green-600" />
            ) : (
              <AlertCircle className="text-yellow-600" />
            )}
            <span className="font-medium">
              {result.confidence > 0.9 ? 'Email Found' : 'Email Suggested'}
            </span>
            <span className="text-sm text-gray-600">
              ({Math.round(result.confidence * 100)}% confidence)
            </span>
          </div>
          
          {/* Email Display */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <code className="text-lg">{result.email}</code>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={() => navigator.clipboard.writeText(result.email)}
              className="flex-1"
            >
              Copy
            </Button>
            <Button 
              onClick={() => saveToContacts(result)}
              variant="outline"
              className="flex-1"
            >
              Save to Contacts
            </Button>
          </div>
          
          {/* Metadata */}
          <div className="text-xs text-gray-600 space-y-1">
            <div>Pattern: {result.pattern}</div>
            <div>Source: {result.source}</div>
            {result.alternativeEmails && (
              <details className="mt-2">
                <summary className="cursor-pointer">
                  Show alternatives ({result.alternativeEmails.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {result.alternativeEmails.map(alt => (
                    <li key={alt.email} className="flex justify-between">
                      <code>{alt.email}</code>
                      <span>{Math.round(alt.confidence * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          
          {/* Feedback */}
          <div className="border-t pt-3">
            <p className="text-xs text-gray-600 mb-2">Did this email work?</p>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => submitFeedback('worked')}
              >
                âœ“ Yes
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => submitFeedback('failed')}
              >
                âœ— No
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {state === 'error' && (
        <div className="text-center py-8">
          <p className="text-red-600">Could not find email</p>
          <Button onClick={() => setState('idle')} className="mt-4">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

### 4.3 Data Flow Diagram

```
USER ACTION: Clicks "Find Email"
    â”‚
    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 1. Content Script                        â”‚
â”‚    - Extract name from JSON-LD          â”‚
â”‚    - Extract company from DOM            â”‚
â”‚    - Extract role from headline          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚ chrome.runtime.sendMessage()
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 2. Service Worker                        â”‚
â”‚    - Validate extraction confidence      â”‚
â”‚    - Check IndexedDB cache               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â”œâ”€â”€â”€ Cache Hit? â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
             â”‚    YES                      â”‚
             â”‚                            â–¼
             â”‚                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
             â”‚                    â”‚ Return cachedâ”‚
             â”‚                    â”‚ pattern +    â”‚
             â”‚                    â”‚ generate     â”‚
             â”‚                    â”‚ email        â”‚
             â”‚                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚                            â”‚
             â”‚    NO                      â”‚
             â–¼                            â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ 3. Domain Resolution                    â”‚
â”‚    - Check known domains DB             â”‚
â”‚    - Call Clearbit Autocomplete         â”‚
â”‚    - Fallback to heuristic              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚ Domain: acme.com
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 4. Backend: LLM Prediction              â”‚
â”‚    POST /api/predict-patterns           â”‚
â”‚    - Call Claude Haiku                  â”‚
â”‚    - Get pattern predictions            â”‚
â”‚    Cost: $0.0002                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚ Patterns: [{first.last, 0.85}, ...]
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 5. Pattern Application                  â”‚
â”‚    - Generate emails from patterns      â”‚
â”‚    - john.doe@acme.com                  â”‚
â”‚    - jdoe@acme.com                      â”‚
â”‚    - john@acme.com                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 6. MX Verification (Google DNS)         â”‚
â”‚    - Verify domain has MX records       â”‚
â”‚    - Filter out invalid domains         â”‚
â”‚    Cost: $0                             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚ Valid: true
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 7. Backend: Abstract Verification       â”‚
â”‚    POST /api/verify-email               â”‚
â”‚    - Verify top 2 patterns              â”‚
â”‚    - Check deliverability               â”‚
â”‚    Cost: $0.001 per pattern             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚ john.doe@acme.com: DELIVERABLE
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 8. Cache Management                     â”‚
â”‚    - Store verified pattern             â”‚
â”‚    - Update success count               â”‚
â”‚    - Set confidence: 0.98               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 9. Analytics & Tracking                 â”‚
â”‚    - Log cost: $0.0012                  â”‚
â”‚    - Update user quota                  â”‚
â”‚    - Track success metrics              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
             â”‚
             â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 10. Return to Popup UI                  â”‚
â”‚     - Display email                     â”‚
â”‚     - Show confidence                   â”‚
â”‚     - Update credits                    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Sprint Goal:** Working extension with basic extraction and heuristic email generation

**Deliverables:**
- âœ… Chrome extension boilerplate (Manifest V3)
- âœ… LinkedIn content script with JSON-LD extraction
- âœ… Service worker with message passing
- âœ… Basic popup UI (React)
- âœ… Known domains database (100+ companies)
- âœ… Heuristic pattern generation
- âœ… IndexedDB cache setup
- âœ… Authentication flow (Supabase)

**Tasks:**
1. **Day 1-2:** Set up extension structure
   - Create manifest.json
   - Set up webpack build
   - Configure TypeScript
   
2. **Day 3-4:** LinkedIn extraction
   - Implement JSON-LD parser
   - Implement OG tag parser
   - Implement DOM fallback
   - Write tests for each method
   
3. **Day 5-7:** Service worker logic
   - Message passing system
   - Cache lookup logic
   - Known domains integration
   - Pattern generation (heuristic only)
   
4. **Day 8-10:** Popup UI
   - React component setup
   - Loading states
   - Result display
   - Copy to clipboard
   - Usage tracking display

**Success Criteria:**
- Can extract name from 90%+ LinkedIn profiles
- Can generate 3-5 email patterns
- Cache persists across sessions
- UI is responsive and intuitive

---

### Phase 2: LLM Integration (Week 3)

**Sprint Goal:** Add Claude Haiku for smart pattern prediction

**Deliverables:**
- âœ… Backend API endpoint for LLM
- âœ… Claude Haiku integration
- âœ… Prompt engineering & testing
- âœ… Cost tracking
- âœ… Error handling & fallbacks

**Tasks:**
1. **Day 1-2:** Backend setup
   - Create /api/predict-patterns endpoint
   - Set up Anthropic SDK
   - Implement authentication middleware
   - Add rate limiting
   
2. **Day 3-4:** Prompt engineering
   - Design system prompt
   - Test on 50+ companies
   - Optimize for accuracy
   - Implement prompt caching
   
3. **Day 5-7:** Integration
   - Connect service worker to API
   - Handle API failures gracefully
   - Add cost tracking to database
   - Display LLM confidence in UI

**Success Criteria:**
- LLM prediction accuracy: >80% vs known patterns
- API response time: <2 seconds p95
- Cost per prediction: <$0.0003
- Fallback to heuristics when API fails

---

### Phase 3: Verification Layer (Week 4)

**Sprint Goal:** Add Abstract API for email verification

**Deliverables:**
- âœ… Abstract API integration
- âœ… MX verification (Google DNS)
- âœ… Smart verification logic (top 2 patterns only)
- âœ… Confidence scoring algorithm
- âœ… Pattern caching on verification

**Tasks:**
1. **Day 1-2:** MX verification
   - Implement Google DNS-over-HTTPS
   - Add domain validation
   - Handle errors gracefully
   
2. **Day 3-5:** Abstract API
   - Create /api/verify-email endpoint
   - Implement verification loop
   - Add catch-all detection
   - Cost optimization (verify top 2 only)
   
3. **Day 6-7:** Confidence scoring
   - Design scoring algorithm
   - Weight LLM + verification + cache age
   - Display confidence in UI
   - Add alternative emails display

**Success Criteria:**
- Overall accuracy: >95%
- Average verifications per lookup: <2
- Cost per lookup: <$0.0025
- No false positives on catch-all domains

---

### Phase 4: Polish & Optimization (Week 5)

**Sprint Goal:** User experience improvements and performance optimization

**Deliverables:**
- âœ… Improved UI with better feedback
- âœ… Alternative emails display
- âœ… User feedback collection ("Did this work?")
- âœ… Usage limits enforcement
- âœ… Upgrade flow for Free â†’ Pro
- âœ… Analytics dashboard

**Tasks:**
1. **Day 1-2:** UI polish
   - Add loading animations
   - Improve error messages
   - Add tooltip explanations
   - Responsive design fixes
   
2. **Day 3-4:** User feedback loop
   - Add "Did this work?" buttons
   - Update cache confidence based on feedback
   - Implement pattern learning
   
3. **Day 5-7:** Limits & monetization
   - Enforce Free plan limit (25/month)
   - Enforce Pro plan limit (1,500/month)
   - Upgrade modal design
   - Stripe integration for Pro upgrade

**Success Criteria:**
- User feedback collection: >30% rate
- Free â†’ Pro conversion: >20%
- Support tickets: <5% of users
- Extension rating: >4.5 stars

---

### Phase 5: Testing & Launch Prep (Week 6)

**Sprint Goal:** Comprehensive testing and Chrome Web Store submission

**Deliverables:**
- âœ… End-to-end tests
- âœ… Performance benchmarks
- âœ… Security audit
- âœ… Chrome Web Store listing
- âœ… Documentation
- âœ… Launch marketing materials

**Tasks:**
1. **Day 1-2:** Testing
   - Test on 100+ LinkedIn profiles
   - Load testing on backend
   - Security review
   - Privacy compliance check
   
2. **Day 3-4:** Chrome Web Store
   - Create listing description
   - Screenshots and demo video
   - Privacy policy update
   - Submit for review
   
3. **Day 5-7:** Launch prep
   - Documentation for users
   - Support FAQ
   - Marketing emails
   - Product Hunt launch prep

**Success Criteria:**
- 100% pass rate on core user flows
- Chrome Web Store approval
- Documentation complete
- Marketing materials ready

---

## 6. API Integrations

### 6.1 Claude Haiku 3.5 (Anthropic)

**Purpose:** Email pattern prediction  
**Cost:** ~$0.0002 per call  
**Rate Limits:** 4,000 RPM (more than sufficient)  
**Implementation:**

```typescript
// lib/llm.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function predictEmailPatterns(context: {
  domain: string;
  company: string;
  role?: string;
  industry?: string;
}) {
  const systemPrompt = `...` // See section 4.2.3
  
  const message = await anthropic.messages.create({
    model: 'claude-haiku-3.5-20241022',
    max_tokens: 300,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [
      {
        role: 'user',
        content: `Domain: ${context.domain}
Company: ${context.company}
Role: ${context.role || 'unknown'}
Industry: ${context.industry || 'unknown'}

Predict the top 3 email patterns.`
      }
    ]
  });
  
  const content = message.content[0].text;
  return JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
}
```

**Error Handling:**
- Timeout (30s): Fall back to heuristic patterns
- Rate limit: Queue and retry
- Invalid JSON: Parse manually or use fallback
- API key invalid: Alert admin, use fallback

**Cost Optimization:**
- Use prompt caching (90% discount on system prompt)
- Only call once per domain (not per person)
- Cache LLM results in database

---

### 6.2 Abstract Email Validation API

**Purpose:** Email deliverability verification  
**Cost:** $0.001 per verification  
**Rate Limits:** 200 requests/second  
**Implementation:**

```typescript
// lib/email-verification.ts
export async function verifyEmail(email: string) {
  const response = await fetch(
    `&email=${encodeURIComponent(email)}`
  );
  
  if (!response.ok) {
    throw new Error(`Abstract API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    email,
    deliverable: data.deliverability === 'DELIVERABLE',
    isValidFormat: data.is_valid_format?.value ?? false,
    isCatchAll: data.is_catchall_email?.value ?? false,
    isFreeEmail: data.is_free_email?.value ?? false,
    isDisposable: data.is_disposable_email?.value ?? false,
    qualityScore: data.quality_score ?? 0,
    smtpProvider: data.smtp_provider ?? null
  };
}
```

**Response Interpretation:**
- `DELIVERABLE`: High confidence (0.98)
- `UNDELIVERABLE`: Skip this pattern
- `RISKY`: Medium confidence (0.60)
- `UNKNOWN`: Low confidence (0.40)

**Cost Optimization:**
- Only verify top 2-3 patterns (sorted by LLM confidence)
- Skip if catch-all detected
- Stop after first DELIVERABLE result

---

### 6.3 Clearbit Autocomplete API

**Purpose:** Company name â†’ domain resolution  
**Cost:** Free (no API key required)  
**Rate Limits:** ~60 req/min (undocumented)  
**Implementation:**

```typescript
// lib/domain-resolution.ts
export async function resolveDomain(companyName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`
    );
    
    const suggestions = await response.json();
    
    if (suggestions.length > 0) {
      return suggestions[0].domain;
    }
  } catch (error) {
    console.warn('Clearbit failed:', error);
  }
  
  return null;
}
```

**Fallback Strategy:**
1. Check known domains database
2. Try Clearbit Autocomplete
3. Try Brandfetch API (also free)
4. Heuristic guess (company-name.com)

---

### 6.4 Google DNS-over-HTTPS (MX Verification)

**Purpose:** Verify domain can receive email  
**Cost:** Free  
**Rate Limits:** None (public service)  
**Implementation:**

```typescript
// lib/mx-verification.ts
export async function verifyMxRecords(domain: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=MX`
    );
    
    const data = await response.json();
    
    // Check if MX records exist
    if (data.Answer && data.Answer.length > 0) {
      return true;
    }
  } catch (error) {
    console.warn('MX verification failed:', error);
  }
  
  return false;
}
```

**When to Use:**
- Before any paid API calls
- Eliminates typo domains instantly
- Detects defunct companies

---

## 7. User Limits & Quota Management

### 7.1 Plan Limits

| Feature | Free Plan | Pro Plan |
|---------|-----------|----------|
| **Email lookups** | 25/month | 1,500/month |
| **AI draft generation** | 15/month | Unlimited |
| **Contact storage** | 100 contacts | Unlimited |
| **Chrome sync** | Manual | Auto |
| **Support** | Community | Priority |

### 7.2 Quota Tracking

**Database Schema:**

```sql
CREATE TABLE user_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  plan_type VARCHAR(10) NOT NULL, -- 'free' or 'pro'
  email_lookups_used INT DEFAULT 0,
  email_lookups_limit INT NOT NULL,
  ai_drafts_used INT DEFAULT 0,
  ai_drafts_limit INT NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);
```

**Quota Check Logic:**

```typescript
// lib/quota.ts
export async function checkAndIncrementQuota(
  userId: string,
  quotaType: 'email_lookups' | 'ai_drafts'
) {
  const quota = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (!quota) {
    throw new Error('Quota not found');
  }
  
  // Check if period expired
  if (new Date() > new Date(quota.period_end)) {
    // Reset quota
    await resetQuota(userId);
    return { allowed: true, remaining: quota[`${quotaType}_limit`] - 1 };
  }
  
  // Check limit
  const used = quota[`${quotaType}_used`];
  const limit = quota[`${quotaType}_limit`];
  
  if (used >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetDate: quota.period_end
    };
  }
  
  // Increment usage
  await supabase
    .from('user_quotas')
    .update({
      [`${quotaType}_used`]: used + 1,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);
  
  return {
    allowed: true,
    remaining: limit - used - 1
  };
}
```

### 7.3 Soft Limits vs Hard Limits

**Hard Limits (Enforced):**
- Free: 25 email lookups/month
- Pro: 1,500 email lookups/month
- Both: Cannot exceed

**Soft Limits (Warning):**
- Free: Show "5 remaining" warning at 20 lookups
- Pro: Show "100 remaining" warning at 1,400 lookups

**Overage Handling:**
- Free: Show upgrade modal, block further lookups
- Pro: Alert user to contact support if legitimate high usage

---

## 8. Analytics & Monitoring

### 8.1 Key Metrics

**Product Metrics:**
- Email lookup success rate (target: >95%)
- Cache hit rate (target: >40% by Month 2)
- Average confidence score (target: >0.90)
- User feedback: "Email worked" rate (target: >90%)
- Free â†’ Pro conversion rate (target: >20%)

**Technical Metrics:**
- API response time (p50, p95, p99)
- Error rate by component
- Cost per lookup (target: <$0.0025)
- Cache storage size
- Extension crash rate

**Business Metrics:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Churn rate
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)

### 8.2 Tracking Implementation

**PostHog Events:**

```typescript
// Extension popup.tsx
posthog.capture('email_lookup_initiated', {
  source: 'popup',
  has_cached_pattern: false
});

posthog.capture('email_lookup_success', {
  confidence: 0.98,
  source: 'abstract_verified',
  pattern: 'first.last',
  cache_hit: false,
  cost_usd: 0.0012,
  time_ms: 2340
});

posthog.capture('email_lookup_failed', {
  reason: 'domain_not_found',
  company: 'Unknown Startup Inc'
});

posthog.capture('upgrade_modal_shown', {
  trigger: 'quota_exceeded',
  remaining_quota: 0
});
```

**Cost Tracking:**

```typescript
// Database table
CREATE TABLE api_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  service VARCHAR(50) NOT NULL, -- 'anthropic' | 'abstract'
  cost_usd DECIMAL(10, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

// Track cost
await supabase.from('api_costs').insert({
  user_id: userId,
  service: 'anthropic',
  cost_usd: 0.0002,
  metadata: {
    domain: 'acme.com',
    tokens: { input: 150, output: 80 }
  }
});
```

### 8.3 Dashboard

**Admin Dashboard (Internal):**
- Real-time cost burn rate
- Success rate by domain
- Cache effectiveness
- Top domains by lookup volume
- User feedback sentiment

**User-facing Analytics:**
- Total emails found this month
- Success rate
- Credits remaining
- Most common patterns in their searches

---

## 9. Privacy & Compliance

### 9.1 Data Collection

**What we collect:**
- âœ… Name extracted from LinkedIn (not stored)
- âœ… Company name (not stored)
- âœ… Generated email addresses (stored with user consent)
- âœ… Pattern cache (domain â†’ pattern mapping only)
- âœ… Usage analytics (anonymized)

**What we DON'T collect:**
- âŒ LinkedIn login credentials
- âŒ Full LinkedIn profile HTML
- âŒ Personal messages or InMail
- âŒ Connection lists
- âŒ Profile photos (beyond temporary display)

### 9.2 Chrome Web Store Compliance

**Required Disclosures:**

1. **Permission Justifications:**
   - `activeTab`: Read LinkedIn profile data when user clicks extension
   - `storage`: Save pattern cache and user preferences
   - `host: linkedin.com/*`: Extract profile information

2. **Privacy Policy Highlights:**
   - Data processing happens locally in extension
   - Only email patterns sent to our servers (not full profiles)
   - User can delete all data anytime
   - We don't sell or share data with third parties

3. **Data Usage:**
   - "This extension reads LinkedIn profile data to generate professional email addresses"
   - "Profile data is processed locally and not stored on our servers"

### 9.3 GDPR Compliance

**User Rights:**
- âœ… Right to access: Users can export their data
- âœ… Right to deletion: One-click data deletion
- âœ… Right to portability: Export as JSON
- âœ… Right to withdraw consent: Uninstall extension

**Implementation:**

```typescript
// app/api/user/export-data/route.ts
export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req);
  
  const data = {
    user_id: user.id,
    email_lookups: await getLookupHistory(user.id),
    pattern_cache: await getPatternCache(user.id),
    contacts: await getContacts(user.id),
    exported_at: new Date().toISOString()
  };
  
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="ellyn-data.json"'
    }
  });
}

// app/api/user/delete-data/route.ts
export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser(req);
  
  await Promise.all([
    supabase.from('user_quotas').delete().eq('user_id', user.id),
    supabase.from('api_costs').delete().eq('user_id', user.id),
    supabase.from('lookup_history').delete().eq('user_id', user.id),
    supabase.from('contacts').delete().eq('user_id', user.id)
  ]);
  
  return Response.json({ success: true });
}
```

### 9.4 LinkedIn TOS Compliance

**Risk Mitigation:**

âœ… **User-initiated only:** No automated scraping
âœ… **Visible data only:** No API calls to LinkedIn
âœ… **Structured data:** Using JSON-LD meant for search engines
âœ… **Rate limiting:** Free plan = 25/month max
âœ… **No automation:** No clicks, scrolls, or form fills
âœ… **Transparent:** Clear disclosure in Chrome Web Store

**From LinkedIn User Agreement (Section 8.2):**
> "You agree that you will not... scrape or copy profiles and information"

**Our interpretation:**
- We read structured data (JSON-LD) already in the DOM
- We don't "scrape" in the sense of bulk/automated collection
- We don't store LinkedIn profile data
- User explicitly triggers each lookup

**Legal precedent:** hiQ Labs v. LinkedIn (2022) - Public data scraping is legal under CFAA, but we're being more conservative by requiring user action.

---

## 10. Risk Management

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **LinkedIn changes DOM structure** | High | High | Multi-layer fallback (JSON-LD â†’ OG â†’ DOM) |
| **API outages (Claude/Abstract)** | Medium | Medium | Graceful degradation to heuristics |
| **Chrome extension rejected** | Low | High | Privacy-first design, clear disclosures |
| **Rate limiting issues** | Medium | Low | Caching, quota limits |
| **Cost overruns** | Low | Medium | Per-user cost caps, monitoring alerts |
| **Data breaches** | Low | High | Encrypt cache, no PII storage |

### 10.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Low Free â†’ Pro conversion** | Medium | High | A/B test upgrade prompts, improve value prop |
| **High API costs** | Medium | Medium | Smart caching, pattern learning |
| **Competitor launches similar** | High | Medium | First-mover advantage, superior UX |
| **LinkedIn bans extension** | Low | Critical | Conservative approach, no automation |
| **User backlash on pricing** | Low | Low | Free tier is generous (25/month) |

### 10.3 Contingency Plans

**If LinkedIn changes detection:**
1. Disable auto-extraction
2. Add manual input form
3. Notify users of temporary degradation
4. Emergency patch within 48 hours

**If API costs spike:**
1. Reduce free tier to 15/month
2. Increase Pro tier price
3. Add aggressive caching
4. Negotiate volume discounts with Abstract

**If Chrome rejects extension:**
1. Appeal with detailed explanation
2. Modify to remove any violating features
3. Prepare Firefox version as backup
4. Consider web-based alternative

---

## 11. Launch Plan

### 11.1 Beta Testing (Week 5-6)

**Recruit 50 beta testers:**
- 30 job seekers (primary persona)
- 10 sales professionals
- 10 recruiters

**Feedback focus:**
- Email accuracy (test on 10+ profiles each)
- UI intuitiveness
- Speed and performance
- Feature requests
- Willingness to pay for Pro

**Success criteria for launch:**
- >90% email accuracy
- <5% critical bug rate
- >4/5 average beta rating
- >30% say they'd upgrade to Pro

### 11.2 Soft Launch (Week 7)

**Limited release:**
- Existing Ellyn users only (~500 people)
- Email announcement
- In-app banner
- Monitor closely for issues

**Monitoring checklist:**
- API costs vs projections
- Error rates
- Support ticket volume
- User feedback

### 11.3 Public Launch (Week 8)

**Marketing channels:**
1. **Product Hunt launch**
   - Prepare demo video
   - Hunter vs Ellyn comparison
   - Founder story
   
2. **LinkedIn organic post**
   - "We built a LinkedIn email finder that respects your privacy"
   - Tag relevant communities
   
3. **Reddit AMAs**
   - r/jobs, r/sales, r/recruiting
   - "I built a free alternative to Hunter.io - AMA"
   
4. **Email to existing users**
   - "New feature: Find emails on LinkedIn"
   - Free credits for early adopters
   
5. **Chrome Web Store optimization**
   - SEO: "LinkedIn email finder"
   - Screenshots showing before/after
   - Video demo

**Launch day checklist:**
- [ ] All analytics tracking live
- [ ] Support email monitored 24/7
- [ ] Cost alerts configured
- [ ] Rollback plan ready
- [ ] Press kit prepared

### 11.4 Success Metrics (30 days post-launch)

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| **Installs** | 1,000 | 2,500 |
| **Daily Active Users** | 300 | 750 |
| **Email lookups** | 5,000 | 15,000 |
| **Free â†’ Pro conversion** | 20% | 35% |
| **Average rating** | 4.5/5 | 4.8/5 |
| **Support tickets** | <50 | <25 |
| **Net revenue** | $500 | $1,500 |

---

## 12. Support & Documentation

### 12.1 User Documentation

**In-app tooltips:**
- Confidence score explanation
- Pattern meaning
- Alternative emails usage

**Help center articles:**
1. How to install the extension
2. Understanding email confidence scores
3. What to do if email doesn't work
4. How pattern caching improves accuracy
5. Upgrading from Free to Pro
6. Privacy and data handling
7. Troubleshooting common issues

### 12.2 Developer Documentation

**README for extension:**
- Build instructions
- Development setup
- Testing procedures
- Deployment process

**API documentation:**
- Endpoint specifications
- Authentication
- Rate limits
- Error codes

### 12.3 Support Tiers

**Free Plan:**
- Community support (Discord/Reddit)
- Email response: 48-72 hours
- Help center self-service

**Pro Plan:**
- Priority email support
- Response: 12-24 hours
- Direct Slack channel (enterprise)

---

## 13. Future Roadmap (Post-v1)

### Q2 2026
- âœ… Pattern learning from user feedback
- âœ… Batch CSV upload (LinkedIn URLs â†’ emails)
- âœ… Firefox extension port
- âœ… Mobile app (React Native)

### Q3 2026
- âœ… Email warmup integration
- âœ… Direct CRM integrations (Salesforce, HubSpot)
- âœ… Company-level pattern detection
- âœ… LinkedIn Company page email finder

### Q4 2026
- âœ… Personal email finder (WHOIS, social media)
- âœ… Phone number extraction
- âœ… AI-powered email writing assistant
- âœ… Deliverability tracking

---

## 14. Appendix

### 14.1 Manifest V3 Configuration

```json
{
  "manifest_version": 3,
  "name": "Ellyn Email Finder",
  "version": "1.0.0",
  "description": "Find professional emails on LinkedIn with 95%+ accuracy",
  "permissions": [
    "activeTab",
    "storage",
    "unlimitedStorage"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://api.ellyn.app/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/in/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 14.2 Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
POSTHOG_API_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 14.3 Cost Projections Spreadsheet

| Month | Users | Avg Lookups/User | Total Lookups | LLM Cost | Abstract Cost | Total Cost | Revenue | Profit |
|-------|-------|------------------|---------------|----------|---------------|------------|---------|--------|
| 1 | 1000 | 15 | 15,000 | $42 | $405 | $447 | $0 | -$447 |
| 2 | 2000 | 18 | 36,000 | $72 | $540 | $612 | $1,200 | $588 |
| 3 | 3500 | 20 | 70,000 | $98 | $630 | $728 | $2,800 | $2,072 |
| 6 | 8000 | 22 | 176,000 | $176 | $792 | $968 | $9,600 | $8,632 |

**Assumptions:**
- 10% Free â†’ Pro conversion by Month 3
- Pro users do 50 lookups/month avg
- Cache hit rate: 40% by Month 3
- Average cost per lookup decreases over time

---

## 15. Sign-off & Approval

**Product Manager:** Varun Sah  
**Engineering Lead:** _____________  
**Design Lead:** _____________  
**Date:** _____________  

**Approved for Development:** [ ] Yes [ ] No

**Next Steps:**
1. Create tickets in project management system
2. Assign to engineering team
3. Schedule kickoff meeting
4. Begin Sprint 1 (Foundation)

---

**Document Version:** 1.0  
**Last Updated:** February 13, 2026  
**Status:** Ready for Review
