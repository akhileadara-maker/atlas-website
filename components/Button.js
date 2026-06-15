import Link from "next/link";

// Polymorphic button: renders a Next <Link> when `href` is given, otherwise a <button>.
// Variants: teal (filled), ghost (outline), gold, light (for dark backgrounds).
const variants = {
  teal: "bg-teal text-white hover:bg-teal-600 shadow-lg shadow-teal/25 hover:shadow-teal/40",
  ghost: "bg-transparent text-navy border border-navy/20 hover:border-teal hover:text-teal",
  ghostLight: "bg-transparent text-cream border border-cream/30 hover:border-cream hover:bg-cream/10",
  gold: "bg-gold text-navy hover:brightness-105 shadow-lg shadow-gold/25",
  light: "bg-cream text-navy hover:bg-white shadow-lg",
};

const sizes = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export default function Button({
  href,
  variant = "teal",
  size = "md",
  className = "",
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
