/**
 * Kepala maskot StudyDate dalam bentuk vektor.
 *
 * Satu sumber bentuk dipakai dua kali: komponen React (website) dan
 * script ekspor stiker PNG (sosmed). Atribut ditulis camelCase agar bisa
 * langsung dipakai React; `mascotSvgString` mengubahnya ke kebab-case.
 *
 * Bentuk mengikuti concept sheet resmi: helm putih, visor Deep Navy,
 * antena kait biru, dan titik biru. Logo "S" di hoodie tidak digambar
 * ulang di sini karena aset logo resmi tidak boleh diubah.
 */

export const MASCOT_COLORS = {
  blue: "#014FE7",
  navy: "#0F1B33",
  white: "#FFFFFF",
  helmetShade: "#DCE6F7",
  blush: "#5B8DEF",
} as const;

export const MASCOT_EXPRESSIONS = [
  "senang",
  "girang",
  "kedip",
  "kaget",
  "mikir",
  "penasaran",
  "ngantuk",
  "malu",
] as const;

export type MascotExpression = (typeof MASCOT_EXPRESSIONS)[number];

export const MASCOT_EXPRESSION_LABELS: Record<MascotExpression, string> = {
  senang: "tersenyum",
  girang: "tertawa senang",
  kedip: "mengedipkan mata",
  kaget: "kaget",
  mikir: "sedang berpikir",
  penasaran: "penasaran",
  ngantuk: "mengantuk",
  malu: "tersipu",
};

type Attrs = Record<string, string | number>;

export type MascotNode = {
  tag: "g" | "path" | "ellipse" | "circle" | "rect";
  attrs: Attrs;
  children?: MascotNode[];
};

const LEFT_EYE = { x: 93, y: 140 };
const RIGHT_EYE = { x: 147, y: 140 };

/** Mata terbuka: sklera putih, pupil yang bisa digeser lewat CSS var. */
function openEye(
  center: { x: number; y: number },
  size: { rx: number; ry: number; pupil: number },
  className: string,
): MascotNode {
  return {
    tag: "g",
    attrs: { className: `mascot-eye ${className}` },
    children: [
      {
        tag: "ellipse",
        attrs: {
          cx: center.x,
          cy: center.y,
          rx: size.rx,
          ry: size.ry,
          fill: MASCOT_COLORS.white,
        },
      },
      {
        tag: "g",
        attrs: { className: "mascot-pupil" },
        children: [
          {
            tag: "circle",
            attrs: {
              cx: center.x + 2,
              cy: center.y + 2,
              r: size.pupil,
              fill: MASCOT_COLORS.navy,
            },
          },
          {
            tag: "circle",
            attrs: {
              cx: center.x + 5,
              cy: center.y - 3,
              r: Math.max(2.4, size.pupil * 0.32),
              fill: MASCOT_COLORS.white,
            },
          },
        ],
      },
    ],
  };
}

/** Garis lengkung untuk mata tertutup (^ atau u). */
function arcEye(
  center: { x: number; y: number },
  direction: "up" | "down",
  width = 15,
): MascotNode {
  const lift = direction === "up" ? -10 : 8;
  return {
    tag: "path",
    attrs: {
      d: `M${center.x - width} ${center.y + (direction === "up" ? 4 : -2)} Q${center.x} ${center.y + lift - (direction === "up" ? 6 : -4)} ${center.x + width} ${center.y + (direction === "up" ? 4 : -2)}`,
      fill: "none",
      stroke: MASCOT_COLORS.white,
      strokeWidth: 6,
      strokeLinecap: "round",
    },
  };
}

function mouth(d: string, filled = false): MascotNode {
  return filled
    ? { tag: "path", attrs: { d, fill: MASCOT_COLORS.white } }
    : {
        tag: "path",
        attrs: {
          d,
          fill: "none",
          stroke: MASCOT_COLORS.white,
          strokeWidth: 5,
          strokeLinecap: "round",
        },
      };
}

const SMILE = "M107 166 Q120 178 133 166";
const NORMAL_EYE = { rx: 15, ry: 18, pupil: 9 };

