"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { SessionUser } from "@nodedr-restaurant/types";
import { hasPermission } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import { useNavBadges } from "@/hooks/use-nav-badges";
import { NavDot } from "./nav-dot";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "./nav-items";

const KEY = "orderrestro.nav.open";

function readOpen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function SidebarNav({
  user,
  onNavigate,
  collapsed = false,
}: {
  user?: SessionUser;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const badges = useNavBadges();
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    const id = setTimeout(() => setOpen(readOpen()), 0);
    return () => clearTimeout(id);
  }, []);

  const allowed = NAV_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission));
  const byHref = new Map(allowed.map((i) => [i.href, i]));
  const top = allowed.find((i) => i.href === "/dashboard");
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.hrefs.map((h) => byHref.get(h)).filter((i): i is NavItem => !!i),
  })).filter((g) => g.items.length > 0);
  // Anything not placed in a group still shows, so a new page is never hidden.
  const placed = new Set(["/dashboard", ...NAV_GROUPS.flatMap((g) => g.hrefs)]);
  const rest = allowed.filter((i) => !placed.has(i.href));

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });

  function renderItem(item: NavItem, nested: boolean) {
    const isActive = !!pathname?.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        title={collapsed ? t(item.labelKey) : undefined}
        aria-label={collapsed ? t(item.labelKey) : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          nested && !collapsed && "ml-3 py-1.5",
          collapsed && "justify-center px-0 py-2.5",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        {!collapsed && t(item.labelKey)}
        {badges.nav[item.href] && !isActive ? <NavDot /> : null}
      </Link>
    );
  }

  return (
    <nav aria-label="Sections" className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
      {top && renderItem(top, false)}
      {groups.map((g) => {
        const hasActive = g.items.some((i) => pathname?.startsWith(i.href));
        const isOpen = open.includes(g.id) || hasActive;
        const Icon = g.icon;
        const alert = g.items.some((i) => badges.nav[i.href] && !pathname?.startsWith(i.href));
        // Compact rail: no headings, just a thin divider between sections. Hover opens the full sidebar.
        if (collapsed) {
          return (
            <div key={g.id} className="mt-1 flex flex-col gap-1 border-t border-sidebar-border/60 pt-1">
              {g.items.map((i) => renderItem(i, false))}
            </div>
          );
        }
        const panel = `nav-group-${g.id}`;
        return (
          <div key={g.id} className="mt-1">
            <button
              type="button"
              onClick={() => toggle(g.id)}
              aria-expanded={isOpen}
              aria-controls={panel}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="flex-1 truncate">{t(g.labelKey)}</span>
              {alert && !isOpen ? <NavDot className="ml-0" /> : null}
              <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none", isOpen && "rotate-180")} />
            </button>
            <div
              id={panel}
              hidden={!isOpen}
              className="mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border/60 pl-1 ml-5"
            >
              {g.items.map((i) => renderItem(i, true))}
            </div>
          </div>
        );
      })}
      {rest.map((i) => renderItem(i, false))}
    </nav>
  );
}
