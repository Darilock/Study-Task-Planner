import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
import { login } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/calendar");

  const { error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={login}
      initialError={typeof error === "string" ? error : undefined}
    />
  );
}
