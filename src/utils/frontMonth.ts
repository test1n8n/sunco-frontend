/**
 * Find the front-month row in a forward curve.
 *
 * Returns the row matching `frontMonthContract` if present, otherwise
 * falls back to the first row (for robustness when backend didn't resolve).
 */
export function findFrontMonthRow<T extends { contract: string }>(
  curve: T[] | undefined | null,
  frontMonthContract: string | undefined | null,
): T | undefined {
  if (!curve || curve.length === 0) return undefined;
  if (frontMonthContract) {
    const match = curve.find((r) => r.contract === frontMonthContract);
    if (match) return match;
  }
  return curve[0];
}
