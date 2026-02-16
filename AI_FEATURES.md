# AI Features

This project now includes an AI assistant for template authoring and refinement, powered by Gemini Flash.

## Available Actions

1. Enhance Draft
- Improves clarity, structure, and professionalism.
- Keeps output concise by prompt instruction.

2. Change Tone
- Rewrites draft to one of:
  - professional
  - casual
  - friendly
  - formal
  - enthusiastic

3. Make Shorter
- Compresses draft while preserving key ask and intent.

4. Make Longer
- Expands draft with additional relevant detail.

5. Add Personalization
- Uses company/role/sender context to make content more specific.

6. Fix Grammar
- Corrects grammar, spelling, and punctuation.

7. Generate from Scratch
- Produces a new subject + body from template type + instructions.

## UX Highlights

- AI actions are available directly in the template editor.
- On desktop: AI panel is visible alongside the editor.
- On mobile: AI panel is available as a bottom sheet.
- Every AI response reports token usage and estimated cost.

## Safety Notes

- AI only suggests text; it never sends emails automatically.
- Users must manually review and save drafts.
- API key is server-side only (`GOOGLE_AI_API_KEY`).

## Files

- `lib/gemini.ts`
- `lib/template-prompts.ts`
- `app/api/ai/enhance-draft/route.ts`
- `app/api/ai/customize-tone/route.ts`
- `app/api/ai/generate-template/route.ts`
- `components/ai-assistant-panel.tsx`
- `components/template-editor.tsx`
