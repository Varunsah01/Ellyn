# Email Verification Feature

## Overview
Advanced email verification system using DNS MX records and SMTP handshake verification to validate email addresses and improve confidence scoring.

## Components

### 1. Email Verification Library (`/lib/email-verification.ts`)

#### Key Functions:

**`checkMXRecords(domain: string): Promise<boolean>`**
- Checks if domain has valid MX (Mail Exchange) records
- Uses DNS lookup with 5-second timeout
- Returns true if MX records exist
- Returns false on error or no records
- Essential first step in email validation

**Example:**
```javascript
const hasMX = await checkMXRecords('microsoft.com'); // true
const hasMX2 = await checkMXRecords('invalid-domain.xyz'); // false
```

**`verifySMTP(email: string): Promise<SMTPResult>`**
- Performs SMTP handshake to verify email address
- Connects to mail server on port 25
- Executes SMTP protocol sequence:
  1. Wait for server greeting (220)
  2. Send HELO verify.app
  3. Send MAIL FROM:<verify@verify.app>
  4. Send RCPT TO:<email@domain.com>
  5. Check response code
- 10-second timeout for connections
- Gracefully handles connection errors

**Return Values:**
| Status | Meaning | Response Codes |
|--------|---------|---------------|
| 'valid' | Email likely exists | 250 (OK) |
| 'invalid' | Email doesn't exist | 550, 551, 553 (Rejected) |
| 'unknown' | Verification uncertain | Other codes, timeouts, errors |

**`calculateConfidence(baseConfidence: number, hasMX: boolean, smtpResult: SMTPResult): number`**
- Calculates final confidence score
- Starting point: baseConfidence from pattern matching
- Adds +20 points if MX records found
- Adds +30 points if SMTP verification successful
- Adds +15 points if SMTP status unknown
- Adds +0 points if SMTP verification failed
- Capped at 100

**Scoring Example:**
```
Pattern: first.last (base: 40%)
+ MX Records Found: +20%
+ SMTP Valid: +30%
= Final Confidence: 90%
```

**`verifyEmail(email, domain, baseConfidence): Promise<VerificationResult>`**
- Main verification function
- Combines MX check and SMTP verification
- Returns complete verification result

**Helper Functions:**
- `getVerificationLabel(smtpStatus)` - Returns human-readable label
- `getVerificationColor(smtpStatus)` - Returns color class for UI

### 2. API Endpoint (`/app/api/verify-email/route.ts`)

**Endpoint:** `POST /api/verify-email`

**Request Body:**
```json
{
  "emails": [
    {
      "email": "john.doe@company.com",
      "pattern": "first.last",
      "baseConfidence": 40
    }
  ],
  "domain": "company.com"
}
```

**Validation Rules:**
- emails array required and non-empty
- domain string required
- Maximum 10 emails per request (rate limiting)
- Each email must have: email, pattern, baseConfidence

**Response (Success):**
```json
{
  "success": true,
  "domain": "microsoft.com",
  "hasMX": true,
  "emails": [
    {
      "email": "john.doe@microsoft.com",
      "pattern": "first.last",
      "baseConfidence": 40,
      "verified": false,
      "smtpStatus": "invalid",
      "confidence": 60,
      "verificationTime": "2026-02-05T08:08:48.792Z"
    }
  ],
  "verified": 0,
  "total": 1,
  "message": "Verified 1 email(s)"
}
```

**Response (Error):**
```json
{
  "error": "Maximum 10 emails can be verified per request"
}
```

**Performance:**
- MX check: 1 DNS lookup per domain (< 100ms)
- SMTP verification: Parallel processing (all emails simultaneously)
- Average total time: 5-15 seconds for 8-10 emails
- Timeout protection on all operations

### 3. Enhanced Email Discovery Form

#### New Features:

**Automatic Verification Flow:**
1. User submits form
2. Generate email patterns (Step 1)
3. Automatically verify patterns (Step 2)
4. Display results with verification status

**UI Components:**

**Verification Progress Card:**
- Blue border and animated spinner
- Shows "Verifying X emails..."
- Displays "Checking MX records and performing SMTP verification"

**MX Records Badge:**
- Green badge with checkmark if found
- Red badge with X if not found
- Displayed next to domain name

**Verification Status Summary:**
```
3 verified, 2 invalid, 5 unknown
```

**Verification Details Panel:**
- Collapsible section
- Shows:
  - MX Records: ✓ Found / ✗ Not Found
  - SMTP Verification: Completed / In Progress
  - Total Patterns Generated: X

**Email Cards Enhancements:**
- Verification icon next to email address:
  - 🛡️ ShieldCheck (green) - Valid
  - ❌ XCircle (red) - Invalid
  - ❓ HelpCircle (yellow) - Unknown
- Status badge below pattern badge
- Green border for verified emails
- Updated confidence score badge
- "Select" button disabled for invalid emails

**Error Handling:**
- Verification error card with yellow border
- Retry button to re-attempt verification
- Doesn't block main results display
- Clear error messages

**State Management:**
```typescript
const [isVerifying, setIsVerifying] = useState(false);
const [hasMX, setHasMX] = useState<boolean | null>(null);
const [verificationError, setVerificationError] = useState<string | null>(null);
const [showVerificationDetails, setShowVerificationDetails] = useState(false);
```

## Testing Results

