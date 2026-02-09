# Recruiter Outreach Template System

## Overview
The Ellyn extension now includes an intelligent template system that detects recruiters automatically and provides specialized outreach templates for different scenarios.

## Features

### 1. **Automatic Recruiter Detection**
- Detects if a LinkedIn contact is a recruiter/HR professional
- Identifies Big Tech companies (Google, Meta, Microsoft, etc.)
- Provides smart template recommendations based on role and company

### 2. **4 Template Types**

#### 👔 **To Recruiter**
- **Best for:** Reaching out to talent acquisition professionals
- **Tone:** Professional and direct
- **Focus:** Opportunities and application process

#### 🤝 **Referral Request**
- **Best for:** Fellow alumni or employees at target companies
- **Tone:** Friendly and collegial
- **Focus:** Requesting employee referral

#### 💬 **Seeking Advice**
- **Best for:** General networking and informational interviews
- **Tone:** Casual and curious
- **Focus:** Learning about company culture and career advice

#### ✨ **AI Generated**
- **Best for:** Custom messages tailored to specific situations
- **Tone:** Dynamic based on API response
- **Focus:** Fully personalized content

### 3. **Company-Specific Context**
Pre-loaded talking points for 15+ major tech companies:
- Google, Meta, Microsoft, Amazon, Apple
- Netflix, Uber, Airbnb, Stripe, Salesforce
- LinkedIn, Spotify, NVIDIA, and more

### 4. **Smart Recommendations**
Templates marked with ⭐ are automatically recommended based on contact role and company.

## Implementation Files

### New Files Created
1. **`extension/utils/role-detector.js`** - Recruiter detection and company classification
2. **`extension/utils/company-context.js`** - Company-specific talking points
3. **`extension/templates/recruiter-templates.js`** - Template generation system

### Modified Files
1. **`extension/sidepanel/sidepanel.html`** - Template selector UI
2. **`extension/sidepanel/sidepanel.js`** - Template integration logic
3. **`extension/sidepanel/sidepanel.css`** - Template styling
4. **`extension/utils/storage.js`** - User profile storage

## How It Works

### User Flow
1. Extract LinkedIn profile
2. System analyzes contact (recruiter? big tech?)
3. Template selector shows 4 options with recommendation ⭐
4. Select template → instant draft generation
5. Customize and copy to clipboard

### Example: Recruiter at Google
**Generated Draft:**
```
Subject: Interested in opportunities at Google

Hi Sarah,

I noticed you're a Technical Recruiter at Google. I'm currently exploring
opportunities in software engineering and would love to learn more about
open positions at Google.

I have experience in [your skills], and I'm particularly excited about
Google's mission to organize the world's information.

Would you be open to a brief chat about potential opportunities?

Best regards,
[Your Name]
[Your University] | [Your Role]
```

## Configuration

### User Profile Setup
Templates use these placeholders (customizable via storage):
- `userName`: Your full name
- `userSchool`: Your university
- `userRole`: Current role/status
- `userMajor`: Field of study
- `userGradYear`: Graduation year

### Adding Companies
Edit `company-context.js` to add more companies with custom talking points.

### Customizing Templates
Edit `recruiter-templates.js` to modify template text and structure.

## Future Enhancements
- Settings page for user profile
- Custom user templates
- Response rate tracking
- A/B testing for templates
- GPT-4 integration for AI template
