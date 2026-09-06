import json, time, base64, os, requests

ENV = "/home/yang/Project/PipFinance/.env.local"
IMG_DIR = "/home/yang/Project/PipFinance/images test"
MLKIT_JSON = "/tmp/claude-1000/-home-yang-Project-PipFinance/dc5bf01d-9d1a-4cf5-8955-3e95e4749702/scratchpad/mlkit_results_fullres.json"

def get_key(name):
    with open(ENV) as f:
        for line in f:
            if line.startswith(name + "="):
                return line.strip().split("=", 1)[1]
    raise ValueError(name)

GEMINI_KEY = get_key("EXPO_PUBLIC_GEMINI_API_KEY")
GROQ_KEY = get_key("EXPO_PUBLIC_GROQ_API_KEY")

RECEIPT_SYSTEM_PROMPT = (
    "You read a photo of a paper restaurant or shop receipt and return ONLY JSON "
    "listing what was ordered. Never add prose, explanations, or markdown fences."
)
RECEIPT_USER_PROMPT = """Read every ordered item on this receipt so the bill can be split between friends.

Return a JSON object exactly in this shape:
{
  "merchant": "the shop or restaurant name printed on the receipt, or null",
  "currency": "3-letter ISO code read from the symbol or text shown, e.g. \\"MYR\\", \\"CNY\\", \\"SGD\\"  use \\"MYR\\" if none is shown",
  "items": [
    {
      "label": "the item name as printed",
      "amount": number  the LINE TOTAL for that row (quantity already multiplied in),
      "quantity": number or null  how many, if the receipt shows it
    }
  ],
  "subtotal": number or null  the items subtotal BEFORE service charge and tax,
  "serviceCharge": number or null  the service charge amount (often 10%),
  "tax": number or null  the service tax / SST / GST amount (often 6%),
  "total": number or null  the final amount payable,
  "discount": { "amount": number, "timing": "before" | "after" } or null  a voucher or discount line, if the receipt printed one
}

Rules:
- One object per ordered line. If a row shows "2 x Teh Ais 3.00 6.00", the amount is the LINE TOTAL (6.00) and quantity is 2.
- Do NOT include service charge, tax, subtotal, total, discount, rounding, change, or payment lines in "items".
- Amounts are plain positive numbers: strip currency symbols and thousands separators ("RM 12,340.50" becomes 12340.50).

Receipt text to extract from:
"""

DOC_SYSTEM_PROMPT = "You read financial documents, transaction records, bank/e-wallet history exports, CSVs, or plaintext lists and return ONLY JSON. Never add prose, explanations, or markdown fences."
DOC_USER_PROMPT = """Read the transactions from the text below and return a JSON object with this exact shape:
{
  "transactions": [
    {
      "merchant": "merchant / person name, or clean description",
      "amount": number (always positive),
      "currency": "3-letter ISO code",
      "direction": "out" | "in",
      "date": "YYYY-MM-DD" or null
    }
  ]
}

Text to extract from:
"""

IMAGES = ["1000105419.jpg", "1000105421.jpg", "1000105423.jpg", "tngscreenshot.png"]
MIME = {"jpg": "image/jpeg", "png": "image/png"}

def call_gemini_vision(img_bytes, mime, sys_prompt, user_prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_KEY}"
    b64 = base64.b64encode(img_bytes).decode()
    payload = {
        "system_instruction": {"parts": [{"text": sys_prompt}]},
        "contents": [{"role": "user", "parts": [
            {"text": user_prompt},
            {"inline_data": {"mime_type": mime, "data": b64}},
        ]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1},
    }
    payload_bytes = len(json.dumps(payload).encode())
    t0 = time.perf_counter()
    resp = requests.post(url, json=payload, timeout=60)
    latency = (time.perf_counter() - t0) * 1000
    data = resp.json()
    usage = data.get("usageMetadata", {})
    try:
        cand = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(cand)
    except Exception as e:
        parsed = {"error": str(e), "raw": data}
    return {
        "latency_ms": round(latency, 1),
        "prompt_tokens": usage.get("promptTokenCount", 0),
        "completion_tokens": usage.get("candidatesTokenCount", 0),
        "total_tokens": usage.get("totalTokenCount", 0),
        "payload_bytes": payload_bytes,
        "parsed": parsed,
    }

def call_groq_text(text, sys_prompt, user_prompt, model="openai/gpt-oss-20b"):
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_prompt + text},
        ],
        "temperature": 0.1,
        "max_tokens": 2048,
        "reasoning_effort": "low",
        "response_format": {"type": "json_object"},
    }
    payload_bytes = len(json.dumps(payload).encode())
    t0 = time.perf_counter()
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    latency = (time.perf_counter() - t0) * 1000
    data = resp.json()
    usage = data.get("usage", {})
    try:
        cand = data["choices"][0]["message"]["content"]
        parsed = json.loads(cand)
    except Exception as e:
        parsed = {"error": str(e), "raw": data}
    return {
        "latency_ms": round(latency, 1),
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "payload_bytes": payload_bytes,
        "parsed": parsed,
    }

def main():
    mlkit = json.load(open(MLKIT_JSON))
    results = {"vision": {}, "ocr_plus_cheap": {}, "mlkit_raw": {}}

    for fn in IMAGES:
        ext = fn.rsplit(".", 1)[1]
        mime = MIME[ext]
        img_path = os.path.join(IMG_DIR, fn)
        img_bytes = open(img_path, "rb").read()

        sys_p, user_p = (DOC_SYSTEM_PROMPT, DOC_USER_PROMPT) if fn == "tngscreenshot.png" else (RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT)

        print(f"\n=== {fn} ===")
        print("  [Vision/Gemini] calling...")
        v = call_gemini_vision(img_bytes, mime, sys_p, user_p)
        results["vision"][fn] = v
        print(f"    latency={v['latency_ms']}ms tokens={v['total_tokens']} payload={v['payload_bytes']}B")

        ocr_text = mlkit[fn]["spatial_text"]
        ocr_latency = mlkit[fn]["latency_ms"]
        results["mlkit_raw"][fn] = {"latency_ms": ocr_latency, "text_chars": len(ocr_text), "spatial_text": ocr_text}

        print("  [ML Kit text -> Groq llama-3.1-8b-instant] calling...")
        t = call_groq_text(ocr_text, sys_p, user_p)
        results["ocr_plus_cheap"][fn] = t
        print(f"    ocr_latency={ocr_latency:.0f}ms llm_latency={t['latency_ms']}ms tokens={t['total_tokens']} payload={t['payload_bytes']}B")

    out = "/tmp/claude-1000/-home-yang-Project-PipFinance/dc5bf01d-9d1a-4cf5-8955-3e95e4749702/scratchpad/real_bench_results_fullres.json"
    json.dump(results, open(out, "w"), indent=2, ensure_ascii=False)
    print(f"\nSaved to {out}")

if __name__ == "__main__":
    main()
