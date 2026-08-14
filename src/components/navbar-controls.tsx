"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Moon, RefreshCw, Sun } from "lucide-react";
import { markNotificationReadAction } from "@/actions/notifications";
import { NotificationActions } from "@/components/notification-actions";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: Date | string;
};

export function NavbarControls({
  notifications,
  unreadCount,
  pendingGroupInviteIds,
  pendingFriendIds,
}: {
  notifications: NavNotification[];
  unreadCount: number;
  pendingGroupInviteIds: string[];
  pendingFriendIds: string[];
}) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function onTab(e: KeyboardEvent) {
      if (e.key !== "Tab" || focusable.length === 0) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onTab);
    first?.focus();
    return () => document.removeEventListener("keydown", onTab);
  }, [open]);

  const dismissed = new Set(dismissedIds);
  const visible = notifications.filter((n) => !n.read && !dismissed.has(n.id));
  const badge = Math.max(
    0,
    unreadCount -
      dismissedIds.filter((id) =>
        notifications.some((n) => n.id === id && !n.read)
      ).length
  );

  const groupSet = new Set(pendingGroupInviteIds);
  const friendSet = new Set(pendingFriendIds);

  function dismissNotification(id: string) {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Refresh"
        title="Refresh"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
      </Button>

      <div className="relative" ref={panelRef}>
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          title="Notifications"
          aria-expanded={open}
          aria-controls={panelId}
          aria-haspopup="dialog"
          onClick={() => setOpen((v) => !v)}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {badge > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-fg">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </Button>

        {open && (
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_40px_var(--shadow)]"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Notifications</p>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {visible.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-muted">
                  You’re all caught up
                </li>
              )}
              {visible.map((n) => {
                const showGroup =
                  n.type === "INVITE" &&
                  n.href?.startsWith("group-invite:") &&
                  groupSet.has(n.href.replace("group-invite:", ""));
                const showFriend =
                  n.type === "FRIEND_INVITE" &&
                  n.href?.startsWith("friend-invite:") &&
                  friendSet.has(n.href.replace("friend-invite:", ""));
                return (
                  <li
                    key={n.id}
                    className="border-b border-border px-4 py-3 text-sm last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{n.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          {n.body}
                        </p>
                        {(showGroup || showFriend) && (
                          <NotificationActions type={n.type} href={n.href} />
                        )}
                      </div>
                      <button
                        type="button"
                        title="Mark as read"
                        aria-label="Mark as read"
                        onClick={() => dismissNotification(n.id)}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors duration-150 hover:bg-bg"
                      >
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        }
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        onClick={toggleTheme}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
