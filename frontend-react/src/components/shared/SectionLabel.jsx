export default function SectionLabel({ children, className = '' }) {
  return (
    <span className={`text-section uppercase text-text-muted font-medium ${className}`}>
      {children}
    </span>
  );
}