function face(expression: MascotExpression): MascotNode[] {
  switch (expression) {
    case "girang":
      return [
        arcEye(LEFT_EYE, "up"),
        arcEye(RIGHT_EYE, "up"),
        mouth("M104 160 Q120 160 136 160 Q134 182 120 182 Q106 182 104 160 Z", true),
      ];
    case "kedip":
      return [
        openEye(LEFT_EYE, NORMAL_EYE, "mascot-eye-left"),
        arcEye(RIGHT_EYE, "up"),
        mouth("M108 166 Q122 178 136 164"),
      ];
    case "kaget":
      return [
        openEye(LEFT_EYE, { rx: 17, ry: 21, pupil: 7 }, "mascot-eye-left"),
        openEye(RIGHT_EYE, { rx: 17, ry: 21, pupil: 7 }, "mascot-eye-right"),
        { tag: "ellipse", attrs: { cx: 120, cy: 172, rx: 7, ry: 8, fill: MASCOT_COLORS.white } },
      ];
    case "mikir":
      return [
        openEye(LEFT_EYE, { rx: 15, ry: 16, pupil: 8 }, "mascot-eye-left mascot-eye-up"),
        openEye(RIGHT_EYE, { rx: 15, ry: 16, pupil: 8 }, "mascot-eye-right mascot-eye-up"),
        mouth("M110 170 Q118 166 132 170"),
      ];
    case "penasaran":
      return [
        openEye(LEFT_EYE, { rx: 13, ry: 15, pupil: 8 }, "mascot-eye-left"),
        openEye(RIGHT_EYE, { rx: 18, ry: 21, pupil: 10 }, "mascot-eye-right"),
        mouth("M112 168 Q120 172 128 168"),
      ];
    case "ngantuk":
      return [
        arcEye(LEFT_EYE, "down", 13),
        arcEye(RIGHT_EYE, "down", 13),
        { tag: "ellipse", attrs: { cx: 121, cy: 171, rx: 5, ry: 4, fill: MASCOT_COLORS.white } },
      ];
    case "malu":
      return [
        arcEye(LEFT_EYE, "up", 13),
        arcEye(RIGHT_EYE, "up", 13),
        { tag: "ellipse", attrs: { cx: 76, cy: 160, rx: 10, ry: 5, fill: MASCOT_COLORS.blush, opacity: 0.85 } },
        { tag: "ellipse", attrs: { cx: 164, cy: 160, rx: 10, ry: 5, fill: MASCOT_COLORS.blush, opacity: 0.85 } },
        mouth("M112 168 Q120 174 128 168"),
      ];
    case "senang":
    default:
      return [
        openEye(LEFT_EYE, NORMAL_EYE, "mascot-eye-left"),
        openEye(RIGHT_EYE, NORMAL_EYE, "mascot-eye-right"),
        mouth(SMILE),
      ];
  }
}

/** Seluruh pohon SVG kepala maskot untuk satu ekspresi. */
export function mascotHeadNodes(expression: MascotExpression): MascotNode[] {
  return [
    {
      tag: "g",
      attrs: { className: "mascot-antenna" },
      children: [
        {
          tag: "path",
          attrs: {
            d: "M152 32 C144 14 112 12 102 32 C94 50 106 64 126 62 L122 74",
            fill: "none",
            stroke: MASCOT_COLORS.blue,
            strokeWidth: 20,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          },
        },
        { tag: "circle", attrs: { cx: 166, cy: 52, r: 13, fill: MASCOT_COLORS.blue } },
      ],
    },
    {
      tag: "ellipse",
      attrs: {
        cx: 120,
        cy: 142,
        rx: 94,
        ry: 82,
        fill: MASCOT_COLORS.white,
        stroke: MASCOT_COLORS.helmetShade,
        strokeWidth: 4,
      },
    },
    {
      tag: "path",
      attrs: {
        d: "M40 170 Q120 236 200 170 Q190 218 120 222 Q50 218 40 170 Z",
        fill: MASCOT_COLORS.helmetShade,
        opacity: 0.55,
      },
    },
    {
      tag: "rect",
      attrs: {
        x: 48,
        y: 98,
        width: 144,
        height: 98,
        rx: 49,
        fill: MASCOT_COLORS.navy,
      },
    },
    {
      tag: "g",
      attrs: { className: "mascot-face" },
      children: face(expression),
    },
  ];
}

export const MASCOT_VIEWBOX = "0 0 240 240";

function kebab(name: string) {
  if (name === "className") return "class";
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function escapeAttr(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function nodeToString(node: MascotNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${kebab(key)}="${escapeAttr(value)}"`)
    .join("");
  const children = node.children?.map(nodeToString).join("") ?? "";
  return children
    ? `<${node.tag}${attrs}>${children}</${node.tag}>`
    : `<${node.tag}${attrs}/>`;
}

/** SVG utuh sebagai string, untuk script ekspor stiker. */
export function mascotSvgString(
  expression: MascotExpression,
  size = 1024,
): string {
  const body = mascotHeadNodes(expression).map(nodeToString).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MASCOT_VIEWBOX}" width="${size}" height="${size}">${body}</svg>`;
}

/** Versi stiker: maskot dengan tepi putih tebal (untuk WhatsApp, Telegram, IG). */
export function mascotStickerSvgString(
  expression: MascotExpression,
  size = 512,
): string {
  const body = mascotHeadNodes(expression).map(nodeToString).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 272 272" width="${size}" height="${size}"><defs><filter id="sticker-edge" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="9" result="grown"/><feFlood flood-color="#FFFFFF"/><feComposite in2="grown" operator="in"/></filter></defs><g filter="url(#sticker-edge)">${body}</g>${body}</svg>`;
}
