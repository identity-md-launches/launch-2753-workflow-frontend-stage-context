import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type GeoJSONSource,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GAME } from "./config";
import { DESTINATIONS } from "./destinations";
import { hamsterSVG, crossingSVG, Icon } from "./art";
import { pointAlong, type Leg, type Point } from "./journey";

// Vector tiles only: no remote images, sprite sheets, fonts or copyrighted character art.
const style: StyleSpecification = {
  version: 8,
  sources: {
    world: {
      type: "vector",
      url: GAME.map.tiles,
      attribution:
        '<a href="https://openfreemap.org/" target="_blank">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#223933" },
    },
    {
      id: "landcover",
      type: "fill",
      source: "world",
      "source-layer": "landcover",
      paint: { "fill-color": "#172a2a", "fill-opacity": 0.85 },
    },
    {
      id: "landuse",
      type: "fill",
      source: "world",
      "source-layer": "landuse",
      paint: { "fill-color": "#213232", "fill-opacity": 0.7 },
    },
    {
      id: "water",
      type: "fill",
      source: "world",
      "source-layer": "water",
      paint: { "fill-color": "#0e1924" },
    },
    {
      id: "parks",
      type: "fill",
      source: "world",
      "source-layer": "park",
      paint: { "fill-color": "#20362f", "fill-opacity": 0.65 },
    },
    {
      id: "boundaries",
      type: "line",
      source: "world",
      "source-layer": "boundary",
      paint: {
        "line-color": "#486365",
        "line-width": 0.7,
        "line-dasharray": [3, 3],
      },
    },
    {
      id: "roads",
      type: "line",
      source: "world",
      "source-layer": "transportation",
      paint: {
        "line-color": "#3b5756",
        "line-opacity": 0.6,
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.3, 10, 1.3],
      },
    },
  ],
};
type Props = {
  legs: Leg[];
  position: Point;
  active: boolean;
  paused: boolean;
  selected: number;
  onSelect: (id: number) => void;
};
export function TripMap({
  legs,
  position,
  active,
  paused,
  selected,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    hamster = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [tilesReady, setTilesReady] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    try {
      const m = new maplibregl.Map({
        container: container.current,
        style,
        center: [-78, 28],
        zoom: 3.1,
        minZoom: 0.7,
        maxZoom: 13,
        attributionControl: false,
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.current = m;
      m.addControl(
        new maplibregl.AttributionControl({ compact: false }),
        "bottom-right",
      );
      m.on("error", () => setError(true));
      m.on("sourcedata", (e) => {
        if (e.sourceId === "world" && e.isSourceLoaded) setTilesReady(true);
      });
      m.on("load", () => {
        const features = DESTINATIONS.map((d) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: d.coordinates },
          properties: { id: d.id },
        }));
        m.addSource("destinations", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
        m.addLayer({
          id: "destination-dots",
          type: "circle",
          source: "destinations",
          paint: {
            "circle-radius": 4,
            "circle-color": "#8b83b9",
            "circle-stroke-color": "#0b1013",
            "circle-stroke-width": 2,
          },
        });
        m.addSource("selection", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: "selected-dot",
          type: "circle",
          source: "selection",
          paint: {
            "circle-radius": 8,
            "circle-color": "#a58bfd",
            "circle-stroke-color": "#e4dcff",
            "circle-stroke-width": 2,
          },
        });
        m.addSource("route", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#77ead7",
            "line-width": 2.5,
            "line-dasharray": [1, 2.4],
          },
        });
        m.on("click", "destination-dots", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "number") selectRef.current(id);
        });
        m.on("mouseenter", "destination-dots", () => {
          m.getCanvas().style.cursor = "pointer";
        });
        m.on("mouseleave", "destination-dots", () => {
          m.getCanvas().style.cursor = "";
        });
        const el = document.createElement("div");
        el.className = "hamster-marker";
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("role", "presentation");
        el.tabIndex = -1;
        el.innerHTML = hamsterSVG();
        hamster.current = new maplibregl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(GAME.origin.coordinates)
          .addTo(m);
        setReady(true);
      });
      const resize = new ResizeObserver(() => m.resize());
      resize.observe(container.current);
      return () => {
        resize.disconnect();
        m.remove();
        map.current = null;
      };
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("route") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: legs.map((l) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: l.points },
        properties: {},
      })),
    });
    const crossings = legs
      .filter((l) => l.mode === "flight")
      .map((l) => {
        const el = document.createElement("div");
        el.className = "crossing-marker";
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("role", "presentation");
        el.tabIndex = -1;
        el.innerHTML = crossingSVG;
        return new maplibregl.Marker({ element: el })
          .setLngLat(pointAlong(l.points, 0.5))
          .addTo(m);
      });
    return () => {
      crossings.forEach((marker) => marker.remove());
    };
  }, [ready, legs]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("selection") as GeoJSONSource).setData({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: DESTINATIONS[selected].coordinates,
      },
      properties: {},
    });
  }, [ready, selected]);
  useEffect(() => {
    if (!ready) return;
    hamster.current?.setLngLat(position);
    const el = hamster.current?.getElement();
    if (el) {
      el.innerHTML = hamsterSVG(active);
      el.classList.toggle("running", active && !paused);
    }
  }, [ready, position[0], position[1], active, paused]);
  function center() {
    map.current?.easeTo({
      center: position,
      zoom: 5,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 400,
    });
  }
  function world() {
    map.current?.easeTo({
      center: [0, 20],
      zoom: 1,
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 400,
    });
  }
  return (
    <div className="map-frame">
      <div className="map-top">
        <span>
          <span className="live-dot" />
          The world, at wheel speed
        </span>
        <span className="map-coords">
          {position[1].toFixed(2)}°, {position[0].toFixed(2)}°
        </span>
      </div>
      <div
        className="map-canvas"
        ref={container}
        aria-label="Interactive world map. Use the destination list below to choose a stop."
        role="region"
      />
      <div className="map-grid" aria-hidden="true" />
      <div className="map-tools">
        <button onClick={center} aria-label="Find the hamster">
          <Icon name="compass" />
        </button>
        <button onClick={world}>World</button>
        <button onClick={() => map.current?.zoomIn()} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => map.current?.zoomOut()} aria-label="Zoom out">
          −
        </button>
      </div>
      <div className="map-info">
        {(error || !tilesReady) && (
          <div className="map-message" role="status">
            {error
              ? "Map tiles unavailable. The route and ballot still work."
              : "Loading the world map…"}
          </div>
        )}
        {legs.filter((l) => l.mode === "flight").length > 0 && (
          <div className="flight-key">Air crossing · great-circle route</div>
        )}
        <div className="map-origin">
          <span className="map-cross">+</span>
          <span>
            Miami Beach<span className="small muted">The starting line</span>
          </span>
        </div>
      </div>
    </div>
  );
}
