import type { CSSProperties } from "react";
export const hamsterSVG = (running = false) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges" aria-hidden="true"><g fill="none" stroke="#a08cf7" stroke-width="2"><circle cx="32" cy="30" r="25"/><path class="wheel-spokes" d="M32 5v8m25 17h-8M32 55v-8M7 30h8"/><path d="M23 58h18m-9-3v3"/></g><g fill="#f2b866"><path d="M18 29h7v-9h8v5h10v7h5v13H18z"/><path d="M14 35h8v8h-8z"/></g><path fill="#ffe1a2" d="M25 32h17v13H25z"/><path fill="#cc8f7e" d="M27 23h4v4h-4zm17 14h4v4h-4z"/><path fill="#0b1013" d="${running ? "M36 30h3v4h-3z" : "M34 32h7v2h-7z"}"/><path class="hamster-feet" fill="#f2b866" d="M22 45h6v3h-6zm14 0h6v3h-6z"/>${running ? "" : '<path fill="#77ead7" d="M45 10h10v2h-3v2h-3v2h6v2H45v-2h3v-2h3v-2h-6z"/>'}</svg>`;
export function Hamster({
  running = false,
  className = "",
}: {
  running?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`hamster-art ${running ? "running" : "sleeping"} ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: hamsterSVG(running) }}
    />
  );
}
const motifs: Record<string, string> = {
  palm: "M14 50h5l5-29h-5zm7-30L7 25v-6l9-5H7v-5h15l4 6 4-6h12v5h-9l10 5v6L29 20h-3l9 11h-7zM6 50h38v3H6z",
  mountain: "M3 46l14-30 9 16 9-24 17 38zm12-19 2-4 5 10h-5zm17-2 3-9 6 14h-5z",
  city: "M5 47V21h10V9h8v38h5V26h9V15h10v32zm4-21v4h3v-4zm9-11v4h2v-4zm22 6v4h3v-4zm-9 11v4h3v-4z",
  tree: "M24 8h8v6h6v6h6v8h-7v6H19v-6h-7v-8h6v-6h6zM25 34h6v15h-6zM12 49h32v3H12z",
  water: "M7 14h10v22h8V14h10v22h8v9H7zm-2 32h46v5H5zM16 5h22v5H16z",
  temple:
    "M8 48V23h39v25h-7V30h-5v18h-7V30h-5v18h-7V30h-2v18zM5 20 27 7l23 13zM4 50h48v4H4z",
  ship: "M6 35h44l-8 13H16zm19-26h4v24h-4zm7 6 15 16H32zM9 52h10v-3h10v3h10v-3h10v6H9z",
  bridge:
    "M6 48V16h5v32zm39 0V16h5v32zM11 21q17 28 34 0v5q-17 28-34 0zM3 42h50v5H3zM19 33h3v10h-3zm16 0h3v10h-3z",
  flower: "M23 8h10v12h12v10H33v12H23V30H11V20h12zm3 34h4v12h-4zM6 39h15v8H6z",
  music: "M20 12h25v8H26v25H12V33h8zm19 8h6v22H31V30h8z",
  rocket: "M26 4h5v6h6v8h5v18H14V18h6v-8h6zM20 39h6v13h-6zm11 0h6v9h-6z",
};
export const crossingSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" shape-rendering="crispEdges" aria-hidden="true"><path d="${motifs.ship}" fill="#f2bd74"/></svg>`;
export function PixelIcon({
  type,
  size = 48,
}: {
  type: string;
  size?: number;
}) {
  return (
    <svg
      className="pixel-icon"
      style={{ "--icon-size": `${size}px` } as CSSProperties}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path
        d={motifs[type] ?? motifs.city}
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
export function Icon({
  name,
}: {
  name: "arrow" | "compass" | "close" | "external" | "check" | "pause" | "play";
}) {
  const paths = {
    arrow: "M4 12h16m-6-6 6 6-6 6",
    compass: "m16 8-3 5-5 3 3-5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    close: "m6 6 12 12M6 18 18 6",
    external: "M14 4h6v6m0-6L10 14M10 4H4v16h16v-6",
    check: "m5 12 4 4L19 6",
    pause: "M9 5v14M15 5v14",
    play: "m8 5 11 7-11 7Z",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
