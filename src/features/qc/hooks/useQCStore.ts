/**
 * Re-export of the canonical QC store hook.
 *
 * This file used to hold a second implementation that read `.records` /
 * `.config` straight off the React Query results, which are objects with
 * `.data`, not the values themselves — every consumer got `undefined`.
 * Keeping one implementation avoids that class of bug.
 */
export { useQCStore, QCProvider } from '@/hooks/use-qc-store';
