import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/planner");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Study Task Planner</h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Keep track of assignments, readings, and revision sessions in one place.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
        <Link href="/signup" className="btn-primary">
          Get started
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
