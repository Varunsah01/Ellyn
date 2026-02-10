# Human-in-the-Loop Recovery Flow

When the `WorkflowOrchestrator` returns a status of `partial`, it indicates that while data was extracted, one or more fields fell below the high-confidence threshold. This document describes the UI/UX flow for resolving these uncertainties.

## 1. Trigger Condition
The Sidepanel receives a message from the Content Script with the extraction result:
```javascript
{
  status: "partial",
  data: {
    name: { value: "John Doe", confidence: 95 },
    company: { value: "Tech Inc", confidence: 40 }, // <--- Low Confidence
    role: { value: null, confidence: 0 }            // <--- Missing
  },
  decision: {
    action: "REQUIRE_CONFIRMATION",
    lowConfidenceFields: ["company"],
    missingFields: ["role"]
  }
}
```

## 2. UI Presentation (Recovery Mode)

Instead of showing the standard "Success" card, the UI enters **Recovery Mode**:

### A. Header
*   **Title**: "Review Extracted Data"
*   **Status Indicator**: Amber/Yellow warning icon.
*   **Message**: "Some details need your confirmation."

### B. Field List
Render input fields for the data. Use visual cues to guide attention:

1.  **High Confidence Fields** (e.g., Name):
    *   Render as standard inputs.
    *   State: Pre-filled, valid.
    *   *Optional:* Small green checkmark.

2.  **Low Confidence Fields** (e.g., Company):
    *   Render with an amber border or background.
    *   **Tooltip/Label**: "Low confidence (40%) - inferred from meta tags."
    *   **Action**: User must explicitly "Approve" (click check) or Edit the value.
    *   *UX:* Focusing the field clears the warning state.

3.  **Missing Fields** (e.g., Role):
    *   Render empty with a red border (if required).
    *   **Placeholder**: "Enter role..."
    *   **Action**: User must type a value.

### C. Actions
*   **"Confirm & Continue" Button**:
    *   Disabled until all *required* missing fields are filled.
    *   Primary action.
    *   On click: treating the current form state as the final "truth".

## 3. Data Flow

1.  **Orchestrator** yields `partial` result to Sidepanel.
2.  **Sidepanel** renders Recovery Form.
3.  **User** edits/confirms data.
4.  **Sidepanel** collects form data (now considered 100% confidence because human verified).
5.  **Sidepanel** calls `apiClient.enrichContact` or `apiClient.saveContact` with the *confirmed* data.

## 4. Pseudo-Code (Sidepanel Handler)

```javascript
async function handleExtractionResult(result) {
  if (result.status === 'success') {
    // Happy path: Auto-fill and maybe auto-save
    displayContactCard(result.data);
  } 
  else if (result.status === 'partial') {
    // Recovery path
    showRecoveryForm({
      fields: result.data,
      warnings: result.decision.lowConfidenceFields,
      missing: result.decision.missingFields
    });
  } 
  else if (result.status === 'blocked') {
    // Failure path
    showError(result.error);
  }
}

function onUserConfirm(formData) {
  // User has manually verified the data.
  // We can now treat this as "High Confidence" / "Manual Source".
  const verifiedContact = {
    ...formData,
    source: 'manual_recovery', 
    confidence: 100
  };
  
  saveContact(verifiedContact);
}
```
