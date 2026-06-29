export default function Skeleton({ className = '', rows = 1 }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg bg-gradient-to-r from-border-dim via-overlay to-border-dim bg-[length:200%_100%] animate-shimmer"
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border-dim rounded-xl p-5 space-y-3">
      <div className="h-3 w-20 rounded-md bg-gradient-to-r from-border-dim via-overlay to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-5 w-44 rounded-md bg-gradient-to-r from-border-dim via-overlay to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-3 w-full rounded-md bg-gradient-to-r from-border-dim via-overlay to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-3 w-3/4 rounded-md bg-gradient-to-r from-border-dim via-overlay to-border-dim bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}
