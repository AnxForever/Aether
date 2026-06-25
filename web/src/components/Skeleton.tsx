interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-white/5 rounded-sm overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}
