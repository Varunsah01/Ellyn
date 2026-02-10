# Regression Guard (`dev-guard.js`)

To prevent the re-introduction of brittle patterns (like `alert()` errors or legacy workflow execution), we have added a development-only guard system.

## Features

### 1. Alert Interception
The guard monkey-patches `window.alert`. If `alert()` is called during development:
- A prominent console warning `[UX Regression]` is logged.
- A stack trace is printed to identify the source.
- This ensures developers notice and fix accidental `alert()` usage immediately.

### 2. Error Escape Monitoring
It listens for `unhandledrejection` events. If an error escaping the `WorkflowOrchestrator` (which should swallow all errors) is detected, it logs a `[Orchestrator Regression]` warning.

### 3. Legacy Code Reporting
Deprecated modules (like `MagicWorkflow` stubs) call `EllynDevGuard.reportLegacyCall('MagicWorkflow')`. This flags if any dead code paths are accidentally reactivated or reachable.

## Environment Detection
The guard only activates if the extension is running in "unpackaged" / development mode (detected via manifest properties like `update_url`). It performs no-ops in production to ensure zero performance impact.
