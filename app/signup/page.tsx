import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
import { signup } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/planner");

  return <AuthForm mode="signup" action={signup} />;
}
