// Vercel serverless function — Photta version.
// Deploy alongside the app. Set PHOTTA_API_KEY as an environment variable
// in Vercel's dashboard. The app calls this at same-origin path /api/tryon.
//
// Photta's flow is two calls, not one:
//  1. Upload the person's photo as a custom "mannequin" -> get a mannequin_id
//  2. Submit the try-on job with that mannequin_id + a garment image -> poll for output_url
//
// NOTE: Photta's /mannequins/upload request/response shape wasn't fully
// documented in what I could pull from their public docs page. The shape
// below (image as a base64 data URL) is my best inference from their other
// endpoints — verify field names against api-docs.photta.app once you're
// in the dashboard, and adjust the marked line if the upload call errors.

const BASE = "https://ai.photta.app/api/v1";

// Our closet categories -> Photta's supported product_type values.
// Photta's apparel endpoint doesn't support shoes/accessories at all.
const CATEGORY_MAP = {
  top: "top",
  bottom: "bottom",
  dress: "dress",
  outerwear: "top",
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { modelImage, garmentImage, category } = req.body || {};
  if (!modelImage || !garmentImage) {
    return res.status(400).json({ error: "modelImage and garmentImage are required" });
  }

  const productType = CATEGORY_MAP[category] || "top";
  if (!CATEGORY_MAP[category]) {
    return res.status(400).json({ error: `Photta's apparel API doesn't support "${category}" items (shoes/accessories aren't supported).` });
  }

  const API_KEY = process.env.PHOTTA_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "Server is missing PHOTTA_API_KEY" });

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  try {
    const mannequinRes = await fetch(`${BASE}/mannequins/upload`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ image: modelImage }),
    });
    if (!mannequinRes.ok) {
      const errText = await mannequinRes.text();
      return res.status(502).json({ error: `Mannequin upload failed: ${errText}` });
    }
    const { mannequin_id } = await mannequinRes.json();
    if (!mannequin_id) return res.status(502).json({ error: "Photta did not return a mannequin_id" });

    const submitRes = await fetch(`${BASE}/tryon/apparel`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        product_type: productType,
        product_images: [garmentImage],
        mannequin_id,
        pose_id: "pose_standing_front",
        resolution: "2K",
        aspect_ratio: "3:4",
      }),
    });
    if (!submitRes.ok) {
      const errText = await submitRes.text();
      return res.status(502).json({ error: `Try-on submit failed: ${errText}` });
    }
    const { id } = await submitRes.json();
    if (!id) return res.status(502).json({ error: "Photta did not return a generation id" });

    const started = Date.now();
    const timeoutMs = 4.5 * 60 * 1000;
    while (Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 4000));
      const pollRes = await fetch(`${BASE}/tryon/apparel/${id}`, { headers: authHeaders });
      const result = await pollRes.json();
      const status = result.data?.status || result.status;

      if (status === "completed") {
        return res.status(200).json({ imageUrl: result.data?.output_url || result.output_url });
      }
      if (status === "failed") {
        return res.status(502).json({ error: result.data?.error || "Generation failed" });
      }
    }
    return res.status(504).json({ error: "Timed out waiting for the result" });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
    }
