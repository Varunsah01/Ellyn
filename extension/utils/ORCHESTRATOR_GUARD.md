# Workflow Orchestrator Execution Guard

## Problem
In a user-driven environment like a Chrome extension sidepanel, rapid clicks or conflicting events can trigger multiple instances of the extraction workflow simultaneously. This can lead to:
- Race conditions (overwriting global state).
- Duplicate API calls.
- Inconsistent UI states.
- Conflict with legacy logic if not fully disabled.

## Solution: `isProcessing` Guard
The `WorkflowOrchestrator` implements a simple boolean lock:

```javascript
this.isProcessing = false; // Initial state

async run() {
  if (this.isProcessing) {
    // 1. Immediate rejection
    return { status: 'blocked', error: 'Workflow already running' };
  }

  this.isProcessing = true; // 2. Lock
  
  try {
    // ... complex async logic ...
  } finally {
    this.isProcessing = false; // 3. Release (guaranteed)
  }
}
```

## How It Prevents Conflicts

### 1. Rapid Clicks (Debouncing)
If a user double-clicks "Extract", the first call sets the lock. The second call sees `isProcessing === true` and immediately returns a `blocked` status, protecting the ongoing operation.

### 2. Idempotency
Because the second call is rejected, the orchestrator guarantees that only one extraction pipeline runs at a time per tab context. This ensures that the state (extracted fields, confidence decisions) is consistent with a single user action.

### 3. Legacy Workflow Isolation
Even if legacy code (like `extractProfile` listeners) were triggered, they run independently or are disabled. The Orchestrator's guard ensures *its own* integrity. Since the UI entry point (`sidepanel.js`) now exclusively calls the Orchestrator via `runOrchestrator`, and the Orchestrator enforces serial execution, no two "modern" flows can collide.
