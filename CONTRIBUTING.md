# Contributing

## Naming Conventions

Use these conventions consistently across the codebase:

1. Database columns and persisted row keys: `snake_case`
- Examples: `first_name`, `last_name`, `created_at`, `user_id`

2. TypeScript/JavaScript variables, params, and function names: `camelCase`
- Examples: `firstName`, `lastName`, `createdAt`, `fetchContacts`

3. React components and type-like symbols: `PascalCase`
- Examples: `ContactForm`, `LeadTable`, `EmailComposerProps`

4. File names
- React component files in `components/`: `PascalCase`
- Hook files in `hooks/`: `camelCase` (for example, `useAuthForm.ts`)
- File names should match the primary export when possible.

5. Constants: `UPPER_SNAKE_CASE`
- Examples: `MAX_RETRIES`, `API_BASE_URL`, `DEFAULT_TIMEOUT_MS`

## Conversion Helpers

Use centralized helpers from `lib/utils/naming.ts`:

- `toSnakeCase(value)`
- `toCamelCase(value)`
- `toPascalCase(value)`

These should be used when converting data at boundaries (for example API payloads, DB rows, and UI mapping code).

## Lint Enforcement

ESLint enforces naming conventions for:
- TS/JS identifiers via `@typescript-eslint/naming-convention`
- file names in `components/` and `hooks/` via `eslint-plugin-check-file`

Run before opening a PR:

```bash
npm run lint
npx tsc --noEmit
```

