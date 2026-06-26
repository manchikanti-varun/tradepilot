export default function Skeleton({ className = '', rows = 1 }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-gradient-to-r from-border-dim via-border-mid to-border-dim bg-[length:200%_100%] animate-shimmer"
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface border border-border-dim rounded-lg p-4 space-y-3">
      <div className="h-3 w-24 rounded bg-gradient-to-r from-border-dim via-border-mid to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-5 w-40 rounded bg-gradient-to-r from-border-dim via-border-mid to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-3 w-full rounded bg-gradient-to-r from-border-dim via-border-mid to-border-dim bg-[length:200%_100%] animate-shimmer" />
      <div className="h-3 w-3/4 rounded bg-gradient-to-r from-border-dim via-border-mid to-border-dim bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}
