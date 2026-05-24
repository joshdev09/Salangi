import React from "react";

const shimmer = `
  @keyframes shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`bg-[#2a2a2a] rounded-md relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:-translate-x-full before:animate-[shimmer_1.6s_ease-in-out_infinite] ${className}`}
      style={style}
    />
  );
}

/* ─── Category chip row ─── */
function CategoryChips() {
  const chips = [72, 110, 80, 90, 80, 70, 100];
  return (
    <div className="flex flex-wrap gap-2 px-4 md:px-0 mb-4">
      {chips.map((w, i) => (
        <Bone key={i} className="h-9 rounded-full flex-shrink-0" style={{ width: w }} />
      ))}
    </div>
  );
}

/* ─── Listing card skeleton (matches real card layout) ─── */
function ListingCardSkeleton() {
  return (
    <div className="bg-[#1e1e1e] rounded-2xl overflow-hidden mb-4 mx-4 md:mx-0">
      {/* Image carousel area */}
      <div className="relative">
        <Bone className="w-full h-52 md:h-64 rounded-none" />
        {/* badge top-right */}
        <div className="absolute top-3 right-3">
          <Bone className="h-6 w-10 rounded-full" />
        </div>
        {/* heart top-left */}
        <div className="absolute top-3 left-3">
          <Bone className="h-8 w-8 rounded-full" />
        </div>
      </div>

      {/* Card content */}
      <div className="p-4">
        {/* Title + verified */}
        <div className="flex items-center gap-2 mb-2">
          <Bone className="h-5 w-52" />
          <Bone className="h-4 w-4 rounded-full" />
        </div>

        {/* Category badge */}
        <Bone className="h-6 w-24 rounded-full mb-3" />

        {/* Description lines */}
        <Bone className="h-3.5 w-full mb-1.5" />
        <Bone className="h-3.5 w-4/5 mb-4" />

        {/* Location + hours */}
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <Bone className="h-4 w-4 rounded-full flex-shrink-0" />
            <Bone className="h-3.5 w-28" />
          </div>
          <div className="flex items-center gap-1.5">
            <Bone className="h-4 w-4 rounded-full flex-shrink-0" />
            <Bone className="h-3.5 w-24" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Bone className="h-10 flex-1 rounded-xl" />
          <Bone className="h-10 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/* ─── Mobile bottom nav ─── */
function MobileBottomNav() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden bg-[#1a1a1a] border-t border-[#2a2a2a] flex justify-around items-center px-2"
      style={{ height: 60, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Bone className="w-6 h-6 rounded-lg" />
          <Bone className="w-8 h-2" />
        </div>
      ))}
    </div>
  );
}

/* ─── Desktop side nav ─── */
function DesktopSideNav() {
  return (
    <div className="hidden md:flex flex-col items-center gap-6 w-[60px] py-6 bg-[#1a1a1a] border-r border-[#2a2a2a] fixed top-0 left-0 h-full">
      <Bone className="w-9 h-9 rounded-xl" />
      {[1, 2, 3, 4].map((i) => (
        <Bone key={i} className="w-6 h-6 rounded-md" />
      ))}
    </div>
  );
}

/* ─── Desktop top search bar ─── */
function DesktopTopBar() {
  return (
    <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-[#2a2a2a]">
      <Bone className="h-9 w-64 rounded-full" />
      <Bone className="h-9 w-36 rounded-full" />
    </div>
  );
}

/* ─── Main export ─── */
export default function SalangiSkeleton() {
  return (
    <>
      <style>{shimmer}</style>

      <div className="min-h-dvh bg-[#1a1a1a] overflow-x-hidden">

        {/* Desktop side nav */}
        <DesktopSideNav />

        {/* Main content — offset for side nav on desktop */}
        <div className="md:ml-[60px] flex flex-col md:flex-row">

          {/* Left panel (listings) */}
          <div className="w-full md:w-[460px] md:flex-shrink-0 md:h-screen md:overflow-y-auto">

            {/* Desktop top bar */}
            <DesktopTopBar />

            {/* Header — title + tagline */}
            <div className="px-4 pt-12 pb-4 md:pt-6">
              <Bone className="h-10 w-40 mb-2" />
              <div className="flex items-center gap-1.5">
                <Bone className="h-4 w-16" />
                <Bone className="h-4 w-10" />
                <Bone className="h-4 w-8" />
                <Bone className="h-4 w-14" />
              </div>
            </div>

            {/* Category chips */}
            <CategoryChips />

            {/* Listing cards */}
            <ListingCardSkeleton />
            <ListingCardSkeleton />
          </div>

          {/* Right panel — map (desktop only) */}
          <div className="hidden md:block flex-1 h-screen bg-[#222] relative">
            <Bone className="w-full h-full rounded-none" />
          </div>
        </div>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </>
  );
}