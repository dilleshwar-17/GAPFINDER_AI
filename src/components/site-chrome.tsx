import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e4e9e0] bg-[#f7f7f1]/92 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="hidden items-center gap-6 text-[0.82rem] text-[#4b5c52] md:flex">
          <Link href="/#method" className="hover:text-[#176b50]">
            Method
          </Link>
          <Link href="/#workflow" className="hover:text-[#176b50]">
            Workflow
          </Link>
          <Link href="/demo-access" className="hover:text-[#176b50]">
            Demo
          </Link>
          <Link href="/privacy" className="hover:text-[#176b50]">
            Privacy
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost btn-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Get started
            <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[#e4e9e0] bg-[#f2f3ec]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Brand />
            <p className="mt-3 text-[0.8rem] leading-relaxed text-[#66766d]">
              A study-diagnosis tool that grounds every question and explanation in the material you
              upload. It reports evidence, not certainty.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[0.8rem] text-[#526158] sm:grid-cols-3">
            <Link href="/demo-access" className="hover:text-[#176b50]">Demo access</Link>
            <Link href="/privacy" className="hover:text-[#176b50]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#176b50]">Terms</Link>
            <Link href="/login" className="hover:text-[#176b50]">Sign in</Link>
            <Link href="/signup" className="hover:text-[#176b50]">Create account</Link>
            <Link href="/forgot-password" className="hover:text-[#176b50]">Password help</Link>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e5dc] pt-5 text-[0.7rem] text-[#7a877f]">
          <p>© {new Date().getUTCFullYear()} GapFinder AI. Educational decision support, not an official grade.</p>
          <p className="font-mono uppercase tracking-[0.13em]">Built for evidence, not guesswork</p>
        </div>
      </div>
    </footer>
  );
}
