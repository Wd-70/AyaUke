/** Deliberate downward movement; small sheets should not require a long swipe. */
export function shouldDismissSheet(distance: number, height: number): boolean {
  return distance >= Math.min(112, Math.max(64, height * 0.2));
}
