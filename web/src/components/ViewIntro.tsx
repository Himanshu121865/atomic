import type { ReactNode } from "react";
import { isNarrow } from "../lib/viewport";

export interface ViewLead {
  title: string;
  lead: string;
  notice?: string;
}

export function ViewIntro({
  lead,
  badge,
  children,
}: {
  lead: ViewLead;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  const open =
    typeof window === "undefined" ? true : !isNarrow(window.innerWidth);
  return (
    <details className="view-intro" open={open}>
      <summary className="view-intro-title">
        {lead.title}
        {badge ? <span className="view-intro-badge">{badge}</span> : null}
      </summary>
      <p className="view-lead">{lead.lead}</p>
      {lead.notice !== undefined && <p className="view-notice">{lead.notice}</p>}
      {children}
    </details>
  );
}
