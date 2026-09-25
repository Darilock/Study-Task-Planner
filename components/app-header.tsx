import Link from "next/link";
import { logout } from "@/app/auth/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/classes", label: "Classes", page: "classes" },
] as const;

type Props = { current: (typeof NAV)[number]["page"]; email: string | undefined };

export function AppHeader({ current, email }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <nav aria-label="Main" className="-ml-3 flex">
            {NAV.map((item) => {
              const active = item.page === current;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 text-lg font-semibold ${
                    active
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="truncate text-xs text-zinc-500">{email}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
