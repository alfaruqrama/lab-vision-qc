
# QC Rule Engine Implementation TODO List

## FASE 0: Discovery
- [ ] T0.1: Audit signatures and types (westgard.ts, westgard-multi.ts, zscore.ts, types.ts, lot-expiry.ts, constants.ts)
- [ ] T0.2: Trace 'In-Control' card logic in LeveyJennings.tsx & MonthlyReport.tsx
- [ ] T0.3: Define 'run' unique key for cross-level pairing
- [ ] T0.4: Audit lot lookup logic in zscore.ts
- [ ] T0.5: Audit status JSONB and numeric parsing in StepForm.tsx
- [ ] T0.6: Audit range mode logic in LotConfig.tsx
- [ ] T0.7: Verify Vitest configuration and environment

## FASE 1: Pure Rule Engine + Tests
- [ ] T1.1: Implement Severity Classification (warning/reject/advisory)
- [ ] T1.2: Implement Level-Aware Rules (single vs multi-level)
- [ ] T1.3: Implement Lot-Bound Evaluation (reset on lot change)
- [ ] T1.4: Implement 'excluded' point handling
- [ ] T1.5: Implement Numeric Tolerance (6 decimal rounding, strict >)
- [ ] T1.6: Implement Regression Tests (F1-F13)
- [ ] T1.7: Integrate westgard-multi.ts into new engine

## FASE 2: Integration & Data Handling
- [ ] T2.1: Implement Multirule Evaluation on Save (StepForm.tsx)
- [ ] T2.2: Update In-Control Card to use EngineResult.summary
- [ ] T2.3: Implement Target vs Actual stats & Bias % UI
- [ ] T2.4: Implement Data Exclusion logic (Migration 003 + UI action)

## FASE 3: Lot Config, Validation & UI Panel
- [ ] T3.1: Enhance LotConfig with sdSource and Range Multiplier
- [ ] T3.2: Implement 'Calculate from Lab Data' utility (Optional)
- [ ] T3.3: Implement Gross Error validation & numeric normalization
- [ ] T3.4: Implement 'Westgard Evaluation' UI Panel
