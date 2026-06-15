import Container from "./Container";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { CheckIcon, DashIcon } from "./icons";

const columns = ["Atlas", "Legacy software", "AI point tools", "Manual & VA"];

// f = full, p = partial, n = none — in column order above.
const rows = [
  { label: "Unified comms + lease + dispatch", marks: ["f", "n", "n", "n"] },
  { label: "AI that acts, not just answers", marks: ["f", "n", "p", "n"] },
  { label: "24/7 voice and chat, any language", marks: ["f", "n", "p", "n"] },
  { label: "Lease intelligence + renewal flags", marks: ["f", "p", "n", "n"] },
  { label: "Sensitive data masked (SOC 2-aligned)", marks: ["f", "p", "p", "n"] },
  { label: "Right-sized for independent & mid-market", marks: ["f", "n", "p", "f"] },
];

function Mark({ type }) {
  if (type === "f")
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal/15 text-teal">
        <CheckIcon className="h-4 w-4" />
      </span>
    );
  if (type === "p")
    return <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" title="Partial" />;
  return (
    <span className="text-navy/25">
      <DashIcon className="h-4 w-4" />
    </span>
  );
}

export default function ComparisonTable() {
  return (
    <section className="bg-white py-24 lg:py-32">
      <Container>
        <SectionHeading
          eyebrow="Why modern operators choose Atlas"
          title="One platform that does what three tools can't."
          subtitle="Atlas unifies communications, leases, and maintenance in one system. Unlike traditional workflows that only record, Atlas takes action."
        />

        <Reveal className="mt-16">
          <div className="overflow-x-auto rounded-3xl border border-navy/10">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr>
                  <th className="p-5" />
                  {columns.map((col, i) => (
                    <th
                      key={col}
                      className={`p-5 text-center text-sm font-bold ${
                        i === 0 ? "rounded-t-2xl bg-teal/10 text-teal-600" : "text-navy/60"
                      }`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={row.label} className={ri % 2 ? "bg-cream/60" : ""}>
                    <td className="p-5 text-sm font-medium text-navy">{row.label}</td>
                    {row.marks.map((mark, ci) => (
                      <td
                        key={ci}
                        className={`p-5 text-center ${ci === 0 ? "bg-teal/[0.07]" : ""}`}
                      >
                        <span className="inline-flex justify-center">
                          <Mark type={mark} />
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-navy/55">
            <span className="flex items-center gap-2">
              <Mark type="f" /> Full
            </span>
            <span className="flex items-center gap-2">
              <Mark type="p" /> Partial
            </span>
            <span className="flex items-center gap-2">
              <Mark type="n" /> Not built for this
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
