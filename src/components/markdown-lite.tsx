import type { ReactNode } from "react";

/**
 * Small, dependency-free Markdown renderer for model output. It intentionally
 * supports only safe block/inline constructs and never injects HTML.
 */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-[#1d2939]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${index}`}
          className="rounded bg-[#f2f4f7] px-1 py-0.5 font-mono text-[0.78em] text-[#5925dc]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
    index += 1;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function MarkdownLite({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let listOrdered = false;

  function flushList() {
    if (list.length === 0) return;
    const items = list.map((item, index) => (
      <li key={`li-${blocks.length}-${index}`} className="pl-1">
        {inline(item, `li-${blocks.length}-${index}`)}
      </li>
    ));
    blocks.push(
      listOrdered ? (
        <ol key={`ol-${blocks.length}`} className="ml-5 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="ml-5 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    list = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const size = heading[1].length <= 2 ? "text-[0.95rem]" : "text-[0.88rem]";
      blocks.push(
        <p key={`h-${blocks.length}`} className={`mt-3 font-semibold text-[#1d2939] ${size}`}>
          {inline(heading[2], `h-${blocks.length}`)}
        </p>,
      );
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      if (list.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      list.push(ordered[1]);
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      if (list.length > 0 && listOrdered) flushList();
      listOrdered = false;
      list.push(bullet[1]);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {inline(line, `p-${blocks.length}`)}
      </p>,
    );
  }
  flushList();

  return <div className="space-y-2 text-[0.84rem] text-[#475467]">{blocks}</div>;
}
