interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#21262d] ${className}`}
      style={{ boxShadow: 'inset 0 0 0 1px #30363d' }}
    />
  );
}
