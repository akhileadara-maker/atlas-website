// Centered max-width wrapper used by every section for consistent gutters.
export default function Container({ className = "", children }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
