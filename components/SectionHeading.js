import Reveal from "./Reveal";

// Eyebrow label + serif title + optional subtitle, used at the top of most sections.
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  light = false,
  eyebrowColor = "text-teal",
  className = "",
}) {
  const alignment = align === "center" ? "mx-auto text-center items-center" : "text-left items-start";
  return (
    <Reveal className={`flex max-w-2xl flex-col gap-4 ${alignment} ${className}`}>
      {eyebrow && <span className={`eyebrow ${eyebrowColor}`}>{eyebrow}</span>}
      <h2
        className={`text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-[2.75rem] ${
          light ? "text-cream" : "text-navy"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`text-lg leading-relaxed ${light ? "text-bodygray/80" : "text-navy/60"}`}>
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
