import { createElement, type ReactNode } from "react";
import {
  MASCOT_EXPRESSION_LABELS,
  MASCOT_VIEWBOX,
  mascotHeadNodes,
  type MascotExpression,
  type MascotNode,
} from "@/lib/brand/mascot";

function renderNode(node: MascotNode, key: string): ReactNode {
  return createElement(
    node.tag,
    { key, ...node.attrs },
    node.children?.map((child, index) => renderNode(child, `${key}-${index}`)),
  );
}

/**
 * Kepala maskot StudyDate (vektor). Tanpa state, aman dipakai di server.
 * Pupil membaca `--mascot-px` dan `--mascot-py` dari elemen induk.
 */
export function MascotHead({
  expression = "senang",
  className,
  title,
}: {
  expression?: MascotExpression;
  className?: string;
  /** Kosongkan untuk dekorasi; isi bila maskot membawa makna. */
  title?: string;
}) {
  const label = title ?? null;
  return (
    <svg
      viewBox={MASCOT_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={`mascot-head ${className ?? ""}`}
      data-expression={expression}
      role={label ? "img" : undefined}
      aria-label={label ? `${label}, ${MASCOT_EXPRESSION_LABELS[expression]}` : undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {mascotHeadNodes(expression).map((node, index) => renderNode(node, `m-${index}`))}
    </svg>
  );
}
