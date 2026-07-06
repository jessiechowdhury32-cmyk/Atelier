import React, { useState } from "react";
import { Shirt, Sparkles, Palette, TrendingUp, Upload, Loader2, X, ShoppingBag, Camera, Wand2 } from "lucide-react";

const INK = "#1A1A1A";
const PAPER = "#F0EEE6";
const CARD = "#FBF9F4";
const RED = "#A8121E";
const SAGE = "#3E4C3E";
const BRASS = "#B08D57";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: reader.result.split(",")[1], mediaType: file.type });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callClaude({ system, messages, tools }) {
  const body = { model: "claude-sonnet-5", max_tokens: 1000, messages };
  if (system) body.system = system;
  if (tools) body.tools = tools;
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : clean);
}

// ---- Tag-shaped card, the app's signature element ----
function Tag({ children, style, onRemove }) {
  return (
    <div className="relative" style={{ ...style }}>
      <div
        className="relative pt-5 pb-4 px-4 rounded-sm"
        style={{ background: CARD, border: `1px solid ${INK}22`, boxShadow: "2px 3px 0 rgba(26,26,26,0.08)" }}
      >
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
          style={{ background: PAPER, border: `1px solid ${INK}33` }}
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-1 right-1 p-1 rounded-full hover:bg-black/5"
            aria-label="Remove item"
          >
            <X size={14} color={INK} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function Swatch({ hex, label }) {
  return (
    <div className="flex flex-col items-center gap-1 w-14">
      <div className="w-10 h-10 rounded-full border" style={{ background: hex, borderColor: `${INK}22` }} />
      <span className="text-[10px] tracking-wide uppercase" style={{ fontFamily: "'IBM Plex Mono', monospace", color: INK }}>
        {label || hex}
      </span>
    </div>
  );
}

const TABS = [
  { id: "closet", label: "Closet", icon: Shirt },
  { id: "stylist", label: "Stylist", icon: Sparkles },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "tryon", label: "Try-On", icon: Wand2 },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

export default function App() {
  const [tab, setTab] = useState("closet");
  const [items, setItems] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [closetError, setClosetError] = useState("");

  const [occasion, setOccasion] = useState("");
  const [weather, setWeather] = useState("");
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [outfitResult, setOutfitResult] = useState(null);
  const [outfitError, setOutfitError] = useState("");

  const [selfie, setSelfie] = useState(null);
  const [colorLoading, setColorLoading] = useState(false);
  const [colorResult, setColorResult] = useState(null);
  const [colorError, setColorError] = useState("");

  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsText, setTrendsText] = useState("");
  const [trendsError, setTrendsError] = useState("");

  const [proxyUrl, setProxyUrl] = useState("");
  const [bodyPhoto, setBodyPhoto] = useState(null);
  const [tryonGarmentId, setTryonGarmentId] = useState(null);
  const [tryonLoading, setTryonLoading] = useState(false);
  const [tryonResult, setTryonResult] = useState(null);
  const [tryonError, setTryonError] = useState("");

  async function handleUploadItem(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setClosetError("");
    setAnalyzing(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const text = await callClaude({
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              {
                type: "text",
                text: 'Analyze this single clothing item. Respond with ONLY JSON, no markdown, no explanation: {"category":"top|bottom|dress|outerwear|shoes|accessory","color":"one or two word color name","style":"casual|formal|business|sporty|streetwear","season":"spring|summer|fall|winter|all"}',
              },
            ],
          },
        ],
      });
      const parsed = parseJSON(text);
      setItems((prev) => [
        ...prev,
        { id: Date.now().toString(), thumb: `data:${mediaType};base64,${data}`, ...parsed },
      ]);
    } catch (err) {
      setClosetError("Couldn't read that item. Try a clearer photo, one garment at a time.");
    } finally {
      setAnalyzing(false);
    }
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleGetOutfit() {
    setOutfitError("");
    setOutfitResult(null);
    if (items.length === 0) {
      setOutfitError("Add a few items to your closet first — the stylist needs something to work with.");
      return;
    }
    if (!occasion.trim()) {
      setOutfitError("Tell the stylist what the outfit is for.");
      return;
    }
    setOutfitLoading(true);
    try {
      const summary = items.map((i) => ({ id: i.id, category: i.category, color: i.color, style: i.style }));
      const text = await callClaude({
        system:
          'You are an expert fashion stylist. Choose items from the wardrobe to build one coherent outfit for the occasion given. If a key piece is missing, suggest exactly one thing to buy. Respond with ONLY JSON: {"outfitIds":["id1","id2"],"advice":"2-3 sentences of styling advice","shoppingSuggestion":"one short sentence, or empty string if nothing is needed"}',
        messages: [
          {
            role: "user",
            content: `Wardrobe: ${JSON.stringify(summary)}\nOccasion: ${occasion}\nWeather: ${weather || "not specified"}`,
          },
        ],
      });
      const parsed = parseJSON(text);
      const chosen = items.filter((i) => parsed.outfitIds?.includes(i.id));
      setOutfitResult({ chosen, advice: parsed.advice, shoppingSuggestion: parsed.shoppingSuggestion });
    } catch (err) {
      setOutfitError("The stylist got stuck. Try again in a moment.");
    } finally {
      setOutfitLoading(false);
    }
  }

  async function handleUploadSelfie(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setColorError("");
    setColorResult(null);
    setColorLoading(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      setSelfie(`data:${mediaType};base64,${data}`);
      const text = await callClaude({
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              {
                type: "text",
                text: 'This is for a for-fun style color analysis, not a medical assessment. Based on the apparent skin undertone in the photo, respond with ONLY JSON: {"season":"Spring|Summer|Autumn|Winter","undertone":"warm|cool|neutral","bestColors":["#hex","#hex","#hex","#hex","#hex","#hex"],"avoidColors":["#hex","#hex","#hex"],"explanation":"2 short sentences"}',
              },
            ],
          },
        ],
      });
      setColorResult(parseJSON(text));
    } catch (err) {
      setColorError("Couldn't analyze that photo. Try one with clear, even lighting on your face.");
    } finally {
      setColorLoading(false);
    }
  }

  async function handleUploadBodyPhoto(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const { data, mediaType } = await fileToBase64(file);
    setBodyPhoto(`data:${mediaType};base64,${data}`);
    setTryonResult(null);
    setTryonError("");
  }

  async function handleTryOn() {
    setTryonError("");
    setTryonResult(null);
    if (!proxyUrl.trim()) {
      setTryonError("Paste your deployed proxy URL first — see the README for setup.");
      return;
    }
    if (!bodyPhoto) {
      setTryonError("Upload a full-body photo of yourself.");
      return;
    }
    const garment = items.find((i) => i.id === tryonGarmentId);
    if (!garment) {
      setTryonError("Pick a garment from your closet.");
      return;
    }
    setTryonLoading(true);
    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelImage: bodyPhoto, garmentImage: garment.thumb, category: garment.category }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) throw new Error(data.error || "No image returned");
      setTryonResult(data.imageUrl);
    } catch (err) {
      setTryonError(`Generation failed: ${err.message || "check your proxy URL and API key"}.`);
    } finally {
      setTryonLoading(false);
    }
  }

  async function handleGetTrends() {
    setTrendsError("");
    setTrendsLoading(true);
    try {
      const text = await callClaude({
        messages: [
          {
            role: "user",
            content:
              "Search for the top current fashion trends for this season. Summarize 5 trends, each as a short bolded name followed by one plain sentence of description. Keep the whole answer concise.",
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
      setTrendsText(text);
    } catch (err) {
      setTrendsError("Couldn't fetch trends right now. Try again shortly.");
    } finally {
      setTrendsLoading(false);
    }
  }

  const labelStyle = { fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em" };
  const headStyle = { fontFamily: "'Playfair Display', serif" };

  return (
    <div className="min-h-screen w-full" style={{ background: PAPER, color: INK, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      <header className="px-6 pt-8 pb-5 border-b" style={{ borderColor: `${INK}1a` }}>
        <div className="flex items-baseline justify-between max-w-3xl mx-auto">
          <h1 className="text-3xl" style={{ ...headStyle, fontStyle: "italic" }}>
            Atelier
          </h1>
          <span className="text-[11px] uppercase" style={{ ...labelStyle, color: `${INK}88` }}>
            No. 01 — Style Studio
          </span>
        </div>
      </header>

      <nav className="max-w-3xl mx-auto px-6 mt-5 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-t-sm whitespace-nowrap"
              style={{
                background: active ? CARD : "transparent",
                borderTop: active ? `2px solid ${RED}` : "2px solid transparent",
                color: active ? INK : `${INK}77`,
                fontFamily: "'Inter', sans-serif",
                fontWeight: active ? 600 : 400,
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8" style={{ background: CARD, minHeight: "60vh" }}>
        {tab === "closet" && (
          <section>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl" style={headStyle}>Your closet</h2>
                <p className="text-sm mt-1" style={{ color: `${INK}88` }}>
                  Photograph one item at a time. The AI tags category, color, style and season.
                </p>
              </div>
              <label
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer shrink-0"
                style={{ background: INK, color: PAPER }}
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {analyzing ? "Reading item…" : "Add item"}
                <input type="file" accept="image/*" onChange={handleUploadItem} className="hidden" disabled={analyzing} />
              </label>
            </div>

            {closetError && <p className="text-sm mb-4" style={{ color: RED }}>{closetError}</p>}

            {items.length === 0 ? (
              <div className="border border-dashed rounded-sm py-14 text-center" style={{ borderColor: `${INK}33` }}>
                <Shirt size={28} className="mx-auto mb-2" style={{ color: `${INK}55` }} />
                <p className="text-sm" style={{ color: `${INK}77` }}>Your closet is empty. Add your first item to begin.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                {items.map((item) => (
                  <Tag key={item.id} onRemove={() => removeItem(item.id)}>
                    <img src={item.thumb} alt={item.category} className="w-full h-28 object-cover rounded-sm mb-2" />
                    <p className="text-sm font-medium capitalize">{item.color} {item.category}</p>
                    <p className="text-[11px] uppercase mt-1" style={{ ...labelStyle, color: SAGE }}>{item.style}</p>
                    <p className="text-[10px] uppercase" style={{ ...labelStyle, color: `${INK}66` }}>{item.season}</p>
                  </Tag>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "stylist" && (
          <section>
            <h2 className="text-2xl mb-1" style={headStyle}>Ask the stylist</h2>
            <p className="text-sm mb-6" style={{ color: `${INK}88` }}>
              Describe the occasion and get an outfit pulled from your closet.
            </p>

            <div className="space-y-3 mb-5">
              <input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="Occasion — e.g. first client meeting, weekend brunch"
                className="w-full px-3 py-2 text-sm rounded-sm border outline-none"
                style={{ borderColor: `${INK}33`, background: PAPER }}
              />
              <input
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="Weather (optional) — e.g. cool and rainy"
                className="w-full px-3 py-2 text-sm rounded-sm border outline-none"
                style={{ borderColor: `${INK}33`, background: PAPER }}
              />
              <button
                onClick={handleGetOutfit}
                disabled={outfitLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm"
                style={{ background: RED, color: PAPER }}
              >
                {outfitLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {outfitLoading ? "Styling…" : "Build my outfit"}
              </button>
            </div>

            {outfitError && <p className="text-sm mb-4" style={{ color: RED }}>{outfitError}</p>}

            {outfitResult && (
              <div>
                <div className="flex flex-wrap gap-4 mb-4">
                  {outfitResult.chosen.map((item) => (
                    <Tag key={item.id} style={{ width: 110 }}>
                      <img src={item.thumb} alt={item.category} className="w-full h-24 object-cover rounded-sm mb-2" />
                      <p className="text-xs font-medium capitalize">{item.color} {item.category}</p>
                    </Tag>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-3">{outfitResult.advice}</p>
                {outfitResult.shoppingSuggestion && (
                  <div className="flex items-start gap-2 p-3 rounded-sm text-sm" style={{ background: PAPER, border: `1px solid ${BRASS}55` }}>
                    <ShoppingBag size={16} style={{ color: BRASS, marginTop: 2 }} />
                    <span>{outfitResult.shoppingSuggestion}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "colors" && (
          <section>
            <h2 className="text-2xl mb-1" style={headStyle}>Color analysis</h2>
            <p className="text-sm mb-6" style={{ color: `${INK}88` }}>
              Upload a well-lit photo of your face for a seasonal color palette. For styling fun, not a medical read.
            </p>

            <label
              className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer mb-6"
              style={{ background: INK, color: PAPER }}
            >
              {colorLoading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {colorLoading ? "Analyzing…" : "Upload a photo"}
              <input type="file" accept="image/*" onChange={handleUploadSelfie} className="hidden" disabled={colorLoading} />
            </label>

            {colorError && <p className="text-sm mb-4" style={{ color: RED }}>{colorError}</p>}

            {colorResult && (
              <div className="flex flex-col sm:flex-row gap-6">
                {selfie && <img src={selfie} alt="You" className="w-32 h-32 object-cover rounded-sm" />}
                <div className="flex-1">
                  <p className="text-lg" style={headStyle}>{colorResult.season} · <span className="capitalize">{colorResult.undertone}</span> undertone</p>
                  <p className="text-sm mt-1 mb-4" style={{ color: `${INK}88` }}>{colorResult.explanation}</p>
                  <p className="text-[11px] uppercase mb-2" style={labelStyle}>Wear these</p>
                  <div className="flex gap-3 flex-wrap mb-4">
                    {colorResult.bestColors?.map((hex) => <Swatch key={hex} hex={hex} />)}
                  </div>
                  <p className="text-[11px] uppercase mb-2" style={labelStyle}>Avoid these</p>
                  <div className="flex gap-3 flex-wrap">
                    {colorResult.avoidColors?.map((hex) => <Swatch key={hex} hex={hex} />)}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "tryon" && (
          <section>
            <h2 className="text-2xl mb-1" style={headStyle}>Try it on</h2>
            <p className="text-sm mb-6" style={{ color: `${INK}88` }}>
              Photorealistic try-on runs through FASHN's API via your own proxy server — see the
              tryon-proxy README for a 10-minute setup.
            </p>

            <label className="block text-[11px] uppercase mb-1" style={labelStyle}>Proxy URL</label>
            <input
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://your-project.vercel.app/api/tryon"
              className="w-full px-3 py-2 text-sm rounded-sm border outline-none mb-5"
              style={{ borderColor: `${INK}33`, background: PAPER }}
            />

            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-[11px] uppercase mb-2" style={labelStyle}>1. Your photo</p>
                {bodyPhoto ? (
                  <img src={bodyPhoto} alt="You" className="w-full h-56 object-cover rounded-sm mb-2" />
                ) : (
                  <div className="w-full h-56 rounded-sm border border-dashed flex items-center justify-center mb-2" style={{ borderColor: `${INK}33` }}>
                    <span className="text-xs" style={{ color: `${INK}66` }}>Full-body, plain background works best</span>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer" style={{ background: INK, color: PAPER }}>
                  <Camera size={16} /> Upload photo
                  <input type="file" accept="image/*" onChange={handleUploadBodyPhoto} className="hidden" />
                </label>
              </div>

              <div>
                <p className="text-[11px] uppercase mb-2" style={labelStyle}>2. Pick a garment</p>
                {items.length === 0 ? (
                  <p className="text-sm" style={{ color: `${INK}77` }}>Add items in the Closet tab first.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTryonGarmentId(item.id)}
                        className="rounded-sm overflow-hidden"
                        style={{ border: tryonGarmentId === item.id ? `2px solid ${RED}` : `1px solid ${INK}22` }}
                      >
                        <img src={item.thumb} alt={item.category} className="w-full h-16 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleTryOn}
              disabled={tryonLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm mb-6"
              style={{ background: RED, color: PAPER }}
            >
              {tryonLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              {tryonLoading ? "Generating (up to a minute)…" : "Generate try-on"}
            </button>

            {tryonError && <p className="text-sm mb-4" style={{ color: RED }}>{tryonError}</p>}

            {tryonResult && (
              <div>
                <p className="text-[11px] uppercase mb-2" style={labelStyle}>Result</p>
                <img src={tryonResult} alt="Try-on result" className="w-full max-w-sm rounded-sm" style={{ border: `1px solid ${INK}22` }} />
              </div>
            )}
          </section>
        )}

        {tab === "trends" && (
          <section>
            <h2 className="text-2xl mb-1" style={headStyle}>Trend forecast</h2>
            <p className="text-sm mb-6" style={{ color: `${INK}88` }}>
              A live pull of what's trending right now.
            </p>
            <button
              onClick={handleGetTrends}
              disabled={trendsLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-sm mb-6"
              style={{ background: SAGE, color: PAPER }}
            >
              {trendsLoading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              {trendsLoading ? "Scanning the runway…" : "Get today's trends"}
            </button>

            {trendsError && <p className="text-sm mb-4" style={{ color: RED }}>{trendsError}</p>}

            {trendsText && (
              <div className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-sm" style={{ background: PAPER, border: `1px solid ${INK}1a` }}>
                {trendsText}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 py-5 text-[11px]" style={{ ...labelStyle, color: `${INK}66` }}>
        MVP DEMO — DATA RESETS ON REFRESH — TRY-ON NEEDS YOUR OWN PROXY (SEE README)
      </footer>
    </div>
  );
}
