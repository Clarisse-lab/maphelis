// Netlify Forms -> Google Sheets API v4 (server-side only).
// Required Netlify environment variables:
// GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID,
// Never commit private keys.
const { createSign } = require("node:crypto");

const FIELDS = [
  "nome", "email", "celular", "empresa", "segmento", "tempo_empresa",
  "faturamento", "equipe", "quantidade_unidades", "momento", "gargalos[]",
  "afastamento", "tempo_operacional", "nao_deveria_depender", "motivo_agora",
  "prazo", "investimento", "decisor", "mudanca_6_meses",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"
];
const SHEET = "'Página1'";
const base64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const response = (statusCode, message) => ({ statusCode, body: JSON.stringify({ message }), headers: { "Content-Type": "application/json" } });
async function googleToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google service account credentials missing");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url({ alg: "RS256", typ: "JWT" }) + "." + base64url({
    iss: email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = unsigned + "." + signer.sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("Google OAuth failed: " + res.status);
  return data.access_token;
}
async function sheets(path, token, init = {}) {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" +
    encodeURIComponent(process.env.GOOGLE_SHEETS_SPREADSHEET_ID) + path;
  const res = await fetch(url, {
    ...init, headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error("Google Sheets API failed: " + res.status + " " + (await res.text()).slice(0,250));
  return res.json();
}
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return response(405, "Method not allowed");
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) return response(503, "Sheet not configured");
  try {
    const raw = JSON.parse(event.body || "{}");
    const submission = raw.payload || raw;
    const data = submission.data || submission;
    const formName = submission.form_name || submission.formName || raw.form_name;
    if (formName && formName !== "aplicacao-maphel") return response(200, "Ignored unrelated form");
    const id = String(submission.id || submission.submission_id || "");
    if (!id) return response(400, "Missing submission ID");
    const auth = await googleToken();
    const existing = await sheets("/values/" + encodeURIComponent(SHEET + "!B2:B") + "?majorDimension=COLUMNS", auth);
    if ((existing.values?.[0] || []).some(v => String(v) === id)) return response(200, "Already saved");
    const value = (key) => {
      const v = data[key] ?? (key === "gargalos[]" ? data.gargalos : "");
      return Array.isArray(v) ? v.join("; ") : String(v ?? "");
    };
    const row = [String(submission.created_at || new Date().toISOString()), id, "Novo", ...FIELDS.map(value)];
    await sheets("/values/" + encodeURIComponent(SHEET + "!A:AA") + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", auth, {
      method: "POST", body: JSON.stringify({ majorDimension: "ROWS", values: [row] })
    });
    return response(200, "Saved");
  } catch (err) {
    console.error("Maphel Sheets integration:", err.message);
    return response(500, "Integration failed");
  }
};
