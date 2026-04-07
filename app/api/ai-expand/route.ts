import OpenAI from "openai";
import { NextResponse } from "next/server";
import { captureServerException } from "@/lib/observability/sentry";
import {
  DEFAULT_FREE_PLAN,
  getEffectivePlan,
  getEffectiveQuota,
  getEffectiveAIUsed,
  getQuotaForPlan,
  getQuotaWindow,
  getRemainingAIUses,
  shouldResetQuota,
} from "@/lib/aiUsage";
import { extractOutlineLabels } from "@/lib/outline";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type { WorkspaceProfile } from "@/lib/cloudStorage";

type ExpandRequest = {
  nodeDescription: string;
  nodeLabel: string;
  outlineText: string;
  topic: string;
};

type IdeaSuggestion = {
  description: string;
  label: string;
};

type ParsedIdeaPayload = {
  ideas?: IdeaSuggestion[];
};

const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

function normalizeLabel(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function sanitizeIdeas(ideas: IdeaSuggestion[], existingLabels: string[]) {
  const existing = new Set(existingLabels.map(normalizeLabel));
  const seen = new Set<string>();

  return ideas
    .filter(
      (idea) =>
        typeof idea?.label === "string" && typeof idea?.description === "string",
    )
    .map((idea) => ({
      label: idea.label.trim().slice(0, 10),
      description: idea.description.trim().slice(0, 80),
    }))
    .filter((idea) => idea.label.length > 0)
    .filter((idea) => {
      const key = normalizeLabel(idea.label);

      if (existing.has(key) || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

async function loadProfile(
  token: string,
  userId: string,
): Promise<WorkspaceProfile | null> {
  const supabase = createSupabaseServerClient(token);
  const quotaWindow = getQuotaWindow();

  await supabase.from("profiles").upsert(
    {
      user_id: userId,
      plan: DEFAULT_FREE_PLAN,
      subscription_status: "inactive",
      ai_quota: getQuotaForPlan(DEFAULT_FREE_PLAN),
      ai_used: 0,
      updated_at: new Date().toISOString(),
      ...quotaWindow,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "ai_quota, ai_used, cancel_at_period_end, created_at, current_period_end, plan, pro_expires_at, quota_period_end, quota_period_start, stripe_customer_id, stripe_status, stripe_subscription_id, subscription_status, updated_at, user_id",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[AI Expand Profile Load]", error.message);
    return null;
  }

  return data;
}

async function upsertUsage(
  token: string,
  profile: WorkspaceProfile,
  nextUsed: number,
) {
  const supabase = createSupabaseServerClient(token);
  const nextWindow = shouldResetQuota(profile) ? getQuotaWindow() : null;

  await supabase.from("profiles").upsert(
    {
      user_id: profile.user_id,
      plan: profile.plan,
      subscription_status: profile.subscription_status,
      ai_quota: getEffectiveQuota(profile),
      ai_used: nextUsed,
      pro_expires_at: profile.pro_expires_at,
      updated_at: new Date().toISOString(),
      quota_period_start:
        nextWindow?.quota_period_start ?? profile.quota_period_start,
      quota_period_end: nextWindow?.quota_period_end ?? profile.quota_period_end,
    },
    { onConflict: "user_id" },
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let userId: string;

  try {
    const supabase = createSupabaseServerClient(token);
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 },
      );
    }

    userId = data.user.id;
  } catch {
    return NextResponse.json(
      { error: "Authentication check failed." },
      { status: 401 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    captureServerException(new Error("AI expand requested without OpenAI API key."), {
      tags: { route: "ai_expand" },
      user: { id: userId },
    });

    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: ExpandRequest;

  try {
    body = (await request.json()) as ExpandRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { nodeDescription, nodeLabel, outlineText, topic } = body;

  if (
    typeof topic !== "string" ||
    typeof nodeLabel !== "string" ||
    typeof nodeDescription !== "string" ||
    typeof outlineText !== "string"
  ) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profile = await loadProfile(token, userId);

  if (!profile) {
    captureServerException(new Error("Failed to load usage profile."), {
      tags: { route: "ai_expand" },
      user: { id: userId },
    });

    return NextResponse.json(
      { error: "Failed to load usage profile." },
      { status: 500 },
    );
  }

  if (getRemainingAIUses(profile) <= 0) {
    return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
  }

  const existingLabels = extractOutlineLabels(outlineText);
  const prompt = [
    "Suggest 3 to 5 child ideas for the selected node.",
    "Respond in Korean.",
    "Return JSON only in this format: {\"ideas\":[{\"label\":\"...\",\"description\":\"...\"}]}",
    "Each label must be 10 characters or fewer.",
    "Each description must be 80 characters or fewer.",
    "Do not repeat labels that already exist in the outline.",
    "",
    `Topic: ${topic}`,
    `Selected node label: ${nodeLabel}`,
    `Selected node description: ${nodeDescription || "(none)"}`,
    "Full node outline:",
    outlineText || "(none)",
  ].join("\n");

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You expand idea maps. Output valid JSON only, with no markdown fences or extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "idea_suggestions",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["label", "description"],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
    });

    const parsedText = response.choices[0]?.message?.content?.trim();

    if (!parsedText) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 500 },
      );
    }

    let ideas: IdeaSuggestion[];

    try {
      const json = JSON.parse(parsedText) as ParsedIdeaPayload;

      if (!Array.isArray(json.ideas)) {
        throw new Error("Missing ideas array.");
      }

      ideas = sanitizeIdeas(json.ideas, existingLabels);
    } catch {
      captureServerException(new Error("Failed to parse AI response."), {
        tags: { route: "ai_expand" },
        user: { id: userId },
        contexts: {
          ai_expand: {
            model: MODEL,
            node_label: nodeLabel,
          },
        },
      });

      return NextResponse.json(
        { error: "Failed to parse AI response." },
        { status: 500 },
      );
    }

    if (ideas.length > 0) {
      const effectiveUsed = getEffectiveAIUsed(profile) + 1;
      await upsertUsage(token, profile, effectiveUsed);
    }

    return NextResponse.json({ ideas });
  } catch (error) {
    captureServerException(error, {
      tags: { route: "ai_expand" },
      user: { id: userId },
      contexts: {
          ai_expand: {
            model: MODEL,
            node_label: nodeLabel,
            profile_plan: getEffectivePlan(profile),
          },
        },
      });

    const message =
      error instanceof Error ? error.message : "Unknown AI expansion error.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
