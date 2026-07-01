// Branded, inline-styled HTML emails for Atlas landlord notifications. Pure
// functions — each returns { subject, html }. Email clients strip <style>/class,
// so everything is inline. Brand palette matches app/globals.css:
//   navy #1a2a41 · teal #2a9d8e · cream #fafaf8 · gold #d3a476 · coral #d97e69

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://atlas.com").replace(/\/$/, "");

// Escape user-supplied content before dropping it into email HTML.
function esc(v) {
  return (v == null ? "" : String(v))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function daysLeft(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((d.getTime() - Date.now()) / 86_400_000));
}

function h1(text) {
  return `<h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a2a41;">${esc(text)}</h1>`;
}

function p(html) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#1a2a41;">${html}</p>`;
}

function button(href, text) {
  return `<a href="${href}" style="display:inline-block;background:#2a9d8e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px;">${esc(text)}</a>`;
}

function detailRow(labelText, valueHtml) {
  return `<tr>
    <td style="padding:8px 0;font-size:11px;color:#1a2a41;opacity:0.5;text-transform:uppercase;letter-spacing:0.06em;width:120px;vertical-align:top;">${esc(labelText)}</td>
    <td style="padding:8px 0;font-size:14px;color:#1a2a41;">${valueHtml}</td>
  </tr>`;
}

// Softer email-friendly tints of the app's urgency palette.
const URGENCY_PILL = {
  urgent: { label: "Urgent", bg: "#fbe9e5", fg: "#c25842" },
  normal: { label: "Normal", bg: "#f6ecdf", fg: "#a9793f" },
  low: { label: "Low", bg: "#eef1f5", fg: "#5a6b82" },
};

function urgencyPill(urgency) {
  const pill = URGENCY_PILL[urgency] || URGENCY_PILL.normal;
  return `<span style="display:inline-block;background:${pill.bg};color:${pill.fg};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;">${pill.label}</span>`;
}

// Shared shell: cream backdrop, white rounded card, navy header with the Atlas
// wordmark + teal dot, muted footer.
function layout(contentHtml, { preview = "" } = {}) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas</title></head>
<body style="margin:0;padding:0;background:#fafaf8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a2a41;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e8edf2;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#1a2a41;padding:20px 28px;">
          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Atlas</span>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#2a9d8e;margin-left:8px;"></span>
        </td></tr>
        <tr><td style="padding:28px;">${contentHtml}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #e8edf2;">
          <p style="margin:0;font-size:12px;color:#1a2a41;opacity:0.5;">You're receiving this because you manage properties on Atlas.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// New maintenance request → landlord.
export function maintenanceRequestEmail({ propertyId, propertyName, request, tenantEmail }) {
  const name = propertyName || "your property";
  const rows = [
    detailRow("Issue", esc(request.title)),
    detailRow("Urgency", urgencyPill(request.urgency)),
    request.description ? detailRow("Details", esc(request.description).replace(/\n/g, "<br>")) : "",
    detailRow("Submitted by", tenantEmail ? esc(tenantEmail) : "You (added manually)"),
  ].join("");

  const content = `
    ${h1("New maintenance request")}
    ${p(`A new maintenance request was submitted for <strong>${esc(name)}</strong>.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border-top:1px solid #e8edf2;">
      ${rows}
    </table>
    ${button(`${APP_URL}/dashboard/${propertyId}`, "View request")}
  `;

  return {
    subject: `New maintenance request — ${name}`,
    html: layout(content, { preview: `New request: ${request.title}` }),
  };
}

// Leases expiring within 90 days → landlord (digest for one property).
export function expiringLeasesEmail({ propertyId, propertyName, leases }) {
  const name = propertyName || "your property";
  const n = leases.length;

  const items = leases
    .map((l) => {
      const unit = l.unit_number ? ` · Unit ${esc(l.unit_number)}` : "";
      const left = daysLeft(l.lease_end);
      const when =
        left == null
          ? fmtDate(l.lease_end)
          : `${fmtDate(l.lease_end)} (${left} day${left === 1 ? "" : "s"} left)`;
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #e8edf2;">
        <div style="font-size:14px;font-weight:600;color:#1a2a41;">${esc(l.tenant_name || "Tenant")}${unit}</div>
        <div style="font-size:13px;color:#1a2a41;opacity:0.6;margin-top:2px;">Ends ${when}</div>
      </td></tr>`;
    })
    .join("");

  const content = `
    ${h1("Leases expiring soon")}
    ${p(`${n} lease${n === 1 ? "" : "s"} at <strong>${esc(name)}</strong> ${n === 1 ? "is" : "are"} ending within the next 90 days.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">
      ${items}
    </table>
    ${button(`${APP_URL}/dashboard/${propertyId}`, "Review leases")}
  `;

  return {
    subject: `${n} lease${n === 1 ? "" : "s"} expiring soon — ${name}`,
    html: layout(content, { preview: `${n} lease${n === 1 ? "" : "s"} at ${name} expiring within 90 days` }),
  };
}
