"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Home,
  LogOut,
  Users,
  UserRound,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/analytics", label: "Insights", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-5xl grid-cols-6 gap-0 px-1 pt-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors duration-150",
                  active
                    ? "text-primary"
                    : "text-muted active:bg-surface active:text-ink"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <form action={logoutAction} className="h-full">
            <button
              type="submit"
              className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium text-muted transition-colors duration-150 active:bg-surface active:text-ink"
            >
              <LogOut className="h-5 w-5" strokeWidth={2} />
              <span className="leading-none">Log out</span>
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
