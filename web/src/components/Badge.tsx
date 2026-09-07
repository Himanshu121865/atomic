import type { Provenance } from "../api/types";

export function Badge({ provenance }: { provenance: Provenance }) {
  return (
    <span className="badge-wrap">
      <span className={`badge badge-${provenance.fidelity}`}>{provenance.fidelity}</span>
      <details className="badge-detail">
        <summary>why</summary>
        <p>{provenance.method}</p>
        {provenance.assumptions.map((a) => (
          <p key={a}>{a}</p>
        ))}
        {provenance.error_estimate !== null && <p>±{provenance.error_estimate}</p>}
        {provenance.refinement !== null && <p>{provenance.refinement}</p>}
      </details>
    </span>
  );
}
