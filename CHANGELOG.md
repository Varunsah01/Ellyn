# Changelog

## 2026-02-16

### Added
- Introduced API versioning with `v1` route surface under `app/api/v1/*`.
- Added API root metadata endpoint:
  - `GET /api` -> returns current version and base paths.
  - `GET /api/v1` -> returns `v1` metadata.
- Added response version envelope for `v1` endpoints:
  - Responses now include `version: "1"` and `data`.

### Changed
- Updated internal app and extension API calls to use `/api/v1/*`.
- Added generated `v1` route wrappers for all existing API route handlers to keep behavior aligned while exposing versioned URLs.

### Breaking changes
- Clients integrating with versioned endpoints should consume versioned responses:
  - `{"version":"1","data":{...}}`
- Unversioned `/api/*` endpoints remain available for backward compatibility, but `/api/v1/*` is now the canonical integration surface.

