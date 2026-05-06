// src/features/dashboard/components/SkeletonCard.tsx
// Mirrors BusinessCard pixel-for-pixel:
//   h-80 image | heart TL | counter TR | dot indicators
//   name + verified | category badge + star rating
//   2-line description | location + hours | two buttons

export default function SkeletonCard() {
  return (
    <div className="w-full max-w-120 bg-[#333333] rounded-xl overflow-hidden flex flex-col shrink-0 border border-zinc-800/50">

      {/* ── Image area (h-80 matches BusinessCard) ── */}
      <div className="relative w-full h-80 bg-[#2a2a2a] animate-pulse">

        {/* Heart button — top left */}
        <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-[#3a3a3a]" />

        {/* Image counter badge — top right e.g. "1 / 2" */}
        <div className="absolute top-3 right-3 w-10 h-6 rounded-full bg-[#3a3a3a]" />

        {/* Dot indicators — bottom center */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          <div className="w-4 h-1.5 rounded-full bg-[#3a3a3a]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a3a]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#3a3a3a]" />
        </div>
      </div>

      {/* ── Card body (p-6 matches BusinessCard) ── */}
      <div className="p-6 flex flex-col flex-1">

        {/* Name + verified icon */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-48 h-6 rounded bg-[#2e2e2e] animate-pulse" />
          <div className="w-4 h-4 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
        </div>

        {/* Category badge + star rating — same row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-6 rounded border border-[#3a3a3a] bg-[#2e2e2e] animate-pulse" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#2e2e2e] animate-pulse" />
            <div className="w-8 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
        </div>

        {/* Description — 2 lines */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="w-full h-3.5 rounded bg-[#2e2e2e] animate-pulse" />
          <div className="w-4/5 h-3.5 rounded bg-[#2e2e2e] animate-pulse" />
        </div>

        {/* Location + hours meta row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
            <div className="w-32 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
            <div className="w-28 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
        </div>

        {/* Action buttons: "Show in maps" (flex-1) + "Share" */}
        <div className="flex gap-3 mt-auto">
          <div className="flex-1 h-11 rounded-xl bg-[#2e2e2e] animate-pulse" />
          <div className="w-24 h-11 rounded-xl bg-[#2e2e2e] animate-pulse" />
        </div>

      </div>
    </div>
  );
}