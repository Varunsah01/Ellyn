#!/usr/bin/env bash
set -euo pipefail

STRICT=0
STAGED=0
NO_OPTIONAL=0

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    --staged) STAGED=1 ;;
    --no-optional) NO_OPTIONAL=1 ;;
    --help|-h)
      cat <<'USAGE'
Usage: bash scripts/security/scan-secrets.sh [--staged] [--strict] [--no-optional]

Options:
  --staged       Scan only staged files (requires git)
  --strict       Exit non-zero for medium-confidence findings too
  --no-optional  Skip optional trufflehog/git-secrets execution
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "ERROR: ripgrep (rg) is required. Install from https://github.com/BurntSushi/ripgrep" >&2
  exit 2
fi

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
FINDINGS_MD="$REPO_ROOT/security_findings.md"
FINDINGS_JSON="$REPO_ROOT/security_findings.json"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
FINDINGS_TSV="$TMP_DIR/findings.tsv"
: > "$FINDINGS_TSV"

mask_token() {
  local token="$1"
  local len=${#token}
  if (( len <= 8 )); then
    printf '%*s' "$len" '' | tr ' ' '*'
    return
  fi
  printf '%s...%s' "${token:0:4}" "${token: -4}"
}

hash_token() {
  local token="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$token" | sha256sum | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$token" | shasum -a 256 | awk '{print $1}'
    return
  fi
  if command -v openssl >/dev/null 2>&1; then
    printf '%s' "$token" | openssl dgst -sha256 | awk '{print $2}'
    return
  fi
  printf 'unavailable'
}

json_escape() {
  local input="$1"
  input=${input//\\/\\\\}
  input=${input//\"/\\\"}
  input=${input//$'\n'/\\n}
  input=${input//$'\r'/\\r}
  input=${input//$'\t'/\\t}
  printf '%s' "$input"
}

HIGH_COUNT=0
MEDIUM_COUNT=0
TOTAL_COUNT=0

append_finding() {
  local severity="$1"
  local rule="$2"
  local file="$3"
  local line="$4"
  local token="$5"

  local hash
  hash="$(hash_token "$token")"
  local hash_short="${hash:0:16}"
  local masked
  masked="$(mask_token "$token")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$severity" "$rule" "$file" "$line" "$masked" "$hash_short" >> "$FINDINGS_TSV"
}

RG_EXCLUDE_ARGS=(
  --hidden
  --no-messages
  --glob '!.git/**'
  --glob '!node_modules/**'
  --glob '!.next/**'
  --glob '!coverage/**'
  --glob '!playwright-report/**'
  --glob '!test-results/**'
  --glob '!extension/lib/vendor/**'
  --glob '!repomix-output.xml'
  --glob '!.env'
  --glob '!.env.*'
)

TARGETS=(".")
MODE_LABEL="working-tree"

if (( STAGED == 1 )); then
  MODE_LABEL="staged"
  if ! command -v git >/dev/null 2>&1; then
    echo "ERROR: --staged requires git." >&2
    exit 2
  fi
  mapfile -t STAGED_FILES < <(git diff --cached --name-only --diff-filter=ACMR)
  if (( ${#STAGED_FILES[@]} == 0 )); then
    cat > "$FINDINGS_MD" <<EOF
# Security Findings

- Generated at: $TIMESTAMP
- Scan mode: $MODE_LABEL
- Findings: 0

No staged files to scan.
EOF
    cat > "$FINDINGS_JSON" <<EOF
{"generated_at":"$TIMESTAMP","mode":"$MODE_LABEL","high_confidence_count":0,"medium_confidence_count":0,"total_findings":0,"findings":[],"optional_tools":[]}
EOF
    echo "No staged files to scan."
    exit 0
  fi
  TARGETS=("${STAGED_FILES[@]}")
fi

scan_rule() {
  local severity="$1"
  local rule="$2"
  local regex="$3"

  local hit
  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue

    local file="${hit%%:*}"
    local remainder="${hit#*:}"
    local line="${remainder%%:*}"
    local token="${remainder#*:}"

    if [[ -z "$file" || -z "$line" || -z "$token" ]]; then
      continue
    fi

    append_finding "$severity" "$rule" "$file" "$line" "$token"
  done < <(
    rg "${RG_EXCLUDE_ARGS[@]}" --pcre2 -n -H -o "$regex" "${TARGETS[@]}" || true
  )
}

# High-confidence signatures
scan_rule "high" "supabase-service-role" 'sbp_[A-Za-z0-9._-]{16,}'
scan_rule "high" "supabase-publishable" 'sb_publishable_[A-Za-z0-9._-]{16,}'
scan_rule "high" "google-api-key" 'AIza[0-9A-Za-z_-]{20,}'
scan_rule "high" "generic-sk-token" 'sk-[A-Za-z0-9]{20,}'
scan_rule "high" "webhook-secret" 'whsec_[A-Za-z0-9]{12,}'
scan_rule "high" "github-token" 'gh[pousr]_[A-Za-z0-9]{20,}'
scan_rule "high" "slack-token" 'xox[baprs]-[A-Za-z0-9-]{10,}'
scan_rule "high" "jwt-like-token" '[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
scan_rule "high" "private-key-block" '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'

# Medium-confidence signatures
scan_rule "medium" "inline-secret-assignment" '(?i)(api[_-]?key|secret|token|password)\s*[:=]\s*["'"'"'][A-Za-z0-9_\/+=.-]{16,}["'"'"']'
scan_rule "medium" "credential-in-url" '(?i)https?://[^/\s:@]+:[^/\s:@]+@'

if [[ -s "$FINDINGS_TSV" ]]; then
  sort -u "$FINDINGS_TSV" > "$TMP_DIR/findings.dedup.tsv"
  mv "$TMP_DIR/findings.dedup.tsv" "$FINDINGS_TSV"
fi

TOTAL_COUNT=$(wc -l < "$FINDINGS_TSV" | tr -d ' ')
if (( TOTAL_COUNT > 0 )); then
  HIGH_COUNT=$(awk -F $'\t' '$1=="high" {count++} END {print count+0}' "$FINDINGS_TSV")
  MEDIUM_COUNT=$(awk -F $'\t' '$1=="medium" {count++} END {print count+0}' "$FINDINGS_TSV")
fi

OPTIONAL_TOOL_LINES=()
OPTIONAL_HIGH_COUNT=0

run_optional_tool() {
  local tool_name="$1"
  local install_hint="$2"
  local cmd="$3"

  if ! command -v "$tool_name" >/dev/null 2>&1; then
    OPTIONAL_TOOL_LINES+=("$tool_name|missing|Install: $install_hint")
    return
  fi

  local out_file="$TMP_DIR/${tool_name}.out"
  local err_file="$TMP_DIR/${tool_name}.err"

  set +e
  bash -lc "$cmd" >"$out_file" 2>"$err_file"
  local rc=$?
  set -e

  if (( rc == 0 )); then
    OPTIONAL_TOOL_LINES+=("$tool_name|ok|No findings reported")
    return
  fi

  # Non-zero is treated as a high-confidence alert signal from optional scanners.
  OPTIONAL_HIGH_COUNT=$((OPTIONAL_HIGH_COUNT + 1))
  OPTIONAL_TOOL_LINES+=("$tool_name|alert|Potential findings or scanner error (exit $rc). Review locally without sharing raw output.")
}

if (( NO_OPTIONAL == 0 )); then
  run_optional_tool "trufflehog" \
    "https://github.com/trufflesecurity/trufflehog#installation" \
    "trufflehog filesystem --json ."

  if command -v git-secrets >/dev/null 2>&1 && command -v git >/dev/null 2>&1; then
    run_optional_tool "git-secrets" \
      "https://github.com/awslabs/git-secrets" \
      "git secrets --scan -r ."
  else
    OPTIONAL_TOOL_LINES+=("git-secrets|missing|Install: https://github.com/awslabs/git-secrets")
    if ! command -v git >/dev/null 2>&1; then
      OPTIONAL_TOOL_LINES+=("git|missing|git is required for --staged and git-secrets history checks")
    fi
  fi
fi

EFFECTIVE_HIGH_COUNT=$((HIGH_COUNT + OPTIONAL_HIGH_COUNT))

{
  echo "# Security Findings"
  echo
  echo "- Generated at: $TIMESTAMP"
  echo "- Scan mode: $MODE_LABEL"
  echo "- Total findings: $TOTAL_COUNT"
  echo "- High-confidence findings: $HIGH_COUNT"
  echo "- Medium-confidence findings: $MEDIUM_COUNT"
  if (( NO_OPTIONAL == 0 )); then
    echo "- Optional tool alerts: $OPTIONAL_HIGH_COUNT"
  fi
  echo
  if (( TOTAL_COUNT == 0 )); then
    echo "No regex-based findings detected."
  else
    echo "## Findings"
    echo
    echo "| Severity | Rule | Location | Masked Value | SHA-256 (prefix) |"
    echo "| --- | --- | --- | --- | --- |"
    while IFS=$'\t' read -r severity rule file line masked hash_short; do
      echo "| $severity | $rule | \`$file:$line\` | \`$masked\` | \`$hash_short\` |"
    done < "$FINDINGS_TSV"
  fi

  if (( NO_OPTIONAL == 0 )); then
    echo
    echo "## Optional Tools"
    echo
    for line in "${OPTIONAL_TOOL_LINES[@]}"; do
      tool="${line%%|*}"
      rest="${line#*|}"
      status="${rest%%|*}"
      note="${rest#*|}"
      echo "- \`$tool\`: $status - $note"
    done
  fi
} > "$FINDINGS_MD"

{
  echo "{"
  echo "  \"generated_at\": \"$(json_escape "$TIMESTAMP")\","
  echo "  \"mode\": \"$(json_escape "$MODE_LABEL")\","
  echo "  \"high_confidence_count\": $HIGH_COUNT,"
  echo "  \"medium_confidence_count\": $MEDIUM_COUNT,"
  echo "  \"optional_tool_alerts\": $OPTIONAL_HIGH_COUNT,"
  echo "  \"total_findings\": $TOTAL_COUNT,"
  echo "  \"findings\": ["

  FINDING_INDEX=0
  while IFS=$'\t' read -r severity rule file line masked hash_short; do
    if (( FINDING_INDEX > 0 )); then
      echo "    ,"
    fi
    echo "    {"
    echo "      \"severity\": \"$(json_escape "$severity")\","
    echo "      \"rule\": \"$(json_escape "$rule")\","
    echo "      \"file\": \"$(json_escape "$file")\","
    echo "      \"line\": $line,"
    echo "      \"masked_value\": \"$(json_escape "$masked")\","
    echo "      \"sha256_prefix\": \"$(json_escape "$hash_short")\""
    echo -n "    }"
    FINDING_INDEX=$((FINDING_INDEX + 1))
  done < "$FINDINGS_TSV"
  echo
  echo "  ],"
  echo "  \"optional_tools\": ["
  for i in "${!OPTIONAL_TOOL_LINES[@]}"; do
    line="${OPTIONAL_TOOL_LINES[$i]}"
    tool="${line%%|*}"
    rest="${line#*|}"
    status="${rest%%|*}"
    note="${rest#*|}"
    prefix="    "
    if (( i > 0 )); then
      echo "    ,"
    fi
    echo "    {"
    echo "      \"tool\": \"$(json_escape "$tool")\","
    echo "      \"status\": \"$(json_escape "$status")\","
    echo "      \"note\": \"$(json_escape "$note")\""
    echo -n "    }"
  done
  echo
  echo "  ]"
  echo "}"
} > "$FINDINGS_JSON"

echo "Wrote sanitized findings:"
echo "  - security_findings.md"
echo "  - security_findings.json"

for line in "${OPTIONAL_TOOL_LINES[@]}"; do
  tool="${line%%|*}"
  rest="${line#*|}"
  status="${rest%%|*}"
  note="${rest#*|}"
  if [[ "$status" == "missing" ]]; then
    echo "Optional tool missing: $tool. $note"
  fi
done

if (( EFFECTIVE_HIGH_COUNT > 0 )); then
  echo "High-confidence findings detected." >&2
  exit 1
fi

if (( STRICT == 1 && MEDIUM_COUNT > 0 )); then
  echo "Strict mode enabled and medium-confidence findings detected." >&2
  exit 1
fi

echo "Secret scan completed without blocking findings."
