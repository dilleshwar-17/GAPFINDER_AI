import Link from "next/link";

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="GapFinder AI home">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-[11px] ${
          dark ? "text-white" : "bg-white/10 text-white ring-1 ring-white/15"
        }`}
        style={dark ? { backgroundImage: "var(--brand-gradient)" } : undefined}
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <path
            d="M8 22V11a3 3 0 0 1 3-3h6"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.92"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M24 10v11a3 3 0 0 1-3 3h-6"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.55"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="2.2" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`text-[1rem] font-bold tracking-[-0.02em] ${
            dark ? "text-[#101828]" : "text-white"
          }`}
        >
          GapFinder{" "}
          <span className={dark ? "text-[#2563eb]" : "text-[#bfdbfe]"}>AI</span>
        </span>
        <span
          className={`mt-1 text-[0.56rem] font-medium uppercase tracking-[0.16em] ${
            dark ? "text-[#667085]" : "text-[#98a2b3]"
          }`}
        >
          Evidence-grounded study
        </span>
      </span>
    </Link>
  );
}
