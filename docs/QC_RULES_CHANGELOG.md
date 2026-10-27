
# QC RULES CHANGELOG

## Temuan Fase 0
- **T0.1 (Signatures)**: 
  - `computeZScores` returns `Record<ControlLevel, ZScorePoint[]>`.
  - `analyzeMultiLevel` takes `Record<ControlLevel, ZScorePoint[]>`.
  - `evaluateWestgard` is a single-point check.
- **T0.2 (In-Control Logic)**: 
  - Confirmed: Current `LeveyJennings.tsx` uses `Math.abs(d.value) <= 2` to calculate In-Control %.
  - This confirms the bug: it only checks 1-2s per point, ignoring rolling window rules (2-2s, 4-1s, etc.).
- **T0.3 (Run Definition)**: 
  - 'Run' is fundamentally a set of records sharing the same input event. For EASYLITE, it's multiple levels at once.
- **T0.4 (Lot Lookup)**: 
  - `findActiveLot` prioritizes `record.lot` -> expiry lookup.
- **T0.5 (Status JSONB)**: 
  - `overall_status` is saved as a string.
- **T0.6 (Range Mode)**: 
  - Current range implementation is missing explicit multiplier (2SD/3SD) logic.
- **T0.7 (Testing)**: 
  - Vitest env present but `node_modules` missing on VPS. Verification will use Mirror Probes.
