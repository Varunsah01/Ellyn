# Sentry Alert Setup

Set up these issue alerts in Sentry Project Settings -> Alerts -> Create Alert Rule.

## 1) Error Spike (High Priority)

- Rule name: `API Error Spike (5m)`
- Condition: `The issue is seen more than 25 times in 5 minutes`
- Filter:
  - `environment = production`
  - `level = error`
- Action:
  - Email team owners
  - Slack webhook/channel for on-call

## 2) New Regression Alert

- Rule name: `New Error Regression`
- Condition: `A new issue is created`
- Filter:
  - `environment = production`
  - `level = error`
- Action:
  - Email engineering
  - Slack webhook/channel for triage

## 3) Latency Alert (Performance)

- Go to Alerts -> Metric Alerts -> Create Alert
- Rule name: `Slow API P95`
- Dataset: `Transactions`
- Query filter:
  - `transaction.op:http.server`
  - `environment:production`
- Trigger: `p95(transaction.duration) > 2000 ms` for 10 minutes
- Action:
  - Slack + email

## Suggested SLO Targets

- Error rate: `< 1%`
- p95 API latency: `< 1500ms`
- p99 API latency: `< 3000ms`
