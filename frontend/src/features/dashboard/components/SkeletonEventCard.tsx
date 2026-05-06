// src/features/dashboard/components/SkeletonEventCard.tsx
// Mirrors EventCard pixel-for-pixel:
//   h-72 image | date badge BL | delete btn TR (business) | interest count BR
//   title (Playfair-sized) + organizer | 2-line description
//   location / time / date rows | interest count + Interested button

export default function SkeletonEventCard() {
  return (
    <div className="w-full max-w-md bg-[#333333] rounded-xl overflow-hidden border border-zinc-800/50 flex flex-col h-full">

      {/* ── Image area (h-72 matches EventCard) ── */}
      <div className="relative h-72 w-full bg-[#2a2a2a] animate-pulse">

        {/* Date badge — bottom left */}
        <div className="absolute bottom-4 left-4 w-28 h-6 rounded-full bg-[#3a3a3a]" />

        {/* Image counter — bottom center (when multiple images) */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-5 rounded-full bg-[#3a3a3a]" />
      </div>

      {/* ── Card body (p-6 matches EventCard) ── */}
      <div className="p-6 flex flex-col flex-1">

        {/* Title — large (Playfair 2xl) */}
        <div className="w-4/5 h-7 rounded bg-[#2e2e2e] animate-pulse mb-1" />
        <div className="w-3/5 h-7 rounded bg-[#2e2e2e] animate-pulse mb-1" />

        {/* Organizer — small gold text */}
        <div className="w-32 h-3 rounded bg-[#2e2e2e] animate-pulse mt-1 mb-4" />

        {/* Description — 2 lines */}
        <div className="flex flex-col gap-2 mb-4 h-10">
          <div className="w-full h-3.5 rounded bg-[#2e2e2e] animate-pulse" />
          <div className="w-3/4 h-3.5 rounded bg-[#2e2e2e] animate-pulse" />
        </div>

        {/* Location / time / date meta rows */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
            <div className="w-28 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
            <div className="w-20 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />
            <div className="w-24 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
        </div>

        {/* Footer: interest count (left) + Interested button (right) */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#2e2e2e] animate-pulse" />
            <div className="w-20 h-3 rounded bg-[#2e2e2e] animate-pulse" />
          </div>
          <div className="w-32 h-11 rounded-xl bg-[#2e2e2e] animate-pulse" />
        </div>

      </div>
    </div>
  );
}