export default function SectionLabel({ children, className = '' }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider text-text-muted font-semibold ${className}`}>
      {children}
    </span>
  );
}
