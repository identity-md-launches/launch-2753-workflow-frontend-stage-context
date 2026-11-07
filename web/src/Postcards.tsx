import { useId, useRef, useState } from "react";
import type { Destination } from "./destinations";
import type { Finalization } from "./chain";
import { LANDMARKS } from "./landmarks";
import { hamsterSVG } from "./art";
import { count } from "./travel";
const regions: Record<string, [string, string, string]> = {
  Americas: ["#f8bf87", "#ffe5b6", "#6e4355"],
  Europe: ["#afa4ec", "#e7d5f3", "#58477b"],
  Africa: ["#eeac77", "#ffdda0", "#79503f"],
  Asia: ["#e4a2b5", "#f9d6bc", "#704360"],
  Oceania: ["#8fd6cf", "#d3eee2", "#3e6672"],
};
export function LandmarkIcon({ id, size = 48 }: { id: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 110"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      <path fill="currentColor" fillRule="evenodd" d={LANDMARKS[id].path} />
    </svg>
  );
}
export function PostcardPicture({
  place,
  locked = false,
}: {
  place: Destination;
  locked?: boolean;
}) {
  const id = useId().replace(/:/g, ""),
    colors = regions[place.region];
  return (
    <svg
      className={`postcard-picture ${locked ? "locked" : ""}`}
      viewBox="0 0 400 250"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${locked ? "Locked postcard" : `Greetings from ${place.name}`}: ${LANDMARKS[place.id].name}`}
    >
      <defs>
        <linearGradient id={`sky${id}`} x2="0" y2="1">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        <pattern
          id={`edge${id}`}
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
        >
          <rect width="36" height="36" fill="#fff8e7" />
          <path d="M0 0h12v36H0z" fill="#a08cf7" />
          <path d="M24 0h12v36H24z" fill="#f2b866" />
        </pattern>
      </defs>
      <rect width="400" height="250" fill={`url(#edge${id})`} />
      <rect x="8" y="8" width="384" height="234" fill="#fff8e7" />
      <rect
        x="16"
        y="16"
        width="368"
        height="183"
        fill={locked ? "#e9e1d4" : `url(#sky${id})`}
      />
      <g fill={locked ? "#d7cebd" : "#fff8e7"}>
        <path d="M35 50h12V38h22v6h15v13H35zM295 42h12V30h22v6h15v13h-49z" />
        <rect x="284" y="78" width="24" height="24" />
      </g>
      <g
        transform="translate(66 25) scale(1.7 1.55)"
        fill={locked ? "#958a81" : colors[2]}
      >
        <path fillRule="evenodd" d={LANDMARKS[place.id].path} />
      </g>
      <rect
        x="16"
        y="181"
        width="368"
        height="18"
        fill={locked ? "#c8c0b0" : "#b0c18d"}
      />
      <path d="M16 181h368v5H16z" fill={locked ? "#a79d8d" : "#6f8060"} />
      {!locked && (
        <g
          transform="translate(27 131) scale(.9)"
          dangerouslySetInnerHTML={{ __html: hamsterSVG(true) }}
        />
      )}
      {locked && (
        <g fill="#584f61">
          <path d="M337 151v-13a10 10 0 0 1 20 0v13h5v25h-30v-25zm5 0h10v-13a5 5 0 0 0-10 0z" />
        </g>
      )}
      <text
        x="22"
        y="222"
        fontFamily="sans-serif"
        fontSize={place.name.length > 20 ? "16" : "20"}
        fontWeight="700"
        fill="#352d42"
      >
        {locked ? place.name : `Greetings from ${place.name}`}
      </text>
      <text x="22" y="237" fontFamily="sans-serif" fontSize="11" fill="#5c526a">
        {LANDMARKS[place.id].name}
      </text>
    </svg>
  );
}
export type PostcardData = {
  place: Destination;
  km?: number;
  arrival?: string;
  final?: Finalization;
  explorer: string;
};
export function Postcard({
  place,
  km,
  arrival,
  final,
  explorer,
}: PostcardData) {
  const ref = useRef<HTMLDivElement>(null),
    [message, setMessage] = useState("");
  const date = arrival
    ? new Date(arrival).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : undefined;
  const shareText = `Greetings from ${place.name}! Squeek reached ${LANDMARKS[place.id].name} on Squeek’s First Road Trip. Choose the next stop: ${location.href.split("#")[0]}`;
  async function download() {
    setMessage("Rendering postcard…");
    let objectUrl: string | undefined;
    try {
      const svg = ref.current?.querySelector("svg");
      if (!svg) throw new Error("Postcard is not ready.");
      const escape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const metadata = [
        date ? `Arrival observed ${date}` : "Arrival date unavailable",
        km === undefined
          ? "Distance unavailable"
          : `${Math.round(km).toLocaleString("en")} km · ${final ? count(final.votes) : "Vote history loading"}`,
        final ? `Finalized: ${final.hash}` : "Finalization history unavailable",
        "Squeek’s First Road Trip · Sepolia testnet",
      ];
      const artwork = new XMLSerializer()
        .serializeToString(svg)
        .replace(
          'viewBox="0 0 400 250"',
          'viewBox="0 0 400 250" x="0" y="0" width="800" height="500"',
        );
      const content = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="650" viewBox="0 0 800 650"><rect width="800" height="650" fill="#fff8e7"/>${artwork}${metadata.map((t, i) => `<text x="32" y="${530 + i * 30}" fill="#352d42" font-family="sans-serif" font-size="${i === 2 ? 14 : 21}">${escape(t)}</text>`).join("")}</svg>`;
      objectUrl = URL.createObjectURL(
        new Blob([content], { type: "image/svg+xml;charset=utf-8" }),
      );
      const img = new Image();
      img.src = objectUrl;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 650;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PNG unavailable"))),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `squeek-${place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Postcard downloaded.");
    } catch {
      setMessage("Couldn’t download the postcard. Try again in your browser.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  return (
    <article className="postcard">
      <div ref={ref}>
        <PostcardPicture place={place} />
      </div>
      <div className="postcard-details">
        <h3>Greetings from {place.name}</h3>
        <p className="small">
          {date ? `Arrival observed ${date}` : "Arrival date unavailable"}
        </p>
        <p className="small">
          {km === undefined
            ? "Distance loading…"
            : `${Math.round(km).toLocaleString("en")} km`}
          {" · "}
          {final ? `${count(final.votes)} won` : "Winning votes loading…"}
        </p>
        {final ? (
          <a
            className="small"
            href={`${explorer}/tx/${final.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            Finalizing transaction ↗
          </a>
        ) : (
          <p className="small muted">
            Finalizing transaction awaiting confirmed history.
          </p>
        )}
        <div className="postcard-actions">
          <button onClick={() => void download()}>Download PNG</button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareText);
                setMessage("Share text copied.");
              } catch {
                setMessage("Select the share text below to copy it.");
              }
            }}
          >
            Copy share text
          </button>
        </div>
        <details>
          <summary className="small">Share this stop</summary>
          <textarea
            aria-label={`Share text for ${place.name}`}
            readOnly
            value={shareText}
          />
        </details>
        <p className="small" role="status">
          {message}
        </p>
      </div>
    </article>
  );
}
