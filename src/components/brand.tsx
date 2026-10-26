import Link from "next/link";

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="GapFinder AI home">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-[9px] ${
          dark ? "bg-[#12382d]" : "bg-[#f7f7f1]"
        }`}
      >
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <path
            d="M8 22V11a3 3 0 0 1 3-3h6"
            fill="none"
            stroke="#d7b56d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M24 10v11a3 3 0 0 1-3 3h-6"
            fill="none"
            stroke="#2fa77a"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="16" cy="16" r="2.2" fill={dark ? "#f7f7f1" : "#12382d"} />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={`text-[0.98rem] font-semibold tracking-tight ${dark ? "text-[#12382d]" : "text-[#f7f7f1]"}`}>
          GapFinder <span className="text-[#2fa77a]">AI</span>
        </span>
        <span className={`mt-0.5 font-mono text-[0.54rem] uppercase tracking-[0.19em] ${dark ? "text-[#718078]" : "text-[#9db2a6]"}`}>
          Evidence-grounded study
        </span>
      </span>
    </Link>
  );
}
