"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  ClipboardCheck,
  FileStack,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Settings,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const sections = [
  {
    label: "Study loop",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/subjects", label: "Subjects", icon: GraduationCap },
      { href: "/materials", label: "Materials", icon: FileStack },
    ],
  },
  {
    label: "Diagnose & plan",
    items: [
      { href: "/diagnostics", label: "Diagnostics", icon: ClipboardCheck },
      { href: "/reports", label: "Gap reports", icon: Target },
      { href: "/revision-plan", label: "Revision plan", icon: BookOpen },
    ],
  },
  {
    label: "Learn & review",
    items: [
      { href: "/assistant", label: "BUDDY", icon: MessageSquareText },
      { href: "/progress", label: "Progress", icon: ChartNoAxesCombined },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="mt-6 space-y-5">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="nav-section mb-1.5">{section.label}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="nav-link"
                  data-active={isActive(pathname, item.href) ? "true" : undefined}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                >
                  <item.icon size={15} aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({
  displayName,
  isDemo,
  isReadOnlyDemo,
}: {
  displayName: string;
  isDemo: boolean;
  isReadOnlyDemo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <div className="mobile-workspace-bar flex h-14 items-center justify-between border-b border-[#eaecf0] px-4">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={15} aria-hidden /> : <Menu size={15} aria-hidden />}
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Workspace"
          className="mobile-workspace-menu border-b border-[#eaecf0] px-4 pb-4 pt-3"
        >
          <p className="mb-2 text-[0.72rem] text-[#98a2b3]">
            {displayName}
            {isDemo ? (isReadOnlyDemo ? " · shared demo" : " · interactive demo") : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="nav-section mb-1">{section.label}</p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="nav-link"
                        data-active={isActive(pathname, item.href) ? "true" : undefined}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      >
                        <item.icon size={15} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
