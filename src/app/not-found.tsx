import Link from "next/link";
import { Compass, Home, MessageSquareText } from "lucide-react";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-16">
      <Brand />
      <p className="eyebrow mt-10 mb-2">404 · Not found</p>
      <h1 className="text-[2.1rem] leading-tight">This page is not in the workspace.</h1>
      <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-[#475467]">
        The link may be old, the item may have been deleted, or the page belongs to another account.
        Nothing is shown across accounts, so an unowned item returns the same 404 as a missing one.
      </p>

      <div className="mt-7 flex flex-wrap gap-2">
        <Link href="/dashboard" className="btn btn-primary">
          <Home size={15} aria-hidden />
          Go to dashboard
        </Link>
        <Link href="/subjects" className="btn btn-secondary">
          <Compass size={15} aria-hidden />
          Browse subjects
        </Link>
        <Link href="/assistant" className="btn btn-ghost">
          <MessageSquareText size={15} aria-hidden />
          BUDDY
        </Link>
      </div>

      <div className="card mt-10 p-5">
        <h2 className="text-[0.95rem]">Looking for the shared demo?</h2>
        <p className="mt-1.5 text-[0.82rem] leading-relaxed text-[#667085]">
          The demo is a sample, read-only workspace. Opening it provisions a verified session for this
          browser; no password is published.
        </p>
        <Link href="/demo-access" className="btn btn-gold btn-sm mt-3">
          Open demo access
        </Link>
      </div>
    </main>
  );
}
