export default async function handler(request, response) {
  const target = String(request.query.url || "").trim();

  if (!target) {
    response.status(400).send("Missing Google Sheet CSV URL.");
    return;
  }

  let url;
  try {
    url = new URL(target);
  } catch {
    response.status(400).send("Invalid URL.");
    return;
  }

  const allowedHost = url.hostname.endsWith("google.com") || url.hostname.endsWith("googleusercontent.com");
  const looksLikeCsv = url.pathname.toLowerCase().endsWith(".csv") || url.search.toLowerCase().includes("csv");

  if (!allowedHost && !looksLikeCsv) {
    response.status(400).send("Only public Google Sheet or CSV links are supported.");
    return;
  }

  try {
    const sheetResponse = await fetch(url.toString(), {
      headers: {
        "user-agent": "BinhTanInvestmentDashboard/1.0"
      }
    });

    if (!sheetResponse.ok) {
      response.status(sheetResponse.status).send(`Could not fetch sheet: ${sheetResponse.statusText}`);
      return;
    }

    const csv = await sheetResponse.text();
    response.setHeader("content-type", "text/csv; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.status(200).send(csv);
  } catch (error) {
    response.status(500).send(error.message || "Could not fetch Google Sheet.");
  }
}
