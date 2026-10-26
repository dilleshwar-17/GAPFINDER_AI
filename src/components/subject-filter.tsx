import Link from "next/link";

interface SubjectOption {
  id: string;
  name: string;
}

/**
 * Shared subject switcher used by the workspace views.
 * Renders as a nav with visible active state and a keyboard-friendly focus ring.
 */
export function SubjectFilter({
  basePath,
  subjects,
  selectedId,
  showAll = false,
  className = "",
}: {
  basePath: string;
  subjects: SubjectOption[];
  selectedId: string | null;
  showAll?: boolean;
  className?: string;
}) {
  return (
    <nav aria-label="Filter by subject" className={`filter-bar mb-5 ${className}`.trim()}>
      {showAll ? (
        <Link
          href={basePath}
          className="filter-pill"
          data-active={selectedId === null}
          aria-current={selectedId === null ? "page" : undefined}
        >
          All subjects
        </Link>
      ) : null}
      {subjects.map((subject) => {
        const active = subject.id === selectedId;
        return (
          <Link
            key={subject.id}
            href={`${basePath}?subject=${subject.id}`}
            className="filter-pill"
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            {subject.name}
          </Link>
        );
      })}
    </nav>
  );
}
