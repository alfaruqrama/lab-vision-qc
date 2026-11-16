/**
 * Single source of truth for Westgard rule identity and severity.
 *
 * Every engine imports from here so the same rule cannot be a rejection in one
 * place and a warning in another.
 */

export type StandardRuleId = '1-3s' | '1-2s' | '2-2s' | '4-1s' | '10x' | 'R-4s';

/**
 * Westgard multirule: 1-2s is the warning rule that triggers inspection; the
 * rest reject the run. Note 4-1s is a rejection rule in both the classic and
 * modern multirule procedures — only its precondition differs.
 */
const WARNING_RULES: ReadonlySet<StandardRuleId> = new Set<StandardRuleId>(['1-2s']);

export function isRejectionRule(rule: StandardRuleId): boolean {
  return !WARNING_RULES.has(rule);
}

export function ruleStatus(rule: StandardRuleId): 'oos' | 'warning' {
  return isRejectionRule(rule) ? 'oos' : 'warning';
}

export function ruleSeverity(rule: StandardRuleId): 'reject' | 'warning' {
  return isRejectionRule(rule) ? 'reject' : 'warning';
}

/**
 * R-4s, in the definition Westgard QC gives for the rule: within one run, one
 * control measurement exceeds +2s and another exceeds −2s. Every engine calls
 * this so the rule cannot mean two different things on two pages.
 *
 * The other common wording — "range between the largest and smallest
 * observation in the run exceeds 4s" (WHO, Tech Networks) — is not equivalent.
 * With z = +5.0 and −1.1 the range is 6.1, so it fires, but no measurement is
 * below −2s: that run is a 1-3s event, not an R-4s one. Since Westgard's rule
 * fires on a pair, a violation always implies a range > 4s, never the reverse.
 */
export function violatesR4s(zValues: readonly number[]): boolean {
  let above = false;
  let below = false;
  for (const z of zValues) {
    if (z > 2) above = true;
    else if (z < -2) below = true;
    if (above && below) return true;
  }
  return false;
}
