import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader() {
  return (
    <header className="glass-header sticky top-0 z-40 border-b border-[#eaecf0] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav
          aria-label="Main"
          className="hidden items-center gap-7 text-[0.82rem] font-medium text-[#475467] md:flex"
        >
          <Link href="/#method" className="transition hover:text-[#6938ef]">
            Method
          </Link>
          <Link href="/#buddy" className="transition hover:text-[#6938ef]">
            BUDDY
          </Link>
          <Link href="/demo-access" className="transition hover:text-[#6938ef]">
            Demo
          </Link>
          <Link href="/privacy" className="transition hover:text-[#6938ef]">
            Privacy
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Get started
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
      <nav
        aria-label="Sections"
        className="glass-subnav border-t border-[#eaecf0] md:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-5 overflow-x-auto px-4 py-2 text-[0.76rem] font-medium text-[#475467] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href="/#method" className="shrink-0 py-0.5 transition hover:text-[#6938ef]">
            Method
          </Link>
          <Link href="/#buddy" className="shrink-0 py-0.5 transition hover:text-[#6938ef]">
            BUDDY
          </Link>
          <Link href="/demo-access" className="shrink-0 py-0.5 transition hover:text-[#6938ef]">
            Demo
          </Link>
          <Link href="/privacy" className="shrink-0 py-0.5 transition hover:text-[#6938ef]">
            Privacy
          </Link>
          <Link href="/login" className="shrink-0 py-0.5 transition hover:text-[#6938ef]">
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer relative overflow-hidden text-[#98a2b3]">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-[#7a5af8]/25 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div className="max-w-sm">
            <Brand tone="light" />
            <p className="mt-4 text-[0.82rem] leading-relaxed text-[#98a2b3]">
              A study-diagnosis tool that grounds every question and explanation in the material you
              upload. It reports evidence, not certainty.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-[0.82rem] text-[#98a2b3] sm:grid-cols-3">
            <Link href="/demo-access" className="transition hover:text-white">Demo access</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
            <Link href="/login" className="transition hover:text-white">Sign in</Link>
            <Link href="/signup" className="transition hover:text-white">Create account</Link>
            <Link href="/forgot-password" className="transition hover:text-white">Password help</Link>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#1d2939] pt-6 text-[0.72rem] text-[#667085]">
          <p>© {new Date().getUTCFullYear()} GapFinder AI. Educational decision support, not an official grade.</p>
          <p className="font-medium uppercase tracking-[0.14em]">Built for evidence, not guesswork</p>
        </div>
      </div>
    </footer>
  );
}
