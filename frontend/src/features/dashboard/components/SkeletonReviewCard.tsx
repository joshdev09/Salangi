export default function SkeletonReviewCard() {
  return (
    <div className="flex items-start gap-4 py-6 border-b border-[#2e2e2e]">
      {/* Avatar circle */}
      <div className="w-12 h-12 rounded-full bg-[#2e2e2e] animate-pulse flex-shrink-0" />

      <div className="flex-1 min-w-0">
        {/* Name + business badge row */}
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-32 rounded-md bg-[#2e2e2e] animate-pulse" />
          <div className="h-5 w-28 rounded-full bg-[#2e2e2e] animate-pulse" />
        </div>

        {/* Stars + date row */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-4 w-24 rounded-md bg-[#2e2e2e] animate-pulse" />
          <div className="h-3 w-20 rounded-md bg-[#2e2e2e] animate-pulse" />
        </div>

        {/* Review text line */}
        <div className="h-4 w-3/4 rounded-md bg-[#2e2e2e] animate-pulse" />
      </div>
    </div>
  );
}