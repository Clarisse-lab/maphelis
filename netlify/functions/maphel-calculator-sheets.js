// Leads da Calculadora do Dono: registro independente do Netlify Forms.
// Reutiliza as credenciais existentes do Google Sheets, sem expô-las no navegador.
const { createSign } = require("node:crypto");
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

const TAB = "Calculadora do Dono";
const HEADERS = ["Data e hora","ID do envio","Nome","WhatsApp","E-mail","Horas por dia","Dias por semana","Dias de descanso","Horas delegáveis por dia","Percentual do faturamento","Faturamento mensal","Renda mensal","UTM source","UTM medium","UTM campaign","UTM content","UTM term"];
async function ensureTab(token) {
  const spreadsheet = await sheets("?fields=sheets.properties.title", token);
  if (spreadsheet.sheets?.some(s => s.properties?.title === TAB)) {
    // A aba pode ter sido criada manualmente e estar vazia: garantir cabeçalhos.
    // Nunca sobrescrever dados ou cabeçalhos já existentes.
    const current = await sheets("/values/" + encodeURIComponent("'" + TAB + "'!A1:Q1"), token);
    if (!(current.values?.[0] || []).some(v => String(v).trim())) {
      await sheets("/values/" + encodeURIComponent("'" + TAB + "'!A1:Q1") + "?valueInputOption=RAW", token, {
        method: "PUT",
        body: JSON.stringify({ range: "'" + TAB + "'!A1:Q1", majorDimension: "ROWS", values: [HEADERS] })
      });
    }
    return;
  }
  const id = encodeURIComponent(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + id + ":batchUpdate", {
    method:"POST", headers:{Authorization:"Bearer " + token,"Content-Type":"application/json"},
    body:JSON.stringify({requests:[{addSheet:{properties:{title:TAB}}}]})
  });
  if (!res.ok && res.status !== 400) throw new Error("Create tab failed: " + res.status);
  if (res.status === 400) {
    const check = await sheets("?fields=sheets.properties.title", token);
    if (!check.sheets?.some(s => s.properties?.title === TAB)) throw new Error("Create tab failed");
  }
  await sheets("/values/" + encodeURIComponent("'" + TAB + "'!A1:Q1") + "?valueInputOption=RAW", token, {
    method:"PUT",body:JSON.stringify({range:"'" + TAB + "'!A1:Q1",majorDimension:"ROWS",values:[HEADERS]})
  });
}
exports.handler = async (event) => {
  if(event.httpMethod !== "POST") return response(405,"Method not allowed");
  if(!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) return response(503,"Sheet not configured");
  try {
    const raw=JSON.parse(event.body||"{}");
    if(raw["bot-field"]) return response(400,"Invalid submission");
    const data=raw.data||{};
    const id=String(raw.id||"");
    if(!id || id.length>100 || !String(data.nome||"").trim() || !/^\S+@\S+\.\S+$/.test(String(data.email||"")) || !/^\d{10,13}$/.test(String(data.whatsapp||"").replace(/\D/g,""))) return response(400,"Invalid lead");
    const token=await googleToken();
    await ensureTab(token);
    const ids=await sheets("/values/"+encodeURIComponent("'"+TAB+"'!B2:B")+"?majorDimension=COLUMNS",token);
    if((ids.values?.[0]||[]).some(v=>String(v)===id)) return response(200,"Already saved");
    const fields=["nome","whatsapp","email","horas_dia","dias_semana","dias_descanso","horas_delegaveis_dia","percentual_faturamento","faturamento_mensal","renda_mensal","utm_source","utm_medium","utm_campaign","utm_content","utm_term"];
    const row=[new Date().toISOString(),id,...fields.map(k=>String(data[k]??"").slice(0,300))];
    await sheets("/values/"+encodeURIComponent("'"+TAB+"'!A:Q")+":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",token,{method:"POST",body:JSON.stringify({majorDimension:"ROWS",values:[row]})});
    return response(200,"Saved");
  }catch(err){console.error("MAPHEL calculator Sheets:",err.message);return response(500,"Could not save lead");}
};
