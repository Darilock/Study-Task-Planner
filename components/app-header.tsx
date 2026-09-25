import Link from "next/link";
import { logout } from "@/app/auth/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", page: "dashboard" },
  { href: "/classes", label: "Classes", page: "classes" },
  { href: "/grades", label: "Grades", page: "grades" },
] as const;

type Props = { current: (typeof NAV)[number]["page"]; email: string | undefined };

export function AppHeader({ current, email }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2">
        <div className="min-w-0">
          <nav aria-label="Main" className="-ml-2 flex">
            {NAV.map((item) => {
              const active = item.page === current;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-2 text-[15px] font-semibold sm:px-3 sm:text-lg ${
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
            aria-label="Log out"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:px-3 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {/* Icon only on narrow screens so all three tabs fit. */}
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 sm:hidden" aria-hidden>
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Log out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
