export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      {Icon && <Icon size={28} className="text-text-muted" />}
      <p className="text-sm text-text-secondary">{title}</p>
      {subtitle && <p className="text-xs text-text-muted text-center max-w-[240px]">{subtitle}</p>}
    </div>
  );
}
