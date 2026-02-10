# Name Extraction Logic & Confidence Scoring

The `NameExtractor` utility uses a tiered strategy to identify the most likely profile name on a LinkedIn page.

## Confidence Levels

| Level | Range | Description | Source |
|-------|-------|-------------|--------|
| **High** | 90-100 | Extracted directly from primary profile headings (H1) using specific classes known to be reliable. | `dom` |
| **Medium** | 70-85 | Extracted from secondary headings or less specific H1s. Good, but higher risk of capturing noise. | `dom` |
| **Fallback** | 50-60 | Extracted from Meta tags (`og:title`) or `document.title`. These often contain suffixes like " \| LinkedIn" or notification counts, making them less reliable than direct DOM extraction. | `meta` / `fallback` |
| **None** | 0 | No valid name found. | `fallback` |

## Strategies

### 1. Primary DOM (High Confidence)
We prioritize specific H1 classes used by LinkedIn for profile names:
- `h1.text-heading-xlarge` (Confidence: 95)
- `.pv-text-details--left-aligned h1` (Confidence: 90)

### 2. Secondary DOM (Medium Confidence)
Fallback to other heading patterns if primary ones are missing:
- `h1.inline.t-24` (Confidence: 85)
- Generic `h1` (Confidence: 70)

### 3. Meta Tags (Fallback)
If no H1 is found (e.g., if the DOM structure has drastically changed), we check:
- `<meta property="og:title">` (Confidence: 60)
  - *Note:* We strip " \| LinkedIn" from the value.

### 4. Page Title (Last Resort)
- `document.title` (Confidence: 50)
  - *Note:* We strip notification counts like `(5)` and " \| LinkedIn".

## Resilience
- The extractor uses a `TreeWalker` to extract text from text nodes directly, avoiding hidden elements or nested garbage (like "Verified" badges) that might be inside the H1.
- It never throws errors; failures in one strategy simply proceed to the next.
