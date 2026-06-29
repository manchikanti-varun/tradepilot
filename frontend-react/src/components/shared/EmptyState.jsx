export default function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-overlay flex items-center justify-center">
          <Icon size={24} className="text-text-muted" />
        </div>
      )}
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {subtitle && <p className="text-xs text-text-muted text-center max-w-[260px] leading-relaxed">{subtitle}</p>}
    </div>
  );
}
