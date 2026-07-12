"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, SignUpButton, UserButton } from "@clerk/nextjs";
import Logo from "./Logo";

const links = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Demo", href: "/demo" },
];

const navLink = "text-sm font-medium text-navy/70 transition-colors hover:text-teal";
const tealBtn =
  "inline-flex items-center justify-center rounded-full bg-teal px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-600";

export default function Navbar() {
  const { isSignedIn } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // The Log in / Start Free Trial pair, or the signed-in account controls.
  const AuthActions = ({ block = false }) =>
    isSignedIn ? (
      <>
        <Link href="/dashboard" className={block ? `${tealBtn} w-full` : navLink}>
          Dashboard
        </Link>
        <UserButton afterSignOutUrl="/" />
      </>
    ) : (
      <>
        <Link href="/signin" className={block ? `${navLink} py-2` : navLink}>
          Log in
        </Link>
        <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
          <button className={block ? `${tealBtn} w-full` : tealBtn}>Start Free Trial</button>
        </SignUpButton>
      </>
    );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-navy/10 bg-cream/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6 lg:px-8">
        <Logo />

        <ul className="hidden items-center gap-9 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={navLink}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden h-10 items-center gap-5 md:flex">
          <AuthActions />
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-0.5 w-6 rounded bg-navy transition-all duration-300 ${
                open && i === 0 ? "translate-y-2 rotate-45" : ""
              } ${open && i === 1 ? "opacity-0" : ""} ${
                open && i === 2 ? "-translate-y-2 -rotate-45" : ""
              }`}
            />
          ))}
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 top-20 z-40 bg-cream px-6 transition-all duration-300 md:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <ul className="flex flex-col gap-1 pt-6">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block border-b border-navy/10 py-4 text-lg font-medium text-navy"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div
          className="flex flex-col gap-3 pt-6"
          onClickCapture={() => setOpen(false)}
        >
          <AuthActions block />
        </div>
      </div>
    </header>
  );
}
