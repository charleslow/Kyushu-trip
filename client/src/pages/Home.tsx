/**
 * Kyushu Family Trip 2026 — Interactive Itinerary Map
 * Design: Topographic Field Journal
 * Mobile: Full-screen map + bottom sheet day picker + slide-up location detail
 * Desktop: Left sidebar + right panel + bottom drawer
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { MapView } from "@/components/Map.tsx";
import {
  itinerary,
  type DayItinerary,
  type Location,
  categoryColors,
  categoryLabels,
  categoryEmoji,
} from "@/lib/itineraryData";

// ─── Marker SVG ───────────────────────────────────────────────────────────────
function createMarkerSVG(color: string, emoji: string, selected: boolean): string {
  const size = selected ? 44 : 36;
  const shadow = selected
    ? "drop-shadow(0 4px 8px rgba(0,0,0,0.4))"
    : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))";
  return `
    <svg width="${size}" height="${size + 8}" viewBox="0 0 44 52" xmlns="http://www.w3.org/2000/svg" style="filter:${shadow}">
      <circle cx="22" cy="22" r="20" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="22" y="28" text-anchor="middle" font-size="16" font-family="Arial">${emoji}</text>
      <polygon points="16,38 28,38 22,50" fill="${color}"/>
    </svg>
  `.trim();
}

interface MarkerRef {
  marker: google.maps.marker.AdvancedMarkerElement;
  location: Location;
}

// ─── useIsMobile hook ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const isMobile = useIsMobile();

  const [selectedDay, setSelectedDay] = useState<DayItinerary>(itinerary[0]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  // Desktop: sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Desktop: location detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Mobile: bottom sheet states
  const [mobileSheet, setMobileSheet] = useState<"day" | "locations" | "detail" | null>("day");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<MarkerRef[]>([]);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const panToWithOffsetRef = useRef<(lat: number, lng: number, mobile?: boolean) => void>(() => {});

  // ─── Clear markers ──────────────────────────────────────────────────────────
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(({ marker }) => { marker.map = null; });
    markersRef.current = [];
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  }, []);

  // ─── Place markers ──────────────────────────────────────────────────────────
  const placeMarkers = useCallback(
    (day: DayItinerary, map: google.maps.Map, selectedLoc: Location | null) => {
      clearMarkers();
      const locations = filterCategory
        ? day.locations.filter((l) => l.category === filterCategory)
        : day.locations;

      if (locations.length > 1) {
        routePolylineRef.current = new google.maps.Polyline({
          path: locations.map((l) => ({ lat: l.lat, lng: l.lng })),
          geodesic: true,
          strokeColor: "#C4622D",
          strokeOpacity: 0.5,
          strokeWeight: 2,
          icons: [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: "#C4622D", fillOpacity: 0.7, strokeWeight: 0 },
            offset: "100%",
            repeat: "120px",
          }],
          map,
        });
      }

      locations.forEach((location) => {
        const color = categoryColors[location.category] || "#1A2744";
        const emoji = categoryEmoji[location.category] || "📍";
        const isSelected = selectedLoc?.id === location.id;
        const markerEl = document.createElement("div");
        markerEl.innerHTML = createMarkerSVG(color, emoji, isSelected);
        markerEl.style.cursor = "pointer";

        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: location.lat, lng: location.lng },
          title: location.name,
          content: markerEl,
        });

        marker.addListener("click", () => {
          setSelectedLocation(location);
          setDrawerOpen(true);
          setMobileSheet("detail");
          panToWithOffsetRef.current(location.lat, location.lng, window.innerWidth < 768);
        });

        markersRef.current.push({ marker, location });
      });
    },
    [clearMarkers, filterCategory]
  );

  // ─── Map ready ─────────────────────────────────────────────────────────────
  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setMapTypeId("terrain");
    map.setOptions({
      styles: [
        { featureType: "all", elementType: "geometry", stylers: [{ saturation: -20 }, { lightness: 5 }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8c8e8" }] },
        { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#d4c9a8" }] },
        { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#e8e0d0" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#f5f0e8" }] },
        { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e8dcc8" }] },
        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#b8d4a0" }] },
        { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "all", stylers: [{ visibility: "simplified" }] },
        { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#4A3728" }] },
        { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6B5A48" }] },
      ],
    });
    placeMarkers(itinerary[0], map, null);
  }, [placeMarkers]);

  // ─── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    setSelectedLocation(null);
    setDrawerOpen(false);
    mapRef.current.panTo(selectedDay.mapCenter);
    mapRef.current.setZoom(selectedDay.mapZoom);
    placeMarkers(selectedDay, mapRef.current, null);
  }, [selectedDay, placeMarkers]);

  useEffect(() => {
    if (!mapRef.current) return;
    placeMarkers(selectedDay, mapRef.current, selectedLocation);
  }, [filterCategory, selectedDay, selectedLocation, placeMarkers]);

  useEffect(() => {
    if (!mapRef.current) return;
    placeMarkers(selectedDay, mapRef.current, selectedLocation);
  }, [selectedLocation, selectedDay, placeMarkers]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleDaySelect = (day: DayItinerary) => {
    setSelectedDay(day);
    setFilterCategory(null);
    // On mobile, stay on day view so user can browse summaries; tap "Places" to advance
  };

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setDrawerOpen(true);
    setMobileSheet("detail");
    if (mapRef.current) {
      mapRef.current.setZoom(14);
      // On mobile, offset upward so marker sits above the bottom sheet
      panToWithOffset(location.lat, location.lng, isMobile);
    }
  };

  const categories = Array.from(new Set(selectedDay.locations.map((l) => l.category)));
  const filteredLocations = filterCategory
    ? selectedDay.locations.filter(l => l.category === filterCategory)
    : selectedDay.locations;

  // ─── Pan map so marker lands at ~1/3 from top of the VISIBLE area above sheet ───
  // Strategy: use map.panBy() after panTo() to shift the view downward by the
  // amount needed to move the marker from screen-centre up into the visible map area.
  // visible map height = window.innerHeight * 1/2 (sheet is 1/2)
  // target y = visibleHeight / 3  (1/3 from top of visible area)
  // current y = window.innerHeight / 2  (panTo puts it at screen centre)
  // panBy offset = target_y - current_y  (positive = pan down = marker moves up)
  const panToWithOffset = useCallback((lat: number, lng: number, mobile = false) => {
    const map = mapRef.current;
    if (!map) return;
    // First pan to the location (centres it on full screen)
    map.panTo({ lat, lng });
    if (!mobile) return;
    // Then shift: marker should sit at 1/3 from top of visible map (top 1/2 of screen)
    // visible map height = 1/2 of screen; target = 1/3 of that from top
    // = window.innerHeight * 1/2 * 1/3 = window.innerHeight * 1/6
    // screen centre = window.innerHeight / 2
    // positive panBy y = pan map down = marker moves up
    const screenH = window.innerHeight;
    const targetY = screenH * (1 / 6);          // 1/3 from top of visible area
    const centreY = screenH / 2;                 // where panTo puts the marker
    const dy = Math.round(centreY - targetY);    // how many px to pan the map down
    // Small delay so panTo finishes before panBy
    setTimeout(() => map.panBy(0, dy), 50);
  }, []);
  panToWithOffsetRef.current = panToWithOffset;

  // ─── Navigate between locations with arrows ──────────────────────────────
  const currentLocIndex = selectedLocation
    ? filteredLocations.findIndex(l => l.id === selectedLocation.id)
    : -1;

  const navigateLocation = useCallback((dir: 1 | -1) => {
    const next = filteredLocations[currentLocIndex + dir];
    if (!next) return;
    setSelectedLocation(next);
    setDrawerOpen(true);
    setMobileSheet("detail");
    if (mapRef.current) {
      mapRef.current.setZoom(14);
      panToWithOffset(next.lat, next.lng, isMobile);
    }
  }, [filteredLocations, currentLocIndex, isMobile, panToWithOffset]);

  // ─── Shared: Location List ──────────────────────────────────────────────────
  const LocationList = () => (
    <>
      {/* Category filter */}
      <div className="px-4 py-2.5 border-b border-[#1A2744]/10 flex gap-1.5 overflow-x-auto flex-shrink-0">
        <button
          onClick={() => setFilterCategory(null)}
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            background: filterCategory === null ? "#1A2744" : "transparent",
            color: filterCategory === null ? "white" : "#1A2744",
            border: "1px solid #1A2744",
          }}
        >All</button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: filterCategory === cat ? categoryColors[cat] : "transparent",
              color: filterCategory === cat ? "white" : categoryColors[cat],
              border: `1px solid ${categoryColors[cat]}`,
            }}
          >
            {categoryEmoji[cat]} {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Locations */}
      <div className="flex-1 overflow-y-auto scrollbar-light">
        {filteredLocations.map((location) => {
          const isSelected = selectedLocation?.id === location.id;
          const color = categoryColors[location.category];
          return (
            <button
              key={location.id}
              onClick={() => handleLocationClick(location)}
              className="w-full text-left px-4 py-3.5 border-b border-[#1A2744]/08 transition-all duration-150"
              style={{
                background: isSelected ? `${color}12` : "transparent",
                borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
              }}
            >
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{ background: `${color}20`, color }}>
                  {categoryEmoji[location.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[#1A2744] text-sm font-semibold leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {location.name}
                    </p>
                    {location.isOption && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Option</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded-sm font-medium"
                      style={{ background: `${color}15`, color }}>
                      {categoryLabels[location.category]}
                    </span>
                    {location.duration && <span className="text-[#6B5A48] text-xs">⏱ {location.duration}</span>}
                    {location.priceRange && <span className="text-[#6B5A48] text-xs">¥ {location.priceRange}</span>}
                  </div>
                  <p className="text-[#6B5A48] text-xs mt-1.5 line-clamp-2 leading-relaxed">
                    {location.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  // ─── Shared: Location Detail Content ───────────────────────────────────────
  const LocationDetail = ({ location }: { location: Location }) => {
    const color = categoryColors[location.category];
    return (
      <div className="px-5 pb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-3 items-start">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${color}20` }}>
              {categoryEmoji[location.category]}
            </div>
            <div>
              <h3 className="text-[#1A2744] text-lg font-bold leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {location.name}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${color}20`, color }}>
                  {categoryLabels[location.category]}
                </span>
                {location.mealType && (
                  <span className="text-xs text-[#6B5A48] bg-[#F0EAE0] px-2 py-0.5 rounded-full">{location.mealType}</span>
                )}
                {location.isOption && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Optional</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setDrawerOpen(false);
              setMobileSheet(isMobile ? "locations" : null);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5A48] hover:bg-[#1A2744]/10 transition-all flex-shrink-0 text-lg"
          >✕</button>
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          {location.duration && (
            <div className="flex items-center gap-1.5 text-sm text-[#4A3728]">
              <span>⏱</span><span>{location.duration}</span>
            </div>
          )}
          {location.priceRange && (
            <div className="flex items-center gap-1.5 text-sm text-[#4A3728]">
              <span>💴</span><span>{location.priceRange}</span>
            </div>
          )}
          {location.specialty && (
            <div className="flex items-center gap-1.5 text-sm text-[#4A3728]">
              <span>⭐</span><span>{location.specialty}</span>
            </div>
          )}
        </div>

        <p className="text-[#4A3728] text-sm leading-relaxed mb-4">{location.description}</p>

        {location.kidNotes && (
          <div className="bg-[#E8F4E8] rounded-xl p-4 mb-4 border border-[#2D5016]/15">
            <div className="flex gap-2">
              <span className="text-lg flex-shrink-0">👨‍👩‍👧‍👦</span>
              <div>
                <p className="text-[#2D5016] text-xs font-semibold uppercase tracking-wide mb-1">Family Notes</p>
                <p className="text-[#2D5016] text-sm leading-relaxed">{location.kidNotes}</p>
              </div>
            </div>
          </div>
        )}

        {location.tags && location.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-4">
            {location.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-1 rounded-full bg-[#1A2744]/08 text-[#1A2744]/60">{tag}</span>
            ))}
          </div>
        )}

        {location.url && (
          <a
            href={location.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-all"
            style={{ background: "#1A2744", color: "white" }}
          >
            <span>🔗</span>
            <span>More Information</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>
    );
  };

  // ─── Mobile sheet swipe gesture ────────────────────────────────────────────
  type SheetSnap = "peek" | "half" | "full";
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("half");
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const touchStartSnap = useRef<SheetSnap>("half");
  const sheetRef = useRef<HTMLDivElement>(null);

  const SNAP_PEEK = 120;  // px — large enough to not conflict with mobile scroll-minimize
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onResize);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
      }
    };
  }, []);
  const SNAP_HALF = Math.round(viewportHeight * 0.5);   // 50vh
  const SNAP_FULL = Math.round(viewportHeight * 0.88);  // 88vh

  const snapToHeight = (snap: SheetSnap) => {
    switch (snap) {
      case "peek": return SNAP_PEEK;
      case "half": return SNAP_HALF;
      case "full": return SNAP_FULL;
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    touchStartSnap.current = sheetSnap;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }
  }, [sheetSnap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    const dy = touchStartY.current - e.touches[0].clientY; // positive = swipe up
    const startH = snapToHeight(touchStartSnap.current);
    const newH = Math.max(SNAP_PEEK, Math.min(SNAP_FULL, startH + dy));
    sheetRef.current.style.height = `${newH}px`;
  }, [SNAP_PEEK, SNAP_FULL]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!sheetRef.current) return;
    sheetRef.current.style.transition = "height 0.35s cubic-bezier(0.32, 0.72, 0, 1)";
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const elapsed = Math.max(1, Date.now() - touchStartTime.current);
    const velocity = dy / elapsed; // px/ms, positive = swipe up
    const startH = snapToHeight(touchStartSnap.current);
    const currentH = startH + dy;
    // Snap to nearest
    const snaps: [SheetSnap, number][] = [["peek", SNAP_PEEK], ["half", SNAP_HALF], ["full", SNAP_FULL]];
    let best: SheetSnap = "half";
    let bestDist = Infinity;
    for (const [name, h] of snaps) {
      const dist = Math.abs(currentH - h);
      if (dist < bestDist) { bestDist = dist; best = name; }
    }
    // Fast flick (velocity > 0.4 px/ms) or strong distance (>80px) biases direction
    const isFlick = Math.abs(velocity) > 0.4;
    if (isFlick || Math.abs(dy) > 80) {
      const direction = isFlick ? Math.sign(velocity) : Math.sign(dy);
      if (direction > 0 && touchStartSnap.current === "peek") best = "half";
      else if (direction > 0 && touchStartSnap.current === "half") best = "full";
      else if (direction < 0 && touchStartSnap.current === "full") best = "half";
      else if (direction < 0 && touchStartSnap.current === "half") best = "peek";
    }
    setSheetSnap(best);
    sheetRef.current.style.height = `${snapToHeight(best)}px`;
    // Sync sheet state with snap
    if (best === "peek") setMobileSheet(null);
    else if (mobileSheet === null) setMobileSheet("day");
  }, [SNAP_PEEK, SNAP_HALF, SNAP_FULL, mobileSheet]);

  // Keep snap in sync when mobileSheet changes programmatically
  useEffect(() => {
    if (mobileSheet === null) setSheetSnap("peek");
    else if (sheetSnap === "peek") setSheetSnap("half");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileSheet]);

  // ─── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    const sheetHidden = mobileSheet === null;

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#1A2744]">
        {/* Full-screen map */}
        <MapView
          className="absolute inset-0 w-full h-full"
          initialCenter={itinerary[0].mapCenter}
          initialZoom={itinerary[0].mapZoom}
          onMapReady={handleMapReady}
          isMobile
        />
        {/* ── Mobile Header ─────────────────────────────────────────── */}
        {/* Minimal floating header — safe area aware */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pb-2 flex items-center justify-between pointer-events-none" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <div className="pointer-events-auto">
            <h1 className="text-white font-bold text-sm leading-tight drop-shadow-md" style={{ fontFamily: "'Playfair Display', Georgia, serif", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
              Kyushu Family Trip 2026
            </h1>
          </div>
          <span className="pointer-events-auto text-white/90 text-xs bg-black/30 px-2.5 py-1 rounded-full backdrop-blur-sm" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
            {selectedDay.date}
          </span>
        </div>

        {/* ── Mobile Bottom Sheet ───────────────────────────────────── */}
        {/* Sheet container — swipe-enabled with 3 snap points */}
        <div
          ref={sheetRef}
          className="absolute left-0 right-0 bottom-0 z-30 flex flex-col mobile-safe-bottom"
          style={{
            background: "rgba(247, 244, 239, 0.98)",
            backdropFilter: "blur(16px)",
            borderRadius: "20px 20px 0 0",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
            transition: "height 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
            height: `${snapToHeight(sheetSnap)}px`,
            maxHeight: "88vh",
            overflow: "hidden",
          }}
        >
          {/* ── Handle row: drag handle + hide/show — swipeable ───── */}
          <div
            className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0 no-select"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Left: back/context button */}
            <div className="w-8">
              {!sheetHidden && mobileSheet === "detail" && (
                <button
                  onClick={() => setMobileSheet("locations")}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B5A48]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              {!sheetHidden && mobileSheet === "locations" && (
                <button
                  onClick={() => setMobileSheet("day")}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#6B5A48]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
            </div>
            {/* Centre: drag handle */}
            <div className="w-10 h-1 rounded-full bg-[#1A2744]/20" />
            {/* Right: spacer to keep handle centred */}
            <div className="w-8" />
          </div>

          {/* ── Day picker ───────────────────────────────────────── */}
          {mobileSheet === "day" && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Current day summary — fixed at top */}
              <div key={selectedDay.id} className="px-4 pb-3 border-b border-[#1A2744]/10 animate-fade-in flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#6B5A48] text-xs uppercase tracking-widest font-medium">{selectedDay.dayLabel} · {selectedDay.date}</p>
                    <h2 className="text-[#1A2744] text-base font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {selectedDay.title}
                    </h2>
                    <p className="text-[#6B5A48] text-xs mt-0.5">{selectedDay.subtitle}</p>
                  </div>
                  <button
                    onClick={() => setMobileSheet("locations")}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-full ml-3"
                    style={{ background: "#1A2744", color: "white" }}
                  >
                    Places
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
                {/* Region */}
                <p className="text-[#6B5A48] text-xs mb-2">📍 {selectedDay.region}</p>
                {/* Highlights */}
                {selectedDay.highlights && selectedDay.highlights.length > 0 && (
                  <div className="mb-2">
                    <ul className="space-y-1">
                      {selectedDay.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-[#4A3728] text-xs leading-relaxed">
                          <span className="text-[#C4622D] flex-shrink-0 mt-0.5">•</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Tips */}
                <div className="flex gap-2 bg-[#FFF8F0] rounded-lg p-2.5 border border-[#C4622D]/15">
                  <span className="text-[#C4622D] text-sm flex-shrink-0">💡</span>
                  <p className="text-[#4A3728] text-xs leading-relaxed">{selectedDay.tips}</p>
                </div>
              </div>

              {/* Day list — scrollable below fixed summary */}
              <div className="flex-1 overflow-y-auto scrollbar-light">
                <div className="px-4 pt-2 pb-1">
                  <p className="text-[#6B5A48] text-xs uppercase tracking-widest font-medium mb-2">Choose a Day</p>
                </div>
                {itinerary.map((day, idx) => {
                  const isSelected = day.id === selectedDay.id;
                  const dayCats = Array.from(new Set(day.locations.map(l => l.category))).slice(0, 4);
                  return (
                    <button
                      key={day.id}
                      onClick={() => handleDaySelect(day)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-all"
                      style={{
                        background: isSelected ? "rgba(196,98,45,0.1)" : "transparent",
                        borderLeft: isSelected ? "3px solid #C4622D" : "3px solid transparent",
                      }}
                    >
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{
                          background: isSelected ? "#C4622D" : "rgba(26,39,68,0.08)",
                          color: isSelected ? "white" : "#6B5A48",
                        }}
                      >{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B5A48] text-xs">{day.date}</span>
                          <div className="flex gap-0.5">
                            {dayCats.map(cat => (
                              <span key={cat} style={{ color: categoryColors[cat] }} className="text-xs">{categoryEmoji[cat]}</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-[#1A2744] text-sm font-semibold leading-tight mt-0.5"
                          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                          {day.title}
                        </p>
                        <p className="text-[#6B5A48] text-xs truncate">{day.subtitle}</p>
                      </div>
                      {isSelected && (
                        <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4622D" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </button>
                  );
                })}

                {/* Legend */}
                <div className="px-4 pt-2 pb-6 border-t border-[#1A2744]/10 mt-2">
                  <p className="text-[#6B5A48] text-xs uppercase tracking-widest font-medium mb-2">Legend</p>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
                    {Object.entries(categoryLabels).map(([cat, label]) => (
                      <div key={cat} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryColors[cat as keyof typeof categoryColors] }} />
                        <span className="text-[#6B5A48] text-xs">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── Locations list ────────────────────────────────────────────────────── */}
          {mobileSheet === "locations" && (
            <>
              {/* Header */}
              <div className="px-4 pb-2 border-b border-[#1A2744]/10 flex-shrink-0">
                <p className="text-[#6B5A48] text-xs uppercase tracking-widest">{selectedDay.dayLabel} · {selectedDay.date}</p>
                <h2 className="text-[#1A2744] text-base font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {selectedDay.title}
                </h2>
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <LocationList />
              </div>
            </>
          )}

          {/* ── Location detail ─────────────────────────────────────────────────── */}
          {mobileSheet === "detail" && selectedLocation && (
            <>
              {/* Location counter + prev/next arrows */}
              <div className="px-4 pb-2 flex items-center justify-between flex-shrink-0">
                <span className="text-[#6B5A48] text-xs">
                  {currentLocIndex + 1} / {filteredLocations.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateLocation(-1)}
                    disabled={currentLocIndex <= 0}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: currentLocIndex <= 0 ? "rgba(26,39,68,0.04)" : "rgba(26,39,68,0.1)",
                      color: currentLocIndex <= 0 ? "#C0B5A8" : "#1A2744",
                    }}
                    title="Previous location"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigateLocation(1)}
                    disabled={currentLocIndex >= filteredLocations.length - 1}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: currentLocIndex >= filteredLocations.length - 1 ? "rgba(26,39,68,0.04)" : "rgba(26,39,68,0.1)",
                      color: currentLocIndex >= filteredLocations.length - 1 ? "#C0B5A8" : "#1A2744",
                    }}
                    title="Next location"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-light">
                <LocationDetail location={selectedLocation} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1A2744] font-sans">
      {/* Map */}
      <MapView
        className="absolute inset-0 w-full h-full"
        initialCenter={itinerary[0].mapCenter}
        initialZoom={itinerary[0].mapZoom}
        onMapReady={handleMapReady}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.15) 100%)" }} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: "linear-gradient(to bottom, rgba(26,39,68,0.92) 0%, rgba(26,39,68,0) 100%)" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div>
            <h1 className="text-white font-bold text-base leading-tight tracking-wide" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Kyushu Family Trip 2026
            </h1>
            <p className="text-white/60 text-xs">Apr 15–24 · 2 adults · 2 kids (4 & 2)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-xs bg-white/10 px-3 py-1 rounded-full border border-white/20">
            {selectedDay.date} · {selectedDay.region}
          </span>
        </div>
      </div>

      {/* ── Left Sidebar ────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 bottom-0 z-10 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden"
        style={{
          width: "280px",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-280px)",
          background: "rgba(26, 39, 68, 0.93)",
          backdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="pt-16 pb-4 px-4 border-b border-white/10 flex-shrink-0">
          <p className="text-white/40 text-xs uppercase tracking-widest font-medium mb-1">Itinerary</p>
          <p className="text-white/70 text-sm">10 days · Kyushu & Kansai</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {itinerary.map((day, idx) => {
            const isSelected = day.id === selectedDay.id;
            return (
              <button
                key={day.id}
                onClick={() => handleDaySelect(day)}
                className="w-full text-left px-4 py-3 transition-all duration-200"
                style={{
                  background: isSelected ? "rgba(196, 98, 45, 0.2)" : "transparent",
                  borderLeft: isSelected ? "3px solid #C4622D" : "3px solid transparent",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{
                      background: isSelected ? "#C4622D" : "rgba(255,255,255,0.08)",
                      color: isSelected ? "white" : "rgba(255,255,255,0.5)",
                    }}
                  >{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white/40 text-xs font-medium">{day.date}</span>
                    <p className={`text-sm font-semibold leading-tight mt-0.5 ${isSelected ? "text-white" : "text-white/70"}`}
                      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {day.title}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5 truncate">{day.subtitle}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Array.from(new Set(day.locations.map(l => l.category))).slice(0, 4).map(cat => (
                        <span key={cat} className="text-xs px-1.5 py-0.5 rounded-sm"
                          style={{ background: `${categoryColors[cat]}30`, color: categoryColors[cat] }}>
                          {categoryEmoji[cat]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 flex-shrink-0">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(categoryLabels).map(([cat, label]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: categoryColors[cat as keyof typeof categoryColors] }} />
                <span className="text-white/50 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel ─────────────────────────────────────────────── */}
      <div
        className="absolute top-0 right-0 bottom-0 z-10 flex flex-col"
        style={{
          width: "340px",
          background: "rgba(247, 244, 239, 0.97)",
          backdropFilter: "blur(12px)",
          borderLeft: "1px solid rgba(26,39,68,0.15)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Day header */}
        <div key={selectedDay.id} className="px-5 pt-16 pb-5 border-b border-[#1A2744]/10 flex-shrink-0 animate-fade-in"
          style={{
            backgroundImage: selectedDay.heroImage
              ? `linear-gradient(to bottom, rgba(26,39,68,0.65) 0%, rgba(26,39,68,0.45) 100%), url(${selectedDay.heroImage})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: "140px",
          }}>
          <div className={selectedDay.heroImage ? "text-white" : "text-[#1A2744]"}>
            <p className="text-xs font-medium uppercase tracking-widest opacity-70 mb-1">{selectedDay.dayLabel} · {selectedDay.date}</p>
            <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {selectedDay.title}
            </h2>
            <p className="text-sm opacity-80 mt-1">{selectedDay.subtitle}</p>
          </div>
        </div>

        {/* Tips */}
        <div className="px-4 py-3 bg-[#FFF8F0] border-b border-[#C4622D]/20 flex-shrink-0">
          <div className="flex gap-2">
            <span className="text-[#C4622D] text-sm flex-shrink-0 mt-0.5">💡</span>
            <p className="text-[#4A3728] text-xs leading-relaxed">{selectedDay.tips}</p>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <LocationList />
        </div>
      </div>

      {/* ── Desktop Bottom Drawer ────────────────────────────────────── */}
      {selectedLocation && (
        <div
          className="absolute bottom-0 z-30 transition-all duration-300 ease-out scrollbar-light overflow-y-auto"
          style={{
            transform: drawerOpen ? "translateY(0)" : "translateY(110%)",
            left: sidebarOpen ? "280px" : "0",
            right: "340px",
            background: "rgba(247, 244, 239, 0.98)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(26,39,68,0.15)",
            borderRadius: "16px 16px 0 0",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.2)",
            maxHeight: "55vh",
          }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-[#1A2744]/20" />
          </div>
          <LocationDetail location={selectedLocation} />
        </div>
      )}

      {/* ── Sidebar toggle (when closed) ─────────────────────────────── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-1/2 left-3 z-20 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all"
          style={{ background: "rgba(26,39,68,0.9)", color: "white" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* ── Day dots ─────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-6 z-20 flex gap-1.5"
        style={{
          left: sidebarOpen ? "calc(280px + 16px)" : "16px",
          transition: "left 0.3s ease",
        }}
      >
        {itinerary.map((day) => (
          <button
            key={day.id}
            onClick={() => handleDaySelect(day)}
            title={`${day.date}: ${day.title}`}
            className="transition-all duration-200"
            style={{
              width: selectedDay.id === day.id ? "24px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background: selectedDay.id === day.id ? "#C4622D" : "rgba(255,255,255,0.5)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
