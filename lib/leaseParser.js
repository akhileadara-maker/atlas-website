// Best-effort heuristics that pull knowledge-base fields out of the plain text
// of a lease or tenant handbook. Runs entirely in the browser — no network, no
// external API. Every field is optional: anything we can't confidently find is
// left blank for the landlord to fill in. The landlord reviews and edits all
// values before saving, so over-matching is worse than leaving a field empty.

// "1,800" / "$1,800.00 " -> "$1,800". Returns "" for empty input.
function money(raw) {
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/[.,]+$/, "");
  return cleaned ? "$" + cleaned : "";
}

// First capturing group across a list of patterns, else "".
function firstMatch(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

// Find `valueRe` within a window of characters around the first `anchorRe`
// match — used to tie a phone/email to the word "maintenance"/"emergency".
function near(text, anchorRe, valueRe, span = 90) {
  const m = text.match(anchorRe);
  if (!m) return "";
  const start = Math.max(0, m.index - span);
  const window = text.slice(start, m.index + m[0].length + span);
  const v = window.match(valueRe);
  return v ? v[1].trim() : "";
}

// First sentence that mentions `re`, trimmed to a reasonable length.
function firstSentence(text, re, maxLen = 180) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  for (const s of sentences) {
    if (re.test(s)) {
      const clean = s.replace(/\s+/g, " ").trim();
      return clean.length > maxLen ? clean.slice(0, maxLen).trim() + "…" : clean;
    }
  }
  return "";
}

const PHONE = /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
const EMAIL = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;

// Returns an object keyed by the KnowledgeBaseEditor form field names. Only the
// fields it can find are populated; the rest are "".
export function parseLeaseText(rawText) {
  // Collapse whitespace but keep sentence punctuation for sentence splitting.
  const flat = (rawText || "").replace(/\s+/g, " ").trim();
  if (!flat) {
    return {
      monthly_rent: "", late_fee: "", grace_period: "", pet_allowed: "",
      pet_deposit: "", pet_monthly_fee: "", maintenance_contact: "",
      office_hours: "", parking_policy: "",
    };
  }

  const monthly_rent = money(
    firstMatch(flat, [
      /monthly rent(?:al)?(?:\s*(?:amount|rate|is|of|:|shall be|will be))?[^$\d]{0,15}\$?\s?([\d][\d,]*(?:\.\d{2})?)/i,
      /rent(?:\s*(?:is|of|:|shall be|amount))?[^$\d]{0,12}\$\s?([\d][\d,]*(?:\.\d{2})?)\s*(?:per month|\/\s?month|monthly|a month|per mo)\b/i,
      /\$\s?([\d][\d,]*(?:\.\d{2})?)\s*(?:per month|\/\s?month|monthly|a month)\b/i,
    ])
  );

  let late_fee = money(
    firstMatch(flat, [
      /late (?:fee|charge|payment (?:fee|charge))(?:\s*(?:of|is|:|shall be|will be|equal to))?[^$%\d]{0,15}\$\s?([\d][\d,]*(?:\.\d{2})?)/i,
      /\$\s?([\d][\d,]*(?:\.\d{2})?)\s*late (?:fee|charge)/i,
    ])
  );
  if (!late_fee) {
    const pct = firstMatch(flat, [
      /late (?:fee|charge)(?:\s*(?:of|is|:|equal to))?[^%\d]{0,12}(\d{1,2}(?:\.\d+)?)\s*%/i,
    ]);
    if (pct) late_fee = pct + "%";
  }

  const grace_period = firstMatch(flat, [
    /grace period(?:\s*(?:of|is|:))?[^.\d]{0,15}(\d{1,2})\s*(?:calendar\s*)?days?/i,
    /(\d{1,2})[-\s]?day grace period/i,
  ]);

  let pet_allowed = "";
  if (/\b(?:no pets?|pets?\s+(?:are\s+)?(?:not\s+(?:allowed|permitted)|prohibited)|no animals|pet[-\s]?free)\b/i.test(flat)) {
    pet_allowed = "no";
  } else if (
    /\bpets?\s+(?:are\s+)?(?:allowed|permitted|welcome)\b/i.test(flat) ||
    /\bpet (?:deposit|rent|fee|policy|addendum)\b/i.test(flat)
  ) {
    pet_allowed = "yes";
  }

  const pet_deposit = money(
    firstMatch(flat, [
      /pet deposit(?:\s*(?:of|is|:|shall be))?[^$\d]{0,15}\$?\s?([\d][\d,]*(?:\.\d{2})?)/i,
    ])
  );

  const pet_monthly_fee = money(
    firstMatch(flat, [
      /pet (?:rent|fee)(?:\s*(?:of|is|:|shall be))?[^$\d]{0,15}\$?\s?([\d][\d,]*(?:\.\d{2})?)\s*(?:per month|\/\s?month|monthly|a month)/i,
      /\$\s?([\d][\d,]*(?:\.\d{2})?)\s*(?:per month|monthly)\s*(?:pet (?:rent|fee))/i,
    ])
  );

  const maintenance_contact =
    near(flat, /maintenance|emergency|repairs?/i, PHONE) ||
    near(flat, /maintenance|emergency/i, EMAIL);

  // Capture text after an "office hours" label up to the sentence end, then
  // only trust it if it actually names a time (so "office hours vary" drops).
  let office_hours = firstMatch(flat, [
    /(?:office|leasing(?: office)?|business)\s*hours?(?:\s+(?:are|of operation))?\s*[:\-]?\s*([^.\n]{5,60})/i,
    /hours of operation\s*[:\-]?\s*([^.\n]{5,60})/i,
  ]);
  if (office_hours && !/\d|\bnoon\b/i.test(office_hours)) office_hours = "";
  office_hours = office_hours.replace(/[\s,;:.\-–—]+$/, "").trim();

  const parking_policy = firstSentence(flat, /\bparking\b/i);

  return {
    monthly_rent,
    late_fee,
    grace_period,
    pet_allowed,
    pet_deposit,
    pet_monthly_fee,
    maintenance_contact,
    office_hours,
    parking_policy,
  };
}
