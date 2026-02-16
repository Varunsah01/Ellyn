# Cost Breakdown

This system targets low-cost generation using Gemini Flash models.

## Model Pricing Used in Code

From `lib/gemini.ts`:

- `gemini-2.0-flash-exp`
  - Input: `$0.00001875 / 1K tokens`
  - Output: `$0.000075 / 1K tokens`

- `gemini-1.5-flash`
  - Input: `$0.000075 / 1K tokens`
  - Output: `$0.0003 / 1K tokens`

Default model is `gemini-2.0-flash-exp` (cheapest in configured options).
Fallback is `gemini-1.5-flash` if needed.

## Cost Formula

```text
cost = (inputTokens / 1000 * inputRate) + (outputTokens / 1000 * outputRate)
```

Rounded to 6 decimals.

## Typical Operation Cost (Estimate)

For `120 input + 180 output` on Gemini 2.0 Flash:

- Input cost: `120/1000 * 0.00001875 = 0.00000225`
- Output cost: `180/1000 * 0.000075 = 0.00001350`
- Total: `~$0.000016`

This is well below the `< $0.001` target.

## Cost Controls Implemented

1. Prompt templates are concise.
2. Max token limits are capped per action.
3. No streaming responses.
4. Shared singleton Gemini client.
5. Retry only on retryable failures.
6. Per-request token + cost telemetry in responses.

## Monitoring

- Logs include action name, token usage, and cost.
- In-memory daily/monthly usage ledger is tracked in `GeminiClient`.

For production billing analytics, persist usage to database or telemetry pipeline.
