/**
 * Calculate the multiplier for ratio of support pricing
 * @param ratio - The ratio string (e.g., "1:1", "1:2", "2:1")
 * @returns The price multiplier
 */
export function calculateRatioMultiplier(ratio: string): number {
  if (!ratio) return 1;
  
  const [workers, participants] = ratio.split(':').map(Number);
  
  if (!workers || !participants) return 1;
  
  // Price multiplier = workers / participants
  // 1:1 = 1/1 = 1 (full price)
  // 1:2 = 1/2 = 0.5 (half price)
  // 2:1 = 2/1 = 2 (double price)
  // 1:3 = 1/3 = 0.33 (one third price)
  // 1:4 = 1/4 = 0.25 (one quarter price)
  
  return workers / participants;
}

/**
 * Get a human-readable description of the ratio multiplier
 * @param ratio - The ratio string
 * @returns Description of the pricing effect
 */
export function getRatioDescription(ratio: string): string {
  const multiplier = calculateRatioMultiplier(ratio);
  
  if (multiplier === 1) return "Standard pricing";
  if (multiplier === 0.5) return "Half price";
  if (multiplier === 2) return "Double price";
  if (multiplier < 1) return `${Math.round(multiplier * 100)}% of standard price`;
  if (multiplier > 1) return `${multiplier}x standard price`;
  
  return "Custom pricing";
}