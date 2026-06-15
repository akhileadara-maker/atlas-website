"use client";

import { useState } from "react";
import Container from "./Container";
import SectionHeading from "./SectionHeading";
import { PlusIcon } from "./icons";

const faqs = [
  {
    q: "What if Atlas makes a mistake?",
    a: "Atlas escalates anything it's uncertain about straight to you — you're always in control of the final call. It acts confidently on the routine and defers on the rest.",
  },
  {
    q: "What if it goes down?",
    a: "Atlas runs on enterprise Microsoft Azure infrastructure with backups and 24/7 monitoring, backed by fast human support. Uptime is guaranteed at 99.9%.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Every plan starts with a free 30-day trial, and we don't ask for a card until you decide to keep Atlas. Setup takes an afternoon.",
  },
  {
    q: "Can Atlas handle mixed portfolios?",
    a: "Yes — that's exactly who we built it for. Residential, commercial, and HOA properties all live in one unified platform, unlike tools built only for large apartment complexes.",
  },
  {
    q: "Is my tenants' data private?",
    a: "Always. Each landlord's data is isolated in its own private Azure tenant, tenants only ever see their own information, and sensitive fields are masked before the AI sees them.",
  },
  {
    q: "How long does it take to get going?",
    a: "Hours, not months. Import your leases, connect your tools, and Atlas is answering tenants the same day — no lengthy implementation project required.",
  },
];

function Item({ faq, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-lg font-semibold text-navy">{faq.q}</span>
        <span
          className={`shrink-0 text-teal transition-transform duration-300 ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          <PlusIcon className="h-5 w-5" />
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 leading-relaxed text-navy/65">{faq.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="py-24 lg:py-32">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="Common questions" title="Questions, answered." />
        <div className="mt-12 space-y-4">
          {faqs.map((faq, i) => (
            <Item
              key={faq.q}
              faq={faq}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
