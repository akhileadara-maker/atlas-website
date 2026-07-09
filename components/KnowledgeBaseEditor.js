"use client";

import { useActionState } from "react";
import { saveKnowledgeBase } from "@/app/dashboard/[id]/actions";

const input =
  "w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-navy outline-none transition-colors focus:border-teal";
const label = "mb-1 block text-sm font-medium text-navy/70";

export default function KnowledgeBaseEditor({ propertyId, initial = {}, hasAgent }) {
  const [state, formAction, pending] = useActionState(saveKnowledgeBase, {});
  const kb = initial || {};

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={propertyId} />

      {/* Agent language */}
      <div>
        <label className={label}>Preferred language</label>
        <input name="preferred_language" defaultValue={kb.preferred_language} placeholder="English" className={input} />
        <p className="mt-1 text-xs text-navy/45">
          Your agent always replies in the tenant&apos;s language, and defaults to this one.
        </p>
      </div>

      {/* Rent & fees */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Monthly rent</label>
          <input name="monthly_rent" defaultValue={kb.monthly_rent} placeholder="$1,800" className={input} />
        </div>
        <div>
          <label className={label}>Late fee</label>
          <input name="late_fee" defaultValue={kb.late_fee} placeholder="$75" className={input} />
        </div>
        <div>
          <label className={label}>Grace period (days)</label>
          <input name="grace_period" type="number" min="0" defaultValue={kb.grace_period} placeholder="5" className={input} />
        </div>
      </div>

      {/* Pet policy */}
      <div className="rounded-2xl border border-navy/10 bg-cream/60 p-5">
        <p className="mb-3 text-sm font-semibold text-navy">Pet policy</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Pets allowed?</label>
            <select name="pet_allowed" defaultValue={kb.pet_allowed === "yes" ? "yes" : "no"} className={input}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div>
            <label className={label}>Pet deposit</label>
            <input name="pet_deposit" defaultValue={kb.pet_deposit} placeholder="$300" className={input} />
          </div>
          <div>
            <label className={label}>Monthly pet fee</label>
            <input name="pet_monthly_fee" defaultValue={kb.pet_monthly_fee} placeholder="$25" className={input} />
          </div>
        </div>
      </div>

      {/* Contact & hours */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Maintenance emergency contact</label>
          <input name="maintenance_contact" defaultValue={kb.maintenance_contact} placeholder="(555) 555-0123" className={input} />
        </div>
        <div>
          <label className={label}>Office hours</label>
          <input name="office_hours" defaultValue={kb.office_hours} placeholder="Mon–Fri, 9am–5pm" className={input} />
        </div>
      </div>

      {/* Emergency instructions */}
      <div>
        <label className={label}>Emergency instructions</label>
        <textarea
          name="emergency_instructions"
          rows={3}
          defaultValue={kb.emergency_instructions}
          placeholder="What a tenant should do right now in a flood, fire, or lockout — e.g. shut off the main water valve under the kitchen sink; call 911 for fire; after-hours lockouts call (555) 555-0199…"
          className={input}
        />
        <p className="mt-1 text-xs text-navy/45">
          What a tenant should do right now in a flood, fire, or lockout. Your agent leads with this in an emergency.
        </p>
      </div>

      <div>
        <label className={label}>Parking policy</label>
        <input name="parking_policy" defaultValue={kb.parking_policy} placeholder="One assigned spot per unit; street parking for guests" className={input} />
      </div>

      {/* Lease & tenancy policies */}
      <div className="rounded-2xl border border-navy/10 bg-cream/60 p-5">
        <p className="mb-3 text-sm font-semibold text-navy">Lease &amp; tenancy policies</p>
        <div className="space-y-4">
          <div>
            <label className={label}>Guest policy</label>
            <textarea
              name="guest_policy"
              rows={2}
              defaultValue={kb.guest_policy}
              placeholder="Overnight guests up to 14 nights per quarter; longer stays need written approval…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Lease renewal policy</label>
            <textarea
              name="lease_renewal_policy"
              rows={2}
              defaultValue={kb.lease_renewal_policy}
              placeholder="Renewal offers go out 90 days before lease end; rent may adjust to market…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Subletting policy</label>
            <textarea
              name="subletting_policy"
              rows={2}
              defaultValue={kb.subletting_policy}
              placeholder="Subletting requires written landlord approval and a screened subtenant…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Break-lease / early termination policy</label>
            <textarea
              name="break_lease_policy"
              rows={2}
              defaultValue={kb.break_lease_policy}
              placeholder="Two months' rent as an early-termination fee with 60 days' written notice…"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Move-out &amp; deposit return process</label>
            <textarea
              name="move_out_process"
              rows={2}
              defaultValue={kb.move_out_process}
              placeholder="Schedule a move-out inspection; deposit returned within 21 days minus documented damages…"
              className={input}
            />
          </div>
        </div>
      </div>

      <div>
        <label className={label}>Custom notes / rules</label>
        <textarea name="custom_notes" rows={4} defaultValue={kb.custom_notes} placeholder="Quiet hours after 10pm, trash pickup Tuesdays, no smoking indoors…" className={input} />
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
  );
}
