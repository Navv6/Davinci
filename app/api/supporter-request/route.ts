import { NextResponse } from "next/server";
import { captureServerException } from "@/lib/observability/sentry";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type SupporterRequestBody = {
  depositorName?: string;
  memo?: string;
  proofUrl?: string;
  supportAmount?: number;
  supporterName?: string;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAmount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Number.NaN;
  }

  return Math.round(value);
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

  const supabase = createSupabaseServerClient(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired session." },
      { status: 401 },
    );
  }

  let body: SupporterRequestBody;

  try {
    body = (await request.json()) as SupporterRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supporterName = normalizeText(body.supporterName);
  const depositorName = normalizeText(body.depositorName);
  const memo = normalizeText(body.memo);
  const proofUrl = normalizeText(body.proofUrl);
  const supportAmount = normalizeAmount(body.supportAmount);

  if (!supporterName || !depositorName || Number.isNaN(supportAmount)) {
    return NextResponse.json(
      { error: "Missing required supporter request fields." },
      { status: 400 },
    );
  }

  if (supportAmount < 1000) {
    return NextResponse.json(
      { error: "Support amount must be at least 1000." },
      { status: 400 },
    );
  }

  try {
    const basePayload = {
      depositor_name: depositorName,
      email: user.email ?? "",
      memo: memo || null,
      proof_url: proofUrl || null,
      support_amount: supportAmount,
      supporter_name: supporterName,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    };

    const { data: existingPending, error: pendingError } = await supabase
      .from("supporter_requests")
      .select(
        "id, status, created_at, depositor_name, email, memo, proof_url, support_amount, supporter_name, updated_at, user_id, verified_at, verified_by",
      )
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      throw pendingError;
    }

    if (existingPending) {
      const { data, error } = await supabase
        .from("supporter_requests")
        .update(basePayload)
        .eq("id", existingPending.id)
        .select(
          "id, status, created_at, depositor_name, email, memo, proof_url, support_amount, supporter_name, updated_at, user_id, verified_at, verified_by",
        )
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ request: data });
    }

    const { data, error } = await supabase
      .from("supporter_requests")
      .insert({
        ...basePayload,
        status: "pending",
      })
      .select(
        "id, status, created_at, depositor_name, email, memo, proof_url, support_amount, supporter_name, updated_at, user_id, verified_at, verified_by",
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ request: data });
  } catch (error) {
    captureServerException(error, {
      tags: { route: "supporter_request" },
      user: { email: user.email, id: user.id },
    });

    const message =
      error instanceof Error ? error.message : "Failed to save supporter request.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
