"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/observability/posthog-client";

export function PostHogInit() {
  useEffect(() => {
    initPostHog();
  }, []);

  return null;
}
