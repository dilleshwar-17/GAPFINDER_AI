import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Quote } from "lucide-react";
import type {
  CitationView,
  TopicClassification,
} from "@/lib/domain/types";
import { masteryBandLabel } from "@/lib/domain/mastery";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "weak" | "developing" | "strong" | "neutral" | "demo" | "outline";
  className?: string;
}) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function MasteryBadge({
  classification,
  sufficient = true,
}: {
  classification: TopicClassification;
  sufficient?: boolean;
}) {
  if (classification === "not_assessed" || !sufficient) {
    return <Badge tone="neutral">Not assessed</Badge>;
  }
  const tone =
    classification === "weak"
      ? "weak"
      : classification === "developing"
        ? "developing"
        : "strong";
  return <Badge tone={tone}>{masteryBandLabel(classification)}</Badge>;
}

export function DemoBadge() {
  return <Badge tone="demo">Demo data</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return <Badge tone="strong">Indexed</Badge>;
  if (status === "failed") return <Badge tone="weak">Failed</Badge>;
  if (status === "processing") return <Badge tone="developing">Processing</Badge>;
  if (status === "submitted") return <Badge tone="strong">Submitted</Badge>;
  if (status === "in_progress") return <Badge tone="developing">In progress</Badge>;
  if (status === "completed") return <Badge tone="strong">Completed</Badge>;
  if (status === "pending") return <Badge tone="outline">Pending</Badge>;
  return <Badge tone="neutral">{status.replace(/_/g, " ")}</Badge>;
}

