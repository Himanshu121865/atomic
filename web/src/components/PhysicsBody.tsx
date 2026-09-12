import katex from "katex";
import "katex/dist/katex.min.css";
import { PHYSICS_CONTENT } from "../physics/content";
import type { ViewMode } from "../lib/urlState";

function MathBlock({ tex }: { tex: string }) {
  const html = katex.renderToString(tex, { displayMode: true, throwOnError: false });
  return <div className="math" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function PhysicsBody({ view }: { view: ViewMode }) {
  const content = PHYSICS_CONTENT[view];
  return (
    <>
      <h3>{content.title}</h3>
      {content.blocks.map((b) => (
        <div key={b.tex}>
          <MathBlock tex={b.tex} />
          <p className="physics-note">{b.note}</p>
        </div>
      ))}
    </>
  );
}
