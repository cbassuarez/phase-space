import clsx from "clsx";

interface VersionBadgeProps {
  label: string;
  className?: string;
}

export function VersionBadge({ label, className }: VersionBadgeProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-stretch overflow-hidden rounded-sm border border-[color:var(--ps-border-strong)] bg-white/80 text-[11px] font-medium text-[color:var(--ps-accent)] shadow-[var(--ps-shadow-inner)]",
        className
      )}
    >
      <div className="flex">
        <span className="w-[3px] bg-red-500" />
        <span className="w-[3px] bg-yellow-400" />
        <span className="w-[3px] bg-blue-500" />
      </div>
      <span className="px-2 py-1 leading-none">{label}</span>
    </div>
  );
}

export default VersionBadge;
