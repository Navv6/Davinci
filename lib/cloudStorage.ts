import { getSessionAuthUser } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { getQuotaForPlan } from "@/lib/aiUsage";
import type { SavedGraph } from "@/lib/storage";
import type { GraphSeed } from "@/types/davinci";
import type { Database, Json } from "@/types/supabase";

type GraphRow = Database["public"]["Tables"]["graphs"]["Row"];
type GraphInsert = Database["public"]["Tables"]["graphs"]["Insert"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SupporterRequestRow = Database["public"]["Tables"]["supporter_requests"]["Row"];

export type WorkspaceGraphSummary = Pick<
  GraphRow,
  | "archived_at"
  | "created_at"
  | "id"
  | "is_favorite"
  | "saved_at"
  | "title"
  | "topic"
  | "updated_at"
  | "user_id"
>;

export type CloudGraph = WorkspaceGraphSummary & {
  memo: string;
  seed: GraphSeed;
};

export type WorkspaceProfile = Pick<
  ProfileRow,
  | "ai_quota"
  | "ai_used"
  | "cancel_at_period_end"
  | "created_at"
  | "current_period_end"
  | "plan"
  | "pro_expires_at"
  | "quota_period_end"
  | "quota_period_start"
  | "stripe_customer_id"
  | "stripe_status"
  | "stripe_subscription_id"
  | "subscription_status"
  | "updated_at"
  | "user_id"
>;

export type SupporterRequestStatus =
  | "expired"
  | "pending"
  | "rejected"
  | "verified";

export type SupporterRequest = Pick<
  SupporterRequestRow,
  | "created_at"
  | "depositor_name"
  | "email"
  | "id"
  | "memo"
  | "proof_url"
  | "status"
  | "support_amount"
  | "supporter_name"
  | "updated_at"
  | "user_id"
  | "verified_at"
  | "verified_by"
>;

type CreateGraphPayload = {
  memo: string;
  seed: GraphSeed;
  title: string;
  topic: string;
};

type UpdateGraphPayload = Partial<CreateGraphPayload> & {
  savedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isValidGraphSeed(value: unknown): value is GraphSeed {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.rootId === "number" &&
    typeof value.nextId === "number" &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges)
  );
}

function mapGraph(row: GraphRow): CloudGraph | null {
  if (!isValidGraphSeed(row.seed)) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    topic: row.topic,
    memo: row.memo,
    seed: row.seed,
    saved_at: row.saved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    is_favorite: row.is_favorite,
  };
}

function toSummary(graph: CloudGraph): WorkspaceGraphSummary {
  return {
    archived_at: graph.archived_at,
    created_at: graph.created_at,
    id: graph.id,
    is_favorite: graph.is_favorite,
    saved_at: graph.saved_at,
    title: graph.title,
    topic: graph.topic,
    updated_at: graph.updated_at,
    user_id: graph.user_id,
  };
}

export function sortWorkspaceGraphs(items: WorkspaceGraphSummary[]) {
  return [...items].sort((left, right) => {
    if (left.is_favorite !== right.is_favorite) {
      return left.is_favorite ? -1 : 1;
    }

    return Date.parse(right.updated_at) - Date.parse(left.updated_at);
  });
}

async function getAuthenticatedClient() {
  const client = getSupabaseBrowserClient();
  const authUser = await getSessionAuthUser();

  if (!client || !authUser) {
    return null;
  }

  return { authUser, client };
}

function getDefaultQuotaWindow() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 30);

  return {
    quota_period_end: end.toISOString(),
    quota_period_start: start.toISOString(),
  };
}

function buildFallbackProfile(userId: string): WorkspaceProfile {
  const now = new Date().toISOString();
  const quotaWindow = getDefaultQuotaWindow();

  return {
    ai_quota: getQuotaForPlan("free"),
    ai_used: 0,
    cancel_at_period_end: false,
    created_at: now,
    current_period_end: null,
    plan: "free",
    pro_expires_at: null,
    quota_period_end: quotaWindow.quota_period_end,
    quota_period_start: quotaWindow.quota_period_start,
    stripe_customer_id: null,
    stripe_status: null,
    stripe_subscription_id: null,
    subscription_status: "inactive",
    updated_at: now,
    user_id: userId,
  };
}

export async function ensureProfileInCloud() {
  const context = await getAuthenticatedClient();

  if (!context) {
    return null;
  }

  const { authUser, client } = context;
  const now = new Date().toISOString();
  const quotaWindow = getDefaultQuotaWindow();

  const { error } = await client.from("profiles").upsert(
    {
      user_id: authUser.id,
      plan: "free",
      subscription_status: "inactive",
      ai_quota: getQuotaForPlan("free"),
      ai_used: 0,
      updated_at: now,
      ...quotaWindow,
    },
    {
      onConflict: "user_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.warn("[Profile Ensure]", error.message);
    return null;
  }

  const { data, error: loadError } = await client
    .from("profiles")
    .select(
      "ai_quota, ai_used, cancel_at_period_end, created_at, current_period_end, plan, pro_expires_at, quota_period_end, quota_period_start, stripe_customer_id, stripe_status, stripe_subscription_id, subscription_status, updated_at, user_id",
    )
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (loadError) {
    console.warn("[Profile Load]", loadError.message);
    return buildFallbackProfile(authUser.id);
  }

  return (data ?? buildFallbackProfile(authUser.id)) satisfies WorkspaceProfile | null;
}

export async function loadLatestSupporterRequestInCloud() {
  const context = await getAuthenticatedClient();

  if (!context) {
    return null;
  }

  const { authUser, client } = context;
  const { data, error } = await client
    .from("supporter_requests")
    .select(
      "created_at, depositor_name, email, id, memo, proof_url, status, support_amount, supporter_name, updated_at, user_id, verified_at, verified_by",
    )
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[Supporter Request Load]", error.message);
    return null;
  }

  return data satisfies SupporterRequest | null;
}

