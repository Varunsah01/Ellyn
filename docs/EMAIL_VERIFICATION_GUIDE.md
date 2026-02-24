## Verification Methods

### SMTP Probe (Primary)
For companies on custom mail servers (non-Google, non-Microsoft), Ellyn performs a
direct SMTP handshake to confirm whether an inbox exists. This costs nothing and
provides a definitive answer. Confidence score: 92.

### Pattern Confidence (Google Workspace / Microsoft 365)
Major providers block SMTP probing to prevent email harvesting. For these domains,
Ellyn uses pattern confidence scoring based on the email provider's known formatting
preferences (e.g., first.last is strongly preferred on Google Workspace). Confidence
scores range from 50-85 depending on the pattern and provider match.

### Confidence Score Reference
| Score | Meaning |
|-------|---------|
| 92 | SMTP confirmed - mail server accepted the address |
| 70-85 | High pattern confidence (provider preference match) |
| 50-69 | Medium pattern confidence |
| 35-45 | Catch-all domain - server accepts all addresses |
| 10-34 | Low confidence - unusual format or domain issues |
