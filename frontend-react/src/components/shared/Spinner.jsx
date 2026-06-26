export default function Spinner({ size = 16, className = '' }) {
  return (
    <div
      className={`border-2 border-border-mid border-t-info rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
