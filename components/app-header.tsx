import Link from "next/link";
import { logout } from "@/app/auth/actions";

// Simple 24px stroke icons for the phone tab bar.
const ICONS = {
  planner: <path d="M10 6h10M10 12h10M10 18h10M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" />,
  classes: <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19" />,
  calendar: <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 10h18M8 3v4M16 3v4" />,
};

const NAV = [
  { href: "/calendar", label: "Calendar", page: "calendar" },
  { href: "/planner", label: "Planner", page: "planner" },
  { href: "/classes", label: "Classes & Grades", page: "classes" },
] as const;

type Props = {
  current: (typeof NAV)[number]["page"];
  email: string | undefined;
  /** Match a page whose content is wider than the default max-w-2xl. */
  wide?: boolean;
};

/**
 * Top bar on every signed-in page. Wide screens get tabs in the header; phones
 * get the page name there and a tab bar fixed to the bottom of the screen.
 * Pages add the `app-main` class to their <main> to leave room for that bar.
 */
export function AppHeader({ current, email, wide = false }: Props) {
  const currentLabel = NAV.find((item) => item.page === current)?.label;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-2 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
          <div className="min-w-0">
            <p className="flex min-h-11 items-center text-lg font-semibold sm:hidden">{currentLabel}</p>
            <nav aria-label="Main" className="-ml-3 hidden sm:flex">
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
              aria-label="Log out"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100 sm:px-3 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
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

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-black/90"
      >
        {NAV.map((item) => {
          const active = item.page === current;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2.2 : 1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
                aria-hidden
              >
                {ICONS[item.page]}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
