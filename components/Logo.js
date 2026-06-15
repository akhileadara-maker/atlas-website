import Link from "next/link";

// The Atlas wordmark: a small gold-ringed mark + serif "Atlas" with a gold dot,
// mirroring the deck's brand treatment.
export default function Logo({ light = false, className = "" }) {
  return (
    <Link
      href="/"
      aria-label="Atlas home"
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <span className="relative inline-flex h-7 w-7 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-[3px] border-gold transition-transform duration-300 group-hover:scale-110" />
        <span className="h-2 w-2 rounded-full bg-gold" />
      </span>
      <span
        className={`font-serif text-2xl font-bold tracking-tight ${
          light ? "text-cream" : "text-navy"
        }`}
      >
        Atlas<span className="text-gold">.</span>
      </span>
    </Link>
  );
}
