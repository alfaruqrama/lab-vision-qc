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