export function Meter({
  value,
  classification,
  label,
}: {
  value: number | null;
  classification?: TopicClassification;
  label?: string;
}) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone =
    classification === "weak"
      ? "meter-weak"
      : classification === "developing"
        ? "meter-developing"
        : classification === "strong"
          ? "meter-strong"
          : "";
  return (
    <div
      className={`meter ${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? 0 : safe}
      aria-label={label ?? (value === null ? "No mastery estimate yet" : `${safe}% mastery`)}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[0.69rem] font-semibold uppercase tracking-[0.09em] text-[#65756d]">{label}</p>
      <div className="stat-value mt-2">{value}</div>
      {detail ? <div className="mt-1.5 text-xs text-[#68756d]">{detail}</div> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="card block p-4 transition hover:border-[#b9cdbf]">
        {body}
      </Link>
    );
  }
  return <div className="card p-4">{body}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-[1.85rem] leading-tight sm:text-[2.2rem]">{title}</h1>
        {description ? (
          <div className="mt-2 max-w-2xl text-[0.91rem] leading-relaxed text-[#5f6f66]">
            {description}
          </div>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#6b7a71]">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionHeading({
  title,
  description,
  action,
  level = 2,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Heading className={level === 2 ? "text-[1.15rem]" : "text-[1rem]"}>{title}</Heading>
        {description ? <p className="mt-1 text-[0.82rem] text-[#68756d]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`card flex flex-col items-start gap-3 border-dashed bg-[#fcfcf8] ${compact ? "p-4" : "p-7"}`}
    >
      {icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f1ea] text-[#176b50]">
          {icon}
        </span>
      ) : null}
      <div>
        <h3 className="text-[1rem]">{title}</h3>
        <div className="mt-1 max-w-xl text-[0.85rem] leading-relaxed text-[#68756d]">{description}</div>
      </div>
      {action}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "gold";
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    info: "border-[#cfe0e9] bg-[#f1f7fa] text-[#2c5265]",
    warning: "border-[#ecd8af] bg-[#fbf5e8] text-[#6f5117]",
    danger: "border-[#ecc8c1] bg-[#fbf0ed] text-[#7f2f24]",
    success: "border-[#bcded0] bg-[#f0f9f4] text-[#14533f]",
    gold: "border-[#e8d6a8] bg-[#faf6ea] text-[#68531e]",
  }[tone];
  return (
    <div className={`rounded-[10px] border px-4 py-3 text-[0.84rem] leading-relaxed ${styles}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function CitationList({
  citations,
  title = "Sources",
  compact = false,
}: {
  citations: CitationView[];
  title?: string;
  compact?: boolean;
}) {
  if (citations.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <ul className="space-y-2">
        {citations.map((citation) => (
          <li key={`${citation.chunkId}-${citation.documentId}`} className="citation">
            <div className="flex items-start gap-2">
              <Quote size={13} className="mt-0.5 shrink-0 text-[#49806b]" aria-hidden />
              <div className="min-w-0">
                <p className="text-[0.76rem] font-semibold text-[#275544]">
                  {citation.documentTitle}
                  <span className="font-normal text-[#6a7a71]">
                    {citation.pageNumber === null ? " · page not available" : ` · page ${citation.pageNumber}`}
                    {citation.sectionHeading ? ` · ${citation.sectionHeading}` : ""}
                  </span>
                </p>
                {!compact ? (
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-[#4e6056]">{citation.excerpt}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SourceLinks({
  citations,
}: {
  citations: Array<{ documentId: string; documentTitle: string; pageNumber: number | null }>;
}) {
  if (citations.length === 0) return null;
  const unique = citations.filter(
    (citation, index, list) =>
      list.findIndex((entry) => entry.documentId === citation.documentId) === index,
  );
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {unique.map((citation) => (
        <Link
          key={citation.documentId}
          href={`/materials/${citation.documentId}`}
          className="inline-flex items-center gap-1 text-[0.76rem] font-medium text-[#176b50] hover:underline"
        >
          {citation.documentTitle}
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      ))}
    </div>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-[0.75rem] text-[#74837a]">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden>/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-[#176b50] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-[#46564d]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function DemoBanner() {
  return (
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#e8d6a8] bg-[#faf4e2] px-4 py-2.5 text-[0.78rem] text-[#6b531b]">
      <p>
        <strong className="font-semibold">DEMO WORKSPACE</strong> — You are exploring seeded sample learning data.
        Sample results are not a real student&apos;s outcomes.
      </p>
      <Link href="/demo-access" className="font-semibold underline decoration-[#c8ac6a] underline-offset-2">
        About this demo
      </Link>
    </div>
  );
}

export function InlineMeterLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[0.7rem] text-[#6a7970]">
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#b44b3b]" /> Weak</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#c08a2c]" /> Developing</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#2fa77a]" /> Strong</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#cbd5cd]" /> Not assessed</span>
    </div>
  );
}

export function ScoreDisplay({
  score,
  total,
  size = "md",
}: {
  score: number | null;
  total: number;
  size?: "sm" | "md" | "lg";
}) {
  const percentage =
    score === null || total === 0 ? null : Math.round((score / total) * 100);
  const sizeClass = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-display font-semibold tracking-tight ${sizeClass}`}>
        {score === null ? "—" : `${Math.round(score * 10) / 10}`}
      </span>
      <span className="text-xs text-[#68756d]">/ {total} marks{percentage === null ? "" : ` · ${percentage}%`}</span>
    </span>
  );
}

export function BarChart({
  data,
  label,
}: {
  data: Array<{ label: string; value: number | null; caption?: string }>;
  label: string;
}) {
  const max = 100;
  return (
    <div role="img" aria-label={label}>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.78rem]">
              <span className="truncate text-[#3f5147]">{item.label}</span>
              <span className="shrink-0 font-mono text-[0.72rem] text-[#68756d]">
                {item.value === null ? "not assessed" : `${item.value}%`}
                {item.caption ? ` · ${item.caption}` : ""}
              </span>
            </div>
            <Meter value={item.value} classification={item.value === null ? undefined : item.value <= 49 ? "weak" : item.value <= 79 ? "developing" : "strong"} label={`${item.label} mastery`} />
          </div>
        ))}
      </div>
      <span className="sr-only">Scale 0 to {max} percent.</span>
    </div>
  );
}

export function Sparkline({
  points,
  label,
}: {
  points: number[];
  label: string;
}) {
  if (points.length < 2) return null;
  const width = 180;
  const height = 44;
  const step = width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - (Math.max(0, Math.min(100, point)) / 100) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-11 w-full max-w-[220px]"
      role="img"
      aria-label={`${label}: ${points.join("%, ")}%`}
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="#2fa77a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#e1e7e1" strokeWidth="1" />
    </svg>
  );
}
