import Link from "next/link";
import Logo from "./Logo";
import Container from "./Container";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Demo", href: "/demo" },
      { label: "Security", href: "/#security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/about#team" },
      { label: "Contact", href: "mailto:hello@atlas.com" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/#security" },
      { label: "Terms", href: "/#security" },
      { label: "SOC 2", href: "/#security" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy text-bodygray">
      <Container className="py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-5 text-bodygray/70">
              Modern tools for the people who keep America housed. One platform —
              every property, every tenant, every lease.
            </p>
            <div className="mt-6 space-y-1.5 text-sm text-bodygray/70">
              <p>
                <a href="mailto:hello@atlas.com" className="transition-colors hover:text-gold">
                  hello@atlas.com
                </a>
              </p>
              <p>
                <a href="https://atlas.com" className="transition-colors hover:text-gold">
                  atlas.com
                </a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="font-sans text-sm font-semibold uppercase tracking-wider text-gold">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-bodygray/70 transition-colors hover:text-cream"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-sm text-bodygray/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Atlas, Inc. All rights reserved.</p>
          <p>Built on Microsoft Azure · SOC 2 Type II aligned.</p>
        </div>
      </Container>
    </footer>
  );
}