export async function listGraphsFromCloud() {
  const context = await getAuthenticatedClient();

  if (!context) {
    return [] satisfies WorkspaceGraphSummary[];
  }

  const { authUser, client } = context;

  const { data, error } = await client
    .from("graphs")
    .select(
      "archived_at, created_at, id, is_favorite, saved_at, title, topic, updated_at, user_id",
    )
    .eq("user_id", authUser.id);

  if (error) {
    console.warn("[Cloud Graph List]", error.message);
    return [];
  }

  return sortWorkspaceGraphs(data ?? []);
}

export async function loadGraphFromCloud(graphId: string) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return null;
  }

  const { authUser, client } = context;

  const { data, error } = await client
    .from("graphs")
    .select(
      "archived_at, created_at, id, is_favorite, memo, saved_at, seed, title, topic, updated_at, user_id",
    )
    .eq("user_id", authUser.id)
    .eq("id", graphId)
    .maybeSingle();

  if (error) {
    console.warn("[Cloud Graph Load]", error.message);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapGraph(data);
}

export async function createGraphInCloud(payload: CreateGraphPayload) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return null;
  }

  const { authUser, client } = context;
  const now = new Date().toISOString();
  const insertPayload: GraphInsert = {
    archived_at: null,
    created_at: now,
    is_favorite: false,
    memo: payload.memo,
    saved_at: now,
    seed: payload.seed as Json,
    title: payload.title,
    topic: payload.topic,
    updated_at: now,
    user_id: authUser.id,
  };

  const { data, error } = await client
    .from("graphs")
    .insert(insertPayload)
    .select(
      "archived_at, created_at, id, is_favorite, memo, saved_at, seed, title, topic, updated_at, user_id",
    )
    .single();

  if (error) {
    console.warn("[Cloud Graph Create]", error.message);
    return null;
  }

  return mapGraph(data);
}

export async function updateGraphInCloud(graphId: string, payload: UpdateGraphPayload) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return null;
  }

  const { authUser, client } = context;
  const now = new Date().toISOString();
  const updatePayload: Database["public"]["Tables"]["graphs"]["Update"] = {
    updated_at: now,
  };

  if (typeof payload.memo === "string") {
    updatePayload.memo = payload.memo;
  }

  if (payload.seed) {
    updatePayload.seed = payload.seed as Json;
  }

  if (typeof payload.title === "string") {
    updatePayload.title = payload.title;
  }

  if (typeof payload.topic === "string") {
    updatePayload.topic = payload.topic;
  }

  if (typeof payload.savedAt === "string") {
    updatePayload.saved_at = payload.savedAt;
  }

  const { data, error } = await client
    .from("graphs")
    .update(updatePayload)
    .eq("user_id", authUser.id)
    .eq("id", graphId)
    .select(
      "archived_at, created_at, id, is_favorite, memo, saved_at, seed, title, topic, updated_at, user_id",
    )
    .maybeSingle();

  if (error) {
    console.warn("[Cloud Graph Update]", error.message);
    return null;
  }

  return data ? mapGraph(data) : null;
}

export async function archiveGraphInCloud(graphId: string) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return false;
  }

  const { authUser, client } = context;
  const { error } = await client
    .from("graphs")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", authUser.id)
    .eq("id", graphId);

  if (error) {
    console.warn("[Cloud Graph Archive]", error.message);
    return false;
  }

  return true;
}

export async function deleteGraphInCloud(graphId: string) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return false;
  }

  const { authUser, client } = context;
  const { error } = await client
    .from("graphs")
    .delete()
    .eq("user_id", authUser.id)
    .eq("id", graphId);

  if (error) {
    console.warn("[Cloud Graph Delete]", error.message);
    return false;
  }

  return true;
}

export async function toggleFavoriteGraphInCloud(graphId: string, value: boolean) {
  const context = await getAuthenticatedClient();

  if (!context) {
    return false;
  }

  const { authUser, client } = context;
  const { error } = await client
    .from("graphs")
    .update({
      is_favorite: value,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", authUser.id)
    .eq("id", graphId);

  if (error) {
    console.warn("[Cloud Graph Favorite]", error.message);
    return false;
  }

  return true;
}

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function syncGraphToCloud(data: SavedGraph) {
  if (!isSupabaseConfigured() || !data.graphId || data.graphId === "guest") {
    return;
  }

  const existing = syncTimers.get(data.graphId);

  if (existing) {
    clearTimeout(existing);
  }

  syncTimers.set(
    data.graphId,
    setTimeout(() => {
      syncTimers.delete(data.graphId);
      void updateGraphInCloud(data.graphId, {
        memo: data.memo,
        savedAt: data.savedAt,
        seed: data.seed,
        title: data.title,
        topic: data.topic,
      });
    }, 1500),
  );
}

export function toSavedGraph(graph: CloudGraph): SavedGraph {
  return {
    graphId: graph.id,
    memo: graph.memo,
    savedAt: graph.saved_at,
    seed: graph.seed,
    title: graph.title,
    topic: graph.topic,
  };
}

export function toWorkspaceGraphSummary(graph: CloudGraph) {
  return toSummary(graph);
}
