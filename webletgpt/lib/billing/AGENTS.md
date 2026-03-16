# BILLING MODULE

## OVERVIEW
Credit-based billing system — calculates costs, enforces quotas, logs usage, handles overage and cycle resets.

## FILES
| File | Purpose | Key Export |
|------|---------|------------|
| `credit-calculator.ts` | Token → credit conversion | `CREDIT_MULTIPLIERS`, `calculateCredits()` |
| `cost-calculator.ts` | Model pricing | `calculateCost()` |
| `usage-logger.ts` | Records usage, decrements credits | `logUsage()` |
| `quota-check.ts` | Pre-execution credit validation | `checkQuotas()` |
| `overage.ts` | Developer overage processing | `processDeveloperOverage()` |
| `cycle-reset.ts` | Billing cycle management | Cycle reset logic |

## PATTERNS
- All credit mutations use `db.$transaction` for atomicity
- `logUsage()` is called after every AI interaction in chat route
- `checkQuotas()` is called before execution to prevent overdraft
- `CREDIT_MULTIPLIERS` defines per-tool cost scaling

## ANTI-PATTERNS
- **NEVER** modify credits outside a `$transaction`
- **NEVER** skip `checkQuotas()` before AI execution
- Type assertions exist in `overage.ts` — avoid adding more
