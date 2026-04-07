"use client";

import posthog from "posthog-js";

let posthogInitialized = false;

function getPostHogConfig() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  };
}

export function initPostHog() {
  if (typeof window === "undefined" || posthogInitialized) {
    return;
  }

  const config = getPostHogConfig();

  if (!config) {
    return;
  }

  posthog.init(config.apiKey, {
    api_host: config.apiHost,
    capture_pageleave: false,
    capture_pageview: false,
    person_profiles: "identified_only",
  });

  posthogInitialized = true;
}

export function identifyClientUser(
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  initPostHog();

  if (!posthogInitialized) {
    return;
  }

  posthog.identify(distinctId, properties);
}

export function resetClientTelemetry() {
  if (typeof window === "undefined" || !posthogInitialized) {
    return;
  }

  posthog.reset();
}

export function trackClientEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  initPostHog();

  if (!posthogInitialized) {
    return;
  }

  posthog.capture(event, properties);
}