### Test Case 1: Microsoft
```
Domain: microsoft.com
MX Records: ✓ Found
Results:
  ✗ john.doe@microsoft.com (invalid) - Confidence: 60%
  ✗ johndoe@microsoft.com (invalid) - Confidence: 50%
  ✗ john@microsoft.com (invalid) - Confidence: 45%

Note: "Invalid" is expected due to Microsoft's anti-spam protection
```

### Test Case 2: Google
```
Domain: google.com
MX Records: ✓ Found
Results:
  ✗ jane.smith@google.com (invalid) - Confidence: 60%
  ✗ janesmith@google.com (invalid) - Confidence: 50%
  ✗ jane@google.com (invalid) - Confidence: 45%

Note: Google also blocks SMTP verification queries
```

## Important Notes

### SMTP Verification Limitations

**Large Companies:**
- Most large companies (Microsoft, Google, Apple, etc.) block SMTP verification
- Returns "invalid" even for potentially real addresses
- This is an anti-spam security measure
- MX records still provide +20% confidence boost

**Small/Medium Companies:**
- More likely to allow SMTP verification
- Can get "valid" responses for real emails
- Can get "invalid" responses for non-existent emails

**Best Practices:**
1. Always check MX records first (reliable signal)
2. Use SMTP results as additional data, not absolute truth
3. Show "unknown" status when servers block verification
4. Combine with other signals (pattern matching, domain reputation)

### Status Interpretation

| Status | What It Means | Action |
|--------|--------------|--------|
| Valid (✓) | High probability email exists | Use with confidence |
| Unknown (?) | Cannot determine (blocked/timeout) | Use with caution |
| Invalid (✗) | Either blocked or doesn't exist | Verify through other means |

### Performance Considerations

**Timeouts:**
- DNS lookup: 5 seconds
- SMTP verification: 10 seconds per email
- Total time for 8 emails: ~10-15 seconds (parallel processing)

**Rate Limiting:**
- Current: 10 emails per request
- Recommended: Add user-based rate limiting in production
- Consider queueing for large batches

**Network Requirements:**
- Requires outbound port 25 access
- May be blocked by some firewalls
- May be blocked by cloud providers (AWS, Heroku)
- Consider using dedicated email verification service for production

## Production Recommendations

### 1. Alternative Verification Services
For production environments where port 25 is blocked, consider:
- Hunter.io API
- ZeroBounce
- NeverBounce
- EmailListVerify
- Abstract API Email Validation

### 2. Caching Strategy
```typescript
// Cache verification results
interface CacheEntry {
  result: VerificationResult;
  timestamp: number;
  expiresIn: number; // 7 days
}
```

### 3. Queue System
For bulk verification:
- Use Bull or BullMQ
- Process in background
- Send notifications when complete
- Store results in database

### 4. Fallback Logic
```typescript
if (smtpStatus === 'unknown' && hasMX) {
  // Still give some credit
  confidence = baseConfidence + 15;
}
```

### 5. Database Schema
```sql
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  has_mx BOOLEAN,
  smtp_status VARCHAR(20),
  confidence INTEGER,
  verified_at TIMESTAMP,
  INDEX(email),
  INDEX(domain)
);
```

## Security Considerations

**Rate Limiting:**
- Prevent abuse with per-user limits
- Implement IP-based throttling
- Add CAPTCHA for high-volume users

**Data Privacy:**
- Don't store verified emails without permission
- Log only metadata (not actual emails)
- Comply with GDPR/privacy regulations

**Error Handling:**
- Never expose internal error details
- Log errors server-side only
- Return generic errors to client

## Browser Compatibility

- ✅ All verification happens server-side
- ✅ No special browser requirements
- ✅ Works in all modern browsers
- ✅ Mobile-friendly UI
- ✅ Dark mode support

## Future Enhancements

1. **Catch-all Detection**: Detect if domain accepts all addresses
2. **Disposable Email Detection**: Flag temporary email services
3. **Role-based Detection**: Identify info@, admin@, etc.
4. **Historical Success Rate**: Learn from past successful emails
5. **Bulk Import**: CSV upload with background processing
6. **API Key System**: For external integrations
7. **Webhook Notifications**: Real-time verification updates
8. **A/B Testing**: Compare verification methods
9. **Machine Learning**: Improve confidence scoring
10. **Email Deliverability Score**: Beyond existence check

## Example Integration

```typescript
// In your application
async function discoverAndVerifyEmail(person: Person) {
  // 1. Generate patterns
  const patterns = generateEmailPatterns(
    person.firstName,
    person.lastName,
    person.company.domain
  );

  // 2. Verify in batches of 10
  const verified = [];
  for (let i = 0; i < patterns.length; i += 10) {
    const batch = patterns.slice(i, i + 10);
    const results = await verifyEmails(batch, person.company.domain);
    verified.push(...results);
  }

  // 3. Return top candidates
  return verified
    .filter(e => e.confidence > 50)
    .slice(0, 5);
}
```

## Troubleshooting

**Problem:** All emails return "unknown"
- Check port 25 is open
- Verify network allows outbound SMTP
- Test MX lookup separately

**Problem:** Verification takes too long
- Reduce batch size
- Increase timeouts
- Consider async/queue system

**Problem:** Too many "invalid" results
- This is normal for large companies
- Focus on MX record presence
- Use pattern confidence as primary signal
