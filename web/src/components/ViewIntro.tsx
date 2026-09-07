import type { ReactNode } from "react";

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
  return (
    <div className="view-intro">
      <h2>{lead.title}</h2>
      <p className="view-lead">{lead.lead}</p>
      {lead.notice !== undefined && <p className="view-notice">{lead.notice}</p>}
      {badge}
      {children}
    </div>
  );
}
