import type { WorkspaceProfile } from "@/lib/cloudStorage";

export const DEFAULT_FREE_PLAN = "free";
export const DEFAULT_FREE_QUOTA = 3;
const QUOTA_WINDOW_DAYS = 30;

export const PLAN_QUOTAS: Record<string, number> = {
  free: 3,
  pro: 50,
};

export function getQuotaForPlan(plan: string): number {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;
}

function hasActiveProExpiry(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile?.pro_expires_at) {
    return false;
  }

  const expiresAt = Date.parse(profile.pro_expires_at);
  return !Number.isNaN(expiresAt) && expiresAt > referenceTime;
}

export function getEffectivePlan(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile) {
    return DEFAULT_FREE_PLAN;
  }

  return profile.plan === "pro" || hasActiveProExpiry(profile, referenceTime)
    ? "pro"
    : DEFAULT_FREE_PLAN;
}

export function getEffectiveQuota(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile) {
    return 0;
  }

  return getQuotaForPlan(getEffectivePlan(profile, referenceTime));
}

export function isPro(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
): boolean {
  return getEffectivePlan(profile, referenceTime) === "pro";
}

export function getQuotaPercent(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
): number {
  const quota = getEffectiveQuota(profile, referenceTime);

  if (!profile || quota <= 0) {
    return 0;
  }

  const used = getEffectiveAIUsed(profile, referenceTime);
  return Math.min(100, Math.round((used / quota) * 100));
}

export function isQuotaLow(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
): boolean {
  return getRemainingAIUses(profile, referenceTime) <= 1 && !isPro(profile);
}

export function isQuotaExhausted(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
): boolean {
  return getRemainingAIUses(profile, referenceTime) <= 0;
}

export function getEffectiveAIUsed(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile) {
    return 0;
  }

  const periodEnd = profile.quota_period_end
    ? Date.parse(profile.quota_period_end)
    : Number.NaN;

  if (!Number.isNaN(periodEnd) && periodEnd < referenceTime) {
    return 0;
  }

  return Math.max(0, profile.ai_used);
}

export function getRemainingAIUses(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile) {
    return 0;
  }

  return Math.max(
    0,
    getEffectiveQuota(profile, referenceTime) -
      getEffectiveAIUsed(profile, referenceTime),
  );
}

export function hasRemainingAIUsage(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  return getRemainingAIUses(profile, referenceTime) > 0;
}

export function getQuotaWindow(referenceTime = Date.now()) {
  const start = new Date(referenceTime);
  const end = new Date(referenceTime);
  end.setDate(end.getDate() + QUOTA_WINDOW_DAYS);

  return {
    quota_period_end: end.toISOString(),
    quota_period_start: start.toISOString(),
  };
}

export function shouldResetQuota(
  profile: WorkspaceProfile | null,
  referenceTime = Date.now(),
) {
  if (!profile?.quota_period_end) {
    return true;
  }

  const periodEnd = Date.parse(profile.quota_period_end);
  return Number.isNaN(periodEnd) || periodEnd < referenceTime;
}

export function getPlanBadgeLabel(profile: WorkspaceProfile | null) {
  if (!profile) {
    return "GUEST";
  }

  return getEffectivePlan(profile).toUpperCase();
}
