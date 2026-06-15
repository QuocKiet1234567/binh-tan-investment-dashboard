export default function handler(request, response) {
  response.status(200).json({
    ok: true,
    service: "binh-tan-investment-dashboard",
    message: "API ready"
  });
}
