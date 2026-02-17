# Email Finder Pipeline Logging

The new pipeline in `lib/email-finder/pipeline.ts` uses two structured log channels:

1. Event logs:
`[EmailFinder] { scope, level, event, ...fields }`

2. Metrics:
`[EmailFinder][Metric] { scope, metric, ...fields }`

## Common events

- `mx_verify_cache_hit`
- `mx_verify_dns_complete`
- `mx_verify_failed`
- `mx_cache_unavailable_fallback_dns`
- `domain_resolution_api_failed`

## Common metrics

- `mx.cache.unavailable`
- `mx.cache.get_error`
- `mx.cache.set_error`
- `mx.cache.redis_unavailable`

## Example output

```text
[EmailFinder] { scope: 'email_finder', level: 'warn', event: 'mx_cache_unavailable_fallback_dns', domain: 'acme.io', error: 'Error: redis unavailable' }
[EmailFinder][Metric] { scope: 'email_finder', metric: 'mx.cache.unavailable', domain: 'acme.io', error: 'Error: redis unavailable' }
```
