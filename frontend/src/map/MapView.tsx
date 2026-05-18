import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import { Listing } from "../features/Data/Listings";

// Leaflet default icon fix for React/Webpack environments
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ─── Geoapify API Configuration ──────────────────────────────────────────────

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

// ─── Icons ────────────────────────────────────────────────────────────────────

const userLocationIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width:16px;height:16px;
      background:#3B82F6;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 0 0 3px rgba(59,130,246,0.4);
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const defaultMarkerIcon = new L.Icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedMarkerIcon = L.divIcon({
  className: "",
  html: `
    <div style="position:relative;width:25px;height:41px;filter:drop-shadow(0 0 6px rgba(59,130,246,0.8));">
      <img src="${markerIcon}" width="25" height="41" style="display:block;" />
    </div>
  `,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidCoord = (coord: any): coord is number =>
  typeof coord === "number" && !isNaN(coord) && isFinite(coord);

const validateLatLng = (lat: any, lng: any): [number, number] | null => {
  if (isValidCoord(lat) && isValidCoord(lng)) return [lat, lng];
  console.warn("Invalid coordinates detected:", { lat, lng });
  return null;
};

const isMapVisible = (map: L.Map | null) => {
  if (!map) return false;
  const container = map.getContainer();
  return !!(container.offsetWidth || container.offsetHeight || container.getClientRects().length);
};

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

function findClosestPointIndex(
  pos: { lat: number; lng: number },
  coords: L.LatLng[]
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const dist = haversineDistance(pos, { lat: coords[i].lat, lng: coords[i].lng });
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}

function computeRemainingDistance(coords: L.LatLng[], startIndex: number): number {
  let total = 0;
  for (let i = startIndex; i < coords.length - 1; i++) {
    total += haversineDistance(
      { lat: coords[i].lat, lng: coords[i].lng },
      { lat: coords[i + 1].lat, lng: coords[i + 1].lng }
    );
  }
  return total;
}

// ─── Geoapify Route Fetcher ──────────────────────────────────────────────────

async function fetchGeoapifyRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ coords: L.LatLng[]; totalDistance: number; totalDuration: number } | null> {
  try {
    const url = `https://api.geoapify.com/v1/routing?waypoints=${from.lat},${from.lng}|${to.lat},${to.lng}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Geoapify routing failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;

    const geomType = feature.geometry.type;
    let rawCoords = feature.geometry.coordinates;
    if (geomType === "MultiLineString") {
      rawCoords = rawCoords.flat(1);
    }

    const coords: L.LatLng[] = rawCoords.map(
      ([lng, lat]: [number, number]) => L.latLng(lat, lng)
    );

    return {
      coords,
      totalDistance: feature.properties.distance,
      totalDuration: feature.properties.time,
    };
  } catch (err) {
    console.warn("Geoapify fetch error:", err);
    return null;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVIATION_THRESHOLD = 25;
const POSITION_THROTTLE_MS = 1500;

export interface NavInfo {
  distanceRemaining: string;
  eta: string;
}

interface MapViewProps {
  listings?: Listing[];
  selectedListing?: Listing | null;
  onSelect?: (listing: Listing) => void;
  onNavInfo?: (info: NavInfo | null) => void;
  onMapClick?: () => void;
}

const MapView = ({
  listings = [],
  selectedListing = null,
  onSelect = () => {},
  onNavInfo,
  onMapClick,
}: MapViewProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  const remainingPolylineRef = useRef<L.Polyline | null>(null);
  const completedPolylineRef = useRef<L.Polyline | null>(null);
  const outlinePolylineRef = useRef<L.Polyline | null>(null);

  const currentRouteKeyRef = useRef<string>("");
  const activeRoutedTargetIdRef = useRef<number | null>(null);

  const routeCoordsRef = useRef<L.LatLng[]>([]);
  const totalRouteDurationRef = useRef<number>(0);
  const totalRouteDistanceRef = useRef<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const isNavigatingRef = useRef<boolean>(false);
  const isBuildingRouteRef = useRef<boolean>(false);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [navInfo, setNavInfo] = useState<NavInfo | null>(null);

  const routerLocation = useLocation();
  const selectedFromRoute: Listing | undefined = routerLocation.state?.listing;

  // ✅ FIX: Keep track of mutable parent close functions without forcing re-initialization hooks
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onNavInfo?.(navInfo);
  }, [navInfo, onNavInfo]);

  // ── Helpers for Formatting metric readouts ───────────────────────────────────
  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatETA = (seconds: number): string => {
    const realisticSeconds = seconds * 1.45;
    const totalMins = Math.round(realisticSeconds / 60);
    if (totalMins < 60) return `${totalMins} min${totalMins !== 1 ? "s" : ""} away`;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hrs} hr ${mins} min${mins !== 1 ? "s" : ""}` : `${hrs} hr`;
  };

  // ── Map Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current, { zoomControl: false }).setView([15.145, 120.589], 13);
      mapInstanceRef.current = map;

      // ✅ FIX: Use the mutable Ref inside the listener so the context is persistent
      map.on("click", () => {
        onMapClickRef.current?.();
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const resizeObserver = new ResizeObserver(() => { map.invalidateSize(); });
      resizeObserver.observe(mapRef.current!);

      return () => {
        resizeObserver.disconnect();
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        outlinePolylineRef.current?.remove();
        remainingPolylineRef.current?.remove();
        completedPolylineRef.current?.remove();
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
      };
    }
  }, []); // ✅ FIX: Dependency array is kept clean so map constructs exactly once

  // ── Update Route Progress ──────────────────────────────────────────────────
  const updateRouteProgress = useCallback(
    (pos: { lat: number; lng: number }, currentSpeed: number | null) => {
      const map = mapInstanceRef.current;
      const coords = routeCoordsRef.current;
      if (!map || coords.length === 0) return;

      const closestIdx = findClosestPointIndex(pos, coords);

      // Completed segment — gray dashed
      const completedCoords = coords.slice(0, closestIdx + 1);
      if (completedPolylineRef.current) {
        completedPolylineRef.current.setLatLngs(completedCoords);
      } else {
        completedPolylineRef.current = L.polyline(completedCoords, {
          color: "#9CA3AF",
          weight: 5,
          opacity: 0.7,
          dashArray: "8 8",
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      // Remaining segment — keep outline in sync
      const remainingCoords = coords.slice(closestIdx);

      if (outlinePolylineRef.current) {
        outlinePolylineRef.current.setLatLngs(remainingCoords);
      }

      if (remainingPolylineRef.current) {
        remainingPolylineRef.current.setLatLngs(remainingCoords);
      } else {
        outlinePolylineRef.current = L.polyline(remainingCoords, {
          color: "#FFFFFF",
          weight: 10,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);

        remainingPolylineRef.current = L.polyline(remainingCoords, {
          color: "#3B82F6",
          weight: 6,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(map);
      }

      const remainingMeters = computeRemainingDistance(coords, closestIdx);
      let remainingSeconds = 0;
      if (currentSpeed && currentSpeed > 0.5) {
        remainingSeconds = remainingMeters / currentSpeed;
      } else {
        const avgSpeed = (totalRouteDistanceRef.current > 0 && totalRouteDurationRef.current > 0)
          ? totalRouteDistanceRef.current / totalRouteDurationRef.current : 1;
        remainingSeconds = remainingMeters / avgSpeed;
      }

      setNavInfo({
        distanceRemaining: formatDistance(remainingMeters),
        eta: formatETA(remainingSeconds),
      });
    },
    []
  );

  // ── Build Route via Geoapify ────────────────────────────────────────────────
  const buildRoute = useCallback(
    async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const routeKey = `${to.lat},${to.lng}-${Date.now()}-${Math.random()}`;
      currentRouteKeyRef.current = routeKey;

      isBuildingRouteRef.current = true;

      outlinePolylineRef.current?.remove();
      remainingPolylineRef.current?.remove();
      completedPolylineRef.current?.remove();
      outlinePolylineRef.current = null;
      remainingPolylineRef.current = null;
      completedPolylineRef.current = null;
      routeCoordsRef.current = [];

      const result = await fetchGeoapifyRoute(from, to);
      isBuildingRouteRef.current = false;

      if (currentRouteKeyRef.current !== routeKey) {
        return;
      }

      if (!result) return;

      routeCoordsRef.current = result.coords;
      totalRouteDurationRef.current = result.totalDuration;
      totalRouteDistanceRef.current = result.totalDistance;

      outlinePolylineRef.current = L.polyline(result.coords, {
        color: "#FFFFFF",
        weight: 10,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      remainingPolylineRef.current = L.polyline(result.coords, {
        color: "#3B82F6",
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      setNavInfo({
        distanceRemaining: formatDistance(result.totalDistance),
        eta: formatETA(result.totalDuration),
      });

      isNavigatingRef.current = true;
    },
    []
  );

  // ── GPS Tracking ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = validateLatLng(position.coords.latitude, position.coords.longitude);
        if (!coords) return;

        const currentPos = { lat: coords[0], lng: coords[1] };
        setUserLocation(currentPos);

        const map = mapInstanceRef.current;
        if (!map) return;

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(currentPos);
        } else {
          userMarkerRef.current = L.marker(currentPos, {
            icon: userLocationIcon, zIndexOffset: 1000,
          })
            .addTo(map)
            .bindPopup('<div style="text-align:center"><strong>📍 You are here</strong></div>');
        }
      },
      (error) => { console.warn("getCurrentPosition error:", error.message); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastUpdateRef.current < POSITION_THROTTLE_MS) return;
        lastUpdateRef.current = now;

        const coords = validateLatLng(position.coords.latitude, position.coords.longitude);
        if (!coords) return;

        const currentPos = { lat: coords[0], lng: coords[1] };
        setUserLocation(currentPos);

        const map = mapInstanceRef.current;
        if (!map) return;

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(currentPos);
        } else {
          userMarkerRef.current = L.marker(currentPos, {
            icon: userLocationIcon, zIndexOffset: 1000,
          })
            .addTo(map)
            .bindPopup('<div style="text-align:center"><strong>📍 You are here</strong></div>');
        }

        const activeTarget = selectedListing || selectedFromRoute;

        if (isNavigatingRef.current && routeCoordsRef.current.length > 0) {
          updateRouteProgress(currentPos, position.coords.speed);

          const closestIdx = findClosestPointIndex(currentPos, routeCoordsRef.current);
          const distToRoute = haversineDistance(currentPos, {
            lat: routeCoordsRef.current[closestIdx].lat,
            lng: routeCoordsRef.current[closestIdx].lng,
          });

          if (distToRoute > DEVIATION_THRESHOLD && activeTarget) {
            buildRoute(currentPos, activeTarget.coordinates);
          }
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) return;
        console.warn("Location watch error:", error.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    watchIdRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchIdRef.current = null;
    };
  }, [selectedListing, selectedFromRoute, buildRoute, updateRouteProgress]);

  // ── Initial Pan ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const map = mapInstanceRef.current;
      if (!map || !userLocation || !isMapVisible(map)) return;
      if (!selectedListing && !selectedFromRoute) {
        map.flyTo([userLocation.lat, userLocation.lng], 14, { animate: true, duration: 1 });
      }
    } catch (e) { console.error(e); }
  }, [userLocation, selectedListing, selectedFromRoute]);

  // ── Markers ────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const map = mapInstanceRef.current;
      if (!map || listings.length === 0) return;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      listings.forEach((listing) => {
        const coords = validateLatLng(listing.coordinates.lat, listing.coordinates.lng);
        if (!coords) return;

        const isSelected = selectedListing?.id === listing.id;
        const marker = L.marker(coords, {
          icon: isSelected ? selectedMarkerIcon : defaultMarkerIcon,
        }).addTo(map);
        marker.on("click", () => onSelect(listing));
        markersRef.current.set(listing.id, marker);
      });
    } catch (e) { console.error(e); }
  }, [listings]);

  // ── Marker Icon Swap ───────────────────────────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.setIcon(selectedListing?.id === id ? selectedMarkerIcon : defaultMarkerIcon);
    });
  }, [selectedListing]);

  // ── Fly To Selected ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const map = mapInstanceRef.current;
      if (!map || !selectedListing || !isMapVisible(map)) return;
      const coords = validateLatLng(selectedListing.coordinates.lat, selectedListing.coordinates.lng);
      if (coords) map.flyTo(coords, 16, { animate: true, duration: 0.8 });
    } catch (e) { console.error(e); }
  }, [selectedListing]);

  // ── Routing Trigger ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const target = selectedListing || selectedFromRoute;

    if (!target) {
      activeRoutedTargetIdRef.current = null;
      currentRouteKeyRef.current = "";
      outlinePolylineRef.current?.remove();
      remainingPolylineRef.current?.remove();
      completedPolylineRef.current?.remove();
      outlinePolylineRef.current = null;
      remainingPolylineRef.current = null;
      completedPolylineRef.current = null;
      isNavigatingRef.current = false;
      setNavInfo(null);
      return;
    }

    if (!map || !userLocation) return;

    if (activeRoutedTargetIdRef.current === target.id) return;

    outlinePolylineRef.current?.remove();
    remainingPolylineRef.current?.remove();
    completedPolylineRef.current?.remove();
    outlinePolylineRef.current = null;
    remainingPolylineRef.current = null;
    completedPolylineRef.current = null;
    isNavigatingRef.current = false;
    setNavInfo(null);

    activeRoutedTargetIdRef.current = target.id;

    const dest = target.coordinates;
    const destCoords = validateLatLng(dest.lat, dest.lng);
    if (!destCoords) return;

    if (isMapVisible(map)) {
      map.flyTo(destCoords, 15, { animate: true, duration: 1 });
      markersRef.current.get(target.id)?.openPopup();
    }

    buildRoute(userLocation, { lat: destCoords[0], lng: destCoords[1] });
  }, [userLocation, selectedListing, selectedFromRoute, buildRoute]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overscrollBehavior: "none" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%", WebkitTouchCallout: "none" }} />
    </div>
  );
};

export default MapView;