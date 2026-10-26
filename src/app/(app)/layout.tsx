import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { requirePageUser } from "@/lib/auth/page";
import { Brand } from "@/components/brand";
import { MobileNav, SidebarNav } from "@/components/app-nav";
import { LogoutButton } from "@/components/auth-forms";
import { DemoBanner } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[#f7f7f1] lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col overflow-y-auto bg-[#12382d] px-4 py-5 lg:flex">
        <div className="px-1">
          <Brand tone="light" />
        </div>

        <Link href="/diagnostics" className="btn btn-gold btn-sm mt-5 w-full justify-center">
          <Plus size={14} aria-hidden />
          New diagnostic
        </Link>

        <SidebarNav />

        <div className="mt-auto space-y-3 pt-6">
          <div className="rounded-lg border border-[#2c5746] bg-[#174535]/70 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2fa77a]/20 font-mono text-[0.66rem] font-semibold text-[#c4e8d6]">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-medium text-[#eef4ee]">{user.displayName}</p>
                <p className="truncate text-[0.66rem] text-[#9db2a6]">
                  {user.isDemo ? "Shared demo" : user.email}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <Link
                href="/settings"
                className="text-[0.68rem] text-[#aec7b7] underline-offset-2 hover:text-white hover:underline"
              >
                Settings
              </Link>
              <span className="text-[#aec7b7]">
                <LogoutButton compact />
              </span>
            </div>
          </div>
          <p className="px-1 text-[0.62rem] leading-relaxed text-[#799284]">
            Mastery bands are provisional heuristics. Check the cited source before relying on a
            diagnosis.
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <MobileNav displayName={user.displayName} isDemo={user.isDemo} />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">
            {user.isDemo ? <DemoBanner /> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
