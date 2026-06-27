"use client";

import { useActionState, useState } from "react";
import { saveKnowledgeBase } from "@/app/dashboard/[id]/actions";
import { parseLeaseText } from "@/lib/leaseParser";

const input =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";
const uploadBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-full border border-teal/30 bg-teal/10 px-5 py-2.5 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal/20";

// Pull the plain text out of every page of a PDF, entirely in the browser.
// PDF.js is loaded on demand (only when a file is chosen) and its worker is
// served from our own origin (/public) — no external/CDN calls.
async function extractPdfText(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str || "").join(" ") + "\n";
  }
  return text;
}

export default function KnowledgeBaseEditor({ propertyId, initial = {}, hasAgent }) {
  const [state, formAction, pending] = useActionState(saveKnowledgeBase, {});

  // The form fields are uncontrolled (defaultValue). When a PDF is parsed we
  // merge the extracted values into `data` and bump `version` to remount the
  // fields with the new defaults — the landlord can still edit before saving.
  const [data, setData] = useState(initial || {});
  const [version, setVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null); // { type: "success" | "error", text }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-selected later
    if (!file) return;

    if (file.type && file.type !== "application/pdf") {
      setUploadMsg({ type: "error", text: "Please choose a PDF file." });
      return;
    }

    setUploadMsg(null);
    setUploading(true);
    try {
      const text = await extractPdfText(file);
      const fields = parseLeaseText(text);

      const merged = { ...data };
      let count = 0;
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.trim() !== "") {
          merged[key] = value;
          count += 1;
        }
      }
      setData(merged);
      setVersion((n) => n + 1);
      setUploadMsg({
        type: count ? "success" : "error",
        text: count
          ? `Filled ${count} field${count === 1 ? "" : "s"} from your PDF — review and edit below, then save.`
          : "Couldn't pull details from that PDF automatically (it may be scanned). Fill the fields in manually.",
      });
    } catch {
      setUploadMsg({
        type: "error",
        text: "Couldn't read that PDF. It may be image-only or password-protected — fill the fields in manually.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PDF auto-fill — reads a lease/handbook in the browser and pre-fills the form */}
      <div className="rounded-2xl border border-dashed border-navy/20 bg-cream/60 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${uploadBtn} ${uploading ? "pointer-events-none opacity-60" : ""}`}>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onFileChange}
              disabled={uploading}
            />
            {uploading ? "Reading PDF…" : "Upload lease or tenant handbook"}
          </label>
          <p className="text-xs text-navy/50">
            Atlas reads the PDF in your browser and fills in the fields below — you review and edit before saving.
          </p>
        </div>
        {uploadMsg && (
          <p
            className={`mt-3 text-sm font-medium ${
              uploadMsg.type === "error" ? "text-coral" : "text-teal-600"
            }`}
          >
            {uploadMsg.type === "success" ? "✓ " : ""}
            {uploadMsg.text}
          </p>
        )}
      </div>

      <form key={version} action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={propertyId} />

        {/* Agent language */}
        <div>
          <label className={label}>Preferred language</label>
          <input name="preferred_language" defaultValue={data.preferred_language} placeholder="English" className={input} />
          <p className="mt-1 text-xs text-navy/45">
            Your agent always replies in the tenant&apos;s language, and defaults to this one.
          </p>
        </div>

        {/* Rent & fees */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Monthly rent</label>
            <input name="monthly_rent" defaultValue={data.monthly_rent} placeholder="$1,800" className={input} />
          </div>
          <div>
            <label className={label}>Late fee</label>
            <input name="late_fee" defaultValue={data.late_fee} placeholder="$75" className={input} />
          </div>
          <div>
            <label className={label}>Grace period (days)</label>
            <input name="grace_period" type="number" min="0" defaultValue={data.grace_period} placeholder="5" className={input} />
          </div>
        </div>

        {/* Pet policy */}
        <div className="rounded-2xl border border-navy/10 bg-cream/60 p-5">
          <p className="mb-3 text-sm font-semibold text-navy">Pet policy</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Pets allowed?</label>
              <select name="pet_allowed" defaultValue={data.pet_allowed === "yes" ? "yes" : "no"} className={input}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div>
              <label className={label}>Pet deposit</label>
              <input name="pet_deposit" defaultValue={data.pet_deposit} placeholder="$300" className={input} />
            </div>
            <div>
              <label className={label}>Monthly pet fee</label>
              <input name="pet_monthly_fee" defaultValue={data.pet_monthly_fee} placeholder="$25" className={input} />
            </div>
          </div>
        </div>

        {/* Contact & hours */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Maintenance emergency contact</label>
            <input name="maintenance_contact" defaultValue={data.maintenance_contact} placeholder="(555) 555-0123" className={input} />
          </div>
          <div>
            <label className={label}>Office hours</label>
            <input name="office_hours" defaultValue={data.office_hours} placeholder="Mon–Fri, 9am–5pm" className={input} />
          </div>
        </div>

        <div>
          <label className={label}>Parking policy</label>
          <input name="parking_policy" defaultValue={data.parking_policy} placeholder="One assigned spot per unit; street parking for guests" className={input} />
        </div>

        <div>
          <label className={label}>Custom notes / rules</label>
          <textarea name="custom_notes" rows={4} defaultValue={data.custom_notes} placeholder="Quiet hours after 10pm, trash pickup Tuesdays, no smoking indoors…" className={input} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:-translate-y-0.5 hover:bg-teal-600 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save & update agent"}
          </button>
          {state?.success && (
            <span className="text-sm font-semibold text-teal-600">✓ Saved — your agent now knows this.</span>
          )}
          {state?.error && <span className="text-sm font-medium text-coral">{state.error}</span>}
          {!hasAgent && !state?.error && (
            <span className="text-sm text-navy/45">Saved info is stored; it syncs to the agent once the agent is ready.</span>
          )}
        </div>
      </form>
    </div>
  );
}
