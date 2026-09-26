"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  return { email, password };
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return creds;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(creds);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/planner");
}

export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const creds = readCredentials(formData);
  if ("error" in creds) return creds;
  if (creds.password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const h = await headers();
  const origin =
    h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...creds,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/planner` },
  });
  if (error) return { error: error.message };

  // Email confirmation disabled in the project: the user is signed in already.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/planner");
  }

  return { message: "Check your email for a confirmation link to finish signing up." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
