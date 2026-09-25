"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/**
 * A modal built on <dialog>, so focus trapping and Escape come from the
 * browser. It slides up from the bottom on phones and is centered on wider screens.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-0 text-zinc-900 backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-2xl dark:bg-zinc-950 dark:text-zinc-100"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 py-1 pl-4 pr-1 dark:border-zinc-800">
            <h2 className="min-w-0 truncate font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-5" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      )}
    </dialog>
  );
}
