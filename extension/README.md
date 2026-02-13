# Ellyn Extension - Minimal Login UI

Clean and minimal sidepanel login interface focused on fast sign-in decisions.

## Structure

```
extension/
|-- assets/
|   `-- icons/
|       `-- Ellynlogo.png
|-- styles/
|   `-- sidepanel.css
|-- scripts/
|   `-- sidepanel.js
`-- sidepanel.html
```

## Design Tokens

- Primary blue: `#3B82F6` / hover `#2563EB`
- Background: `#F9FAFB`
- Heading text: `#111827`
- Secondary text: `#6B7280`
- Border: `#E5E7EB`

## Typography

- Font stack: `Inter`, `SF Pro Display`, `Segoe UI`, system sans-serif
- Title: `24px`, `600`
- Body: `15px`
- Links/terms: `12-13px`

## Behavior

- `Sign In` opens auth tab with `mode=signin`
- `Create Account` opens auth tab with `mode=signup`
- Buttons show loading state while opening tabs
- Status line announces success/error text

## Accessibility

- Semantic heading hierarchy
- Keyboard-focus visible outlines
- Live region for auth status updates
- High contrast text and controls

## Notes

- Frontend only (no backend integration changes)
- CSS intentionally kept simple and compact
