import { useState, useEffect, useCallback } from "react";
import { HiOutlineCursorClick } from "react-icons/hi";
import StatsCard from "./StatsCard";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../hooks/useAuth";
import { BusinessFilterDropdown } from "./BusinessFilterDropdown";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DayPoint {
    day: string;
    val: number;
    x: number;
    y: number;
}

/**
 * ListingSeries: one entry per listing in multi-series (All) mode.
 * In single-filter mode, chartSeries will have exactly one item.
 */
type ListingSeries = {
    listingId: number;
    listingName: string;
    color: string;
    data: DayPoint[];
};

interface StatsState {
    profileViews: number;       // listing_interactions WHERE type === "view"
    totalInteractions: number;  // listing_interactions WHERE type !== "view"
    listingSaves: number;
    eventAttendance: number;
    profileViewsTrend: string;
    interactionsTrend: string;
    savesTrend: string;
    attendanceTrend: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Profile Views = number of times users viewed a listing's detail page.
 * Tracked via `listing_interactions` where `type === "view"`.
 */
const LINE_COLORS = [
    "#FFE2A0", // gold (default / first listing)
    "#6EE7B7", // soft mint green
    "#93C5FD", // soft sky blue
    "#FCA5A5", // soft coral red
    "#C4B5FD", // lavender
    "#FCD34D", // amber
    "#6DDFDF", // teal
    "#F9A8D4", // rose
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTrend = (current: number, previous: number): string => {
    if (previous === 0) return current > 0 ? "+100%" : "—";
    const pct = ((current - previous) / previous) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
};

const getDaysAgo = (days: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
};

const timeframeDays: Record<string, number> = {
    "7D": 7,
    "30D": 30,
    "90D": 90,
    "1Y": 365,
};

/** Build an array of DayPoint[] for the given days, filled from a grouped map. */
const buildDayPoints = (
    days: number,
    grouped: Record<string, number>
): DayPoint[] => {
    const allDays: DayPoint[] = [];
    const skipFactor = days <= 7 ? 1 : days <= 30 ? 5 : days <= 90 ? 10 : 30;

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const showLabel = i % skipFactor === 0 || i === 0 || i === days - 1;

        allDays.push({
            day: showLabel ? label : "",
            val: grouped[label] ?? 0,
            x: 0,
            y: 0,
        });
    }
    return allDays;
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-4 relative">
        <div className="bg-[#474133] p-4 rounded-full border border-[#5a5241] shadow-inner transition-transform hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-10 text-[#FFE2A0]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
        </div>
        <div className="space-y-1 relative z-10">
            <h3 className="text-white text-lg font-semibold font-['Playfair_Display'] tracking-wide">Insufficient Data</h3>
            <p className="text-[#a0a0a0] text-sm font-light max-w-xs mx-auto leading-relaxed">
                We need a few more days of activity to generate your performance trends and insights.
            </p>
        </div>
    </div>
);

// ─── Chart ────────────────────────────────────────────────────────────────────

interface HoveredInfo {
    seriesIndex: number;
    pointIndex: number;
}

const SVG_W = 1000;
const SVG_H = 400;
const PAD_X = 40;
const PAD_Y = 40;

/** Map a DayPoint[] to SVG-space coordinates given a shared minVal/maxVal. */
const toSvgPoints = (data: DayPoint[], minVal: number, maxVal: number) => {
    const range = maxVal - minVal || 1;
    return data.map((d, i) => ({
        ...d,
        sx: PAD_X + (i / Math.max(data.length - 1, 1)) * (SVG_W - PAD_X * 2),
        sy: SVG_H - PAD_Y - ((d.val - minVal) / range) * (SVG_H - PAD_Y * 2),
    }));
};

/** Build a smooth bezier path string from SVG-space points. */
const buildPath = (pts: ReturnType<typeof toSvgPoints>): string =>
    pts.reduce((acc, pt, i) => {
        if (i === 0) return `M${pt.sx},${pt.sy}`;
        const prev = pts[i - 1];
        const cpX = (prev.sx + pt.sx) / 2;
        return `${acc} C${cpX},${prev.sy} ${cpX},${pt.sy} ${pt.sx},${pt.sy}`;
    }, "");

const EngagementChart = ({ series }: { series: ListingSeries[] }) => {
    const [hovered, setHovered] = useState<HoveredInfo | null>(null);

    const hasActivity = series.some(s => s.data.some(d => d.val > 0));
    if (series.length === 0 || !hasActivity) return <EmptyState />;

    // Shared Y scale across all series so lines are comparable
    const allVals = series.flatMap(s => s.data.map(d => d.val));
    const maxVal = Math.max(...allVals);
    const minVal = 0;

    // Compute SVG points per series
    const computedSeries = series.map(s => ({
        ...s,
        pts: toSvgPoints(s.data, minVal, maxVal),
    }));

    // X-axis labels: use first series (all have same day labels)
    const visibleLabels = computedSeries[0].pts.filter(pt => pt.day !== "");

    const hoveredSeries = hovered !== null ? computedSeries[hovered.seriesIndex] : null;
    const hoveredPt = hoveredSeries ? hoveredSeries.pts[hovered!.pointIndex] : null;
    const hoveredRaw = hoveredSeries ? hoveredSeries.data[hovered!.pointIndex] : null;

    return (
        <div className="flex-1 w-full h-full flex flex-col pt-4 relative group/chart">
            {/* Legend */}
            {series.length > 1 && (
                <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4 px-1">
                    {series.map(s => (
                        <div key={s.listingId} className="flex items-center gap-2">
                            <span
                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: s.color }}
                            />
                            <span className="text-[11px] font-medium text-[#c0c0c0] truncate max-w-[140px]">
                                {s.listingName}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex-1 relative">
                {/* Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between opacity-5 pointer-events-none">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="border-t border-[#FFE2A0] w-full h-0" />
                    ))}
                </div>

                {/* Hover vertical line */}
                {hoveredPt && (
                    <div
                        className="absolute top-0 bottom-0 w-px bg-[#FFE2A0]/20 z-0 transition-all duration-200"
                        style={{ left: `${(hoveredPt.sx / SVG_W) * 100}%` }}
                    />
                )}

                <svg
                    className="w-full h-full relative z-10 overflow-visible"
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    preserveAspectRatio="none"
                >
                    <defs>
                        {computedSeries.map(s => (
                            <linearGradient
                                key={`grad-${s.listingId}`}
                                id={`grad-${s.listingId}`}
                                x1="0" y1="0" x2="0" y2="1"
                            >
                                <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                            </linearGradient>
                        ))}
                    </defs>

                    {/* Render fill + stroke per series */}
                    {computedSeries.map(s => {
                        const pathD = buildPath(s.pts);
                        const fillD = `${pathD} L${s.pts[s.pts.length - 1].sx},${SVG_H} L${s.pts[0].sx},${SVG_H} Z`;
                        return (
                            <g key={`line-${s.listingId}`}>
                                <path d={fillD} fill={`url(#grad-${s.listingId})`} />
                                <path d={pathD} fill="none" stroke={s.color} strokeWidth="3.5" strokeLinecap="round" />
                            </g>
                        );
                    })}

                    {/* Interactive hit areas + dots per series */}
                    {computedSeries.map((s, si) =>
                        s.pts.map((pt, pi) => {
                            const isHovered = hovered?.seriesIndex === si && hovered?.pointIndex === pi;
                            return (
                                <g
                                    key={`dot-${s.listingId}-${pi}`}
                                    className="cursor-pointer"
                                    onMouseEnter={() => setHovered({ seriesIndex: si, pointIndex: pi })}
                                    onMouseLeave={() => setHovered(null)}
                                >
                                    <circle cx={pt.sx} cy={pt.sy} r="18" fill="transparent" />
                                    <circle
                                        cx={pt.sx} cy={pt.sy}
                                        r={isHovered ? "9" : "5"}
                                        fill={isHovered ? s.color : "#3a3a3a"}
                                        stroke={s.color}
                                        strokeWidth="2.5"
                                        className="transition-all duration-200"
                                    />
                                    {!isHovered && (
                                        <circle cx={pt.sx} cy={pt.sy} r="2" fill={s.color} />
                                    )}
                                </g>
                            );
                        })
                    )}
                </svg>

                {/* Tooltip */}
                {hovered !== null && hoveredPt && hoveredRaw && hoveredSeries && (
                    <div
                        className="absolute z-30 bg-[#2d2d2d] border border-[#FFE2A0]/20 rounded-xl p-3 shadow-2xl pointer-events-none transition-all duration-200 -translate-x-1/2 -translate-y-[120%]"
                        style={{
                            left: `${(hoveredPt.sx / SVG_W) * 100}%`,
                            top: `${(hoveredPt.sy / SVG_H) * 100}%`,
                        }}
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <span
                                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: hoveredSeries.color }}
                            />
                            <p className="text-[#a0a0a0] text-[10px] uppercase font-bold tracking-widest">
                                {series.length > 1 ? hoveredSeries.listingName : (hoveredRaw.day || hoveredPt.day)}
                            </p>
                        </div>
                        {series.length > 1 && (
                            <p className="text-[#a0a0a0] text-[10px] mb-0.5">{hoveredRaw.day || hoveredPt.day}</p>
                        )}
                        <p className="text-white text-lg font-bold">
                            {hoveredRaw.val.toLocaleString()}{" "}
                            <span className="text-xs font-normal text-[#a0a0a0]">
                                {/* Profile Views = type==="view"; others = Interactions */}
                                Interactions
                            </span>
                        </p>
                    </div>
                )}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between items-center mt-6 px-4 pb-2 border-t border-[#4d4d4d] pt-4">
                {visibleLabels.map((pt, i) => (
                    <span
                        key={i}
                        className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 ${
                            hoveredPt && (hoveredPt.day === pt.day || computedSeries[0].data[visibleLabels.indexOf(pt)]?.day === pt.day)
                                ? "text-[#FFE2A0]"
                                : "text-[#a0a0a0]"
                        }`}
                    >
                        {pt.day}
                    </span>
                ))}
            </div>
        </div>
    );
};

// ─── Analytics Page ───────────────────────────────────────────────────────────
const Analytics = () => {
    const { user } = useAuth();
    const [timeframe, setTimeframe] = useState("30D");
    const [activeFilter, setActiveFilter] = useState("All");
    const [userListings, setUserListings] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    /**
     * chartSeries holds one ListingSeries per listing.
     * - When activeFilter === "All": one entry per listing (multi-line)
     * - When a specific listing is selected: exactly one entry (single-line, gold)
     */
    const [chartSeries, setChartSeries] = useState<ListingSeries[]>([]);

    const [stats, setStats] = useState<StatsState>({
        profileViews: 0,
        totalInteractions: 0,
        listingSaves: 0,
        eventAttendance: 0,
        profileViewsTrend: "—",
        interactionsTrend: "—",
        savesTrend: "—",
        attendanceTrend: "—",
    });

    const fetchAnalytics = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);

        const days = timeframeDays[timeframe];
        const currentStart = getDaysAgo(days);
        const previousStart = getDaysAgo(days * 2);

        const { data: listings } = await supabase
            .from("listings")
            .select("id, name")
            .eq("user_id", user.id);

        if (!listings || listings.length === 0) {
            setStats({
                profileViews: 0, totalInteractions: 0, listingSaves: 0, eventAttendance: 0,
                profileViewsTrend: "—", interactionsTrend: "—", savesTrend: "—", attendanceTrend: "—",
            });
            setChartSeries([]);
            setLoading(false);
            return;
        }
        setUserListings(listings);

        const isAll = activeFilter === "All";
        const targetListings = isAll
            ? listings
            : listings.filter(l => l.name === activeFilter);

        const targetIds = targetListings.map(l => l.id).filter(Boolean) as number[];

        if (targetIds.length === 0) {
            setStats({
                profileViews: 0, totalInteractions: 0, listingSaves: 0, eventAttendance: 0,
                profileViewsTrend: "—", interactionsTrend: "—", savesTrend: "—", attendanceTrend: "—",
            });
            setChartSeries([]);
            setLoading(false);
            return;
        }

        // ── Aggregate stats (always across targetIds) ──────────────────────
        const [
            { data: currInteractions },
            { data: prevInteractions },
        ] = await Promise.all([
            supabase
                .from("listing_interactions")
                .select("id, type, created_at, listing_id")
                .in("listing_id", targetIds)
                .gte("created_at", currentStart),
            supabase
                .from("listing_interactions")
                .select("id, type, listing_id")
                .in("listing_id", targetIds)
                .gte("created_at", previousStart)
                .lt("created_at", currentStart),
        ]);

        // Profile Views = listing_interactions WHERE type === "view"
        const currViews   = (currInteractions ?? []).filter((r: any) => r.type === "view").length;
        const currActions = (currInteractions ?? []).filter((r: any) => r.type !== "view").length;
        const prevViews   = (prevInteractions ?? []).filter((r: any) => r.type === "view").length;
        const prevActions = (prevInteractions ?? []).filter((r: any) => r.type !== "view").length;

        const [{ count: currSaves }, { count: prevSaves }] = await Promise.all([
            supabase
                .from("saves")
                .select("id", { count: "exact", head: true })
                .in("listing_id", targetIds)
                .gte("created_at", currentStart),
            supabase
                .from("saves")
                .select("id", { count: "exact", head: true })
                .in("listing_id", targetIds)
                .gte("created_at", previousStart)
                .lt("created_at", currentStart),
        ]);

        const [{ count: currAttendance }, { count: prevAttendance }] = await Promise.all([
            supabase
                .from("events")
                .select("id", { count: "exact", head: true })
                .in("listing_id", targetIds)
                .gte("created_at", currentStart),
            supabase
                .from("events")
                .select("id", { count: "exact", head: true })
                .in("listing_id", targetIds)
                .gte("created_at", previousStart)
                .lt("created_at", currentStart),
        ]);

        setStats({
            profileViews: currViews,
            totalInteractions: currActions,
            listingSaves: currSaves ?? 0,
            eventAttendance: currAttendance ?? 0,
            profileViewsTrend: formatTrend(currViews, prevViews),
            interactionsTrend: formatTrend(currActions, prevActions),
            savesTrend: formatTrend(currSaves ?? 0, prevSaves ?? 0),
            attendanceTrend: formatTrend(currAttendance ?? 0, prevAttendance ?? 0),
        });

        // ── Build chart series ──────────────────────────────────────────────
        if (isAll) {
            // Multi-series: one line per listing
            const newSeries: ListingSeries[] = targetListings.map((listing, idx) => {
                const color = LINE_COLORS[idx % LINE_COLORS.length];
                const grouped: Record<string, number> = {};

                (currInteractions ?? [])
                    .filter((r: any) => r.listing_id === listing.id)
                    .forEach((row: any) => {
                        const dateKey = new Date(row.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        });
                        grouped[dateKey] = (grouped[dateKey] ?? 0) + 1;
                    });

                return {
                    listingId: listing.id,
                    listingName: listing.name,
                    color,
                    data: buildDayPoints(days, grouped),
                };
            });

            setChartSeries(newSeries);
        } else {
            // Single-series: one line for the selected listing, always gold
            const grouped: Record<string, number> = {};
            (currInteractions ?? []).forEach((row: any) => {
                const dateKey = new Date(row.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
                grouped[dateKey] = (grouped[dateKey] ?? 0) + 1;
            });

            setChartSeries([{
                listingId: targetListings[0]?.id ?? 0,
                listingName: targetListings[0]?.name ?? activeFilter,
                color: "#FFE2A0",
                data: buildDayPoints(days, grouped),
            }]);
        }

        setLoading(false);
    }, [user?.id, timeframe, activeFilter]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return (
        <div className="w-full h-full pb-10">
            {/* Header */}
            <div className="px-4 md:px-6 py-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                    <div>
                        <h1 className="font-['Playfair_Display'] text-white text-3xl font-semibold tracking-wide cursor-default">
                            Business <span className="text-[#FFE2A0]">Analytics</span>
                        </h1>
                        <p className="text-white text-sm">Deep dive into your business growth and customer behavior</p>
                    </div>

                    <BusinessFilterDropdown 
                        activeFilter={activeFilter} 
                        onFilterChange={setActiveFilter} 
                        listings={userListings} 
                    />
                </div>

                <div className="flex w-full md:w-fit bg-[#3a3a3a] p-1 rounded-xl border border-[#4d4d4d]">
                    {["7D", "30D", "90D", "1Y"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t)}
                            className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                timeframe === t
                                    ? "bg-[#FFE2A0] text-[#3a3a3a] shadow-md"
                                    : "text-[#a0a0a0] hover:text-white hover:bg-[#474133]"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 md:px-6 py-6 space-y-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                    <StatsCard
                        title="Total Listing Views"
                        value={loading ? "—" : stats.profileViews.toLocaleString()}
                        trend={loading ? "—" : stats.profileViewsTrend}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-[#FFE2A0]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                        }
                    />
                    <StatsCard
                        title="Total Interaction"
                        value={loading ? "—" : stats.totalInteractions.toLocaleString()}
                        trend={loading ? "—" : stats.interactionsTrend}
                        icon={<HiOutlineCursorClick className="size-6 text-[#FFE2A0]" />}
                    />
                    <StatsCard
                        title="Listing Saves"
                        value={loading ? "—" : stats.listingSaves.toLocaleString()}
                        trend={loading ? "—" : stats.savesTrend}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-[#FFE2A0]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                            </svg>
                        }
                    />
                    <StatsCard
                        title="Event Attendance"
                        value={loading ? "—" : stats.eventAttendance.toLocaleString()}
                        trend={loading ? "—" : stats.attendanceTrend}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6 text-[#FFE2A0]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12v.75m0 3v.75m0 3v.75m0 3V18M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 9.75h.007v.008H3.75V9.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12.75h.007v.008H3.75V12.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 15.75h.007v.008H3.75V15.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM5.25 4.5h13.5A2.25 2.25 0 0 1 21 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H5.25a2.25 2.25 0 0 1-2.25-2.25V6.75A2.25 2.25 0 0 1 5.25 4.5Z" />
                            </svg>
                        }
                    />
                </div>

                {/* Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                    <div className="lg:col-span-3 bg-[#3a3a3a] border border-[#4d4d4d] rounded-2xl p-6 min-h-[400px] flex flex-col relative overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-white text-xl font-semibold">Audience Engagement</h3>
                        </div>

                        {loading ? (
                            <div className="flex-1 flex flex-col gap-4 pt-2">
                                {/* Fake legend */}
                                <div className="flex gap-4 px-1">
                                <div className="h-3 w-24 bg-[#2e2e2e] animate-pulse rounded-full" />
                                <div className="h-3 w-32 bg-[#2e2e2e] animate-pulse rounded-full" />
                                </div>
                                {/* Chart area */}
                                <div className="flex-1 flex items-end gap-[3%] px-2 pb-2 min-h-[280px]">
                                {[60,85,45,90,55,75,40,95,65,80,50,70].map((h, i) => (
                                    <div
                                    key={i}
                                    className="flex-1 bg-[#2e2e2e] animate-pulse rounded-t-md"
                                    style={{ height: `${h}%` }}
                                    />
                                ))}
                                </div>
                                {/* X-axis */}
                                <div className="flex justify-between px-2 border-t border-[#4d4d4d] pt-3">
                                {[0,1,2,3,4,5].map(i => (
                                    <div key={i} className="h-2 w-10 bg-[#2e2e2e] animate-pulse rounded" />
                                ))}
                                </div>
                            </div>
                            ) : (
                            <EngagementChart series={chartSeries} />
                            )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;