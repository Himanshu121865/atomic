import type { ReactNode } from "react";

export function Disclosure({
  summary,
  tone = "note",
  children,
}: {
  summary: string;
  tone?: "note" | "caveat";
  children: ReactNode;
}) {
  return (
    <details className={`disclosure disclosure-${tone}`}>
      <summary>{summary}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
