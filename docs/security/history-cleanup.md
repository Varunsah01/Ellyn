# History Cleanup and Exposure Response (Human-Review-Only)

Last updated: 2026-03-09

## When to Run Full-History Scanning
- Any time a secret is confirmed in a tracked file or suspected in commit history.
- Before public disclosure of an incident report.
- Before/after planned history rewrite to verify cleanup completeness.

## Working Tree Scan (Sanitized)

Use the repo scanner first:

```bash
bash scripts/security/scan-secrets.sh --strict
```

Outputs:
- `security_findings.md`
- `security_findings.json`

## History Scan Commands (Sanitized Output Required)

Run these on a maintainer machine with `git` installed.

### TruffleHog (git history)
```bash
trufflehog git --no-update --json file://.
```

### git-secrets (history)
```bash
git secrets --scan-history
```

### ripgrep (working tree spot checks)
```bash
rg -n --hidden --glob '!.git/**' --pcre2 'sbp_[A-Za-z0-9._-]{16,}|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}'
```

Do not paste raw matches into tickets. Mask values (`first4...last4`) and optionally include SHA-256 prefixes only.

## Human-Review-Only Rewrite Draft Commands

Do not run automatically in CI or scripts.

### git-filter-repo draft
```bash
# Example: replace known leaked strings using a replacements file.
# replacements.txt format:
#   literal:old_value==>literal:REDACTED_VALUE
git filter-repo --replace-text replacements.txt --force
```

### BFG draft
```bash
# Example: delete historical env files if they were ever committed.
bfg --delete-files '.env,.env.local,public-config.js' --no-blob-protection
```

After rewrite:
```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## Force-Push and Collaboration Reset
1. Security lead reviews rewrite diff and replacement list.
2. Force-push rewritten branches/tags only after approval.
3. Notify all collaborators:
   - stop current work
   - create backup branch if needed
   - reclone or hard-reset to rewritten history
4. Rotate all exposed credentials again if uncertainty remains.

## Collaborator Cleanup Instructions
- Preferred: fresh clone after history rewrite.
- If preserving local work:
  1. `git fetch --all`
  2. `git checkout <branch>`
  3. `git reset --hard origin/<branch>`
  4. clean stale refs and run garbage collection.

## Important Note
- Deleting a secret from a later commit is not sufficient if it was committed historically.
- History rewrite does not revoke credentials; rotate/revoke keys first.
