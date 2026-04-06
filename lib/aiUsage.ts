const KEY = "davinci_ai_uses";
const FREE_LIMIT = 3;

export function getAIUsageCount(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return 0;

    const count = Number.parseInt(raw, 10);
    return Number.isNaN(count) ? 0 : count;
  } catch {
    return 0;
  }
}

export function hasRemainingAIUsage(): boolean {
  return getAIUsageCount() < FREE_LIMIT;
}

export function incrementAIUsageCount(): void {
  try {
    localStorage.setItem(KEY, String(getAIUsageCount() + 1));
  } catch {
    // Ignore localStorage quota or availability failures.
  }
}

export function getRemainingAIUses(): number {
  return Math.max(0, FREE_LIMIT - getAIUsageCount());
}
