import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type AuthUser = {
  email: string | null;
  id: string;
};

function mapUser(user: User | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

export async function getCurrentAuthUser() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    console.warn("[Auth]", error.message);
    return null;
  }

  return mapUser(user);
}

export async function getAccessToken(): Promise<string | null> {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  return session?.access_token ?? null;
}

export async function getSessionAuthUser() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  return mapUser(session?.user ?? null);
}

export function subscribeToAuthState(callback: (user: AuthUser | null) => void) {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(mapUser(session?.user ?? null));
  });

  return () => subscription.unsubscribe();
}

export async function signInWithGoogle() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const client = getSupabaseBrowserClient();

  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }
}
