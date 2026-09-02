#!/usr/bin/env python3
"""
Benchmark Pipeline A: Direct Multimodal Vision LLM (Gemini 3.1 Flash Lite)
Directly passes the full image to Gemini 3.1 Flash Lite and extracts structured JSON.
Records:
- exact token breakdown (image tokens vs text prompt tokens vs completion tokens)
- request latency in ms
- upload payload size in bytes
- parsed JSON response
"""

import os
import json
import time
import base64
import urllib.request
import urllib.error

def get_api_key():
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("EXPO_PUBLIC_GEMINI_API_KEY")
    if key:
        return key
    env_path = os.path.join(os.path.dirname(__file__), "../../.env.local")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_GEMINI_API_KEY="):
                    return line.strip().split("=", 1)[1]
    return ""

API_KEY = get_api_key()
MODEL = "gemini-3.1-flash-lite"
ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"

IMAGES_DIR = "/home/yang/Project/PipFinance/images test"
GROUND_TRUTH_FILE = "/home/yang/Project/PipFinance/tools/mlkit_eval/ground_truth.json"
OUTPUT_FILE = "/home/yang/Project/PipFinance/tools/mlkit_eval/vision_results.json"

# Prompts from src/llm/extractPrompt.ts
DOC_SYSTEM_PROMPT = (
    "You are a precise data extractor for a personal expenses app. You read a "
    "bank statement, an exported transaction file, or a screenshot and return ONLY "
    "JSON. Never add prose, explanations, or markdown fences."
)

DOC_USER_PROMPT = """Extract every transaction in the attached document.

Return a JSON object exactly in this shape:
{
  "transactions": [
    {
      "merchant": "string — the payee / description / narration as shown",
      "amount": number — positive value, no currency symbol,
      "currency": "3-letter ISO code read from the symbol or text shown, e.g. \\"MYR\\", \\"CNY\\", \\"SGD\\" — use \\"MYR\\" if none is shown",
      "direction": "\\"out\\" for money leaving the account (spending), \\"in\\" for money received",
      "date": "YYYY-MM-DD if derivable, otherwise null",
      "category": "the category/label from the source if the document has one, otherwise null",
      "method": "optional sub-label, otherwise null"
    }
  ]
}

Rules:
- One object per transaction. Do not merge, split, or invent rows.
- amount is always positive; use "direction" for spend vs received.
- If you cannot read a field, use null (never guess amounts or dates).
- Output JSON only."""

RECEIPT_SYSTEM_PROMPT = (
    "You read a photo of a paper restaurant or shop receipt and return ONLY JSON "
    "listing what was ordered. Never add prose, explanations, or markdown fences."
)

RECEIPT_USER_PROMPT = """Read every ordered item on this receipt so the bill can be split between friends.

Return a JSON object exactly in this shape:
{
  "merchant": "the shop or restaurant name printed on the receipt, or null",
  "currency": "3-letter ISO code read from the symbol or text shown, e.g. \\"MYR\\", \\"CNY\\", \\"SGD\\" — use \\"MYR\\" if none is shown",
  "items": [
    {
      "label": "the item name as printed",
      "amount": number — the LINE TOTAL for that row (quantity already multiplied in),
      "quantity": number or null — how many, if the receipt shows it
    }
  ],
  "subtotal": number or null — the items subtotal BEFORE service charge and tax,
  "serviceCharge": number or null — the service charge amount (often 10%),
  "tax": number or null — the service tax / SST / GST amount (often 6%),
  "total": number or null — the final amount payable,
  "discount": { "amount": number, "timing": "before" | "after" } or null
}

Rules:
- One object per ordered line. If a row shows "2 x Teh Ais 3.00 6.00", the amount is the LINE TOTAL (6.00) and quantity is 2.
- Do NOT include service charge, tax, subtotal, total, discount, rounding, change, or payment lines in "items" — they have their own fields.
- Amounts are plain positive numbers: strip currency symbols and thousands separators.
- If a field is not printed or you cannot read it, use null. Never guess a number.
- Output JSON only."""

def run_vision_extraction(image_path: str, is_doc: bool):
    with open(image_path, "rb") as f:
        raw_bytes = f.read()
    b64_data = base64.b64encode(raw_bytes).decode("utf-8")
    
    mime_type = "image/png" if image_path.endswith(".png") else "image/jpeg"
    system_prompt = DOC_SYSTEM_PROMPT if is_doc else RECEIPT_SYSTEM_PROMPT
    user_prompt = DOC_USER_PROMPT if is_doc else RECEIPT_USER_PROMPT
    
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{
            "role": "user",
            "parts": [
                {"text": user_prompt},
                {"inline_data": {"mime_type": mime_type, "data": b64_data}}
            ]
        }],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json"
        }
    }
    
    body = json.dumps(payload).encode("utf-8")
    payload_size_bytes = len(body)
    
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json"}
    )
    
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
        latency_ms = (time.perf_counter() - t0) * 1000
    except urllib.error.HTTPError as e:
        error_content = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP Error {e.code}: {error_content}")
        
    data = json.loads(resp_body)
    usage = data.get("usageMetadata", {})
    text_content = data["candidates"][0]["content"]["parts"][0]["text"]
    
    # Parse the returned JSON
    parsed_json = json.loads(text_content)
    
    # Analyze prompt tokens detail
    tokens_detail = usage.get("promptTokensDetails", [])
    image_tokens = 0
    text_tokens = 0
    for td in tokens_detail:
        if td.get("modality") == "IMAGE":
            image_tokens = td.get("tokenCount", 0)
        elif td.get("modality") == "TEXT":
            text_tokens = td.get("tokenCount", 0)
            
    return {
        "file": os.path.basename(image_path),
        "raw_file_size_bytes": len(raw_bytes),
        "upload_payload_size_bytes": payload_size_bytes,
        "latency_ms": round(latency_ms, 2),
        "prompt_tokens_total": usage.get("promptTokenCount", 0),
        "image_tokens": image_tokens,
        "text_prompt_tokens": text_tokens,
        "completion_tokens": usage.get("candidatesTokenCount", 0),
        "total_tokens": usage.get("totalTokenCount", 0),
        "parsed_json": parsed_json
    }

def main():
    with open(GROUND_TRUTH_FILE, "r") as f:
        ground_truth = json.load(f)
        
    results = {}
    print(f"Running Pipeline A: Multimodal Vision ({MODEL})...")
    
    for filename in sorted(os.listdir(IMAGES_DIR)):
        if not (filename.endswith(".jpg") or filename.endswith(".png")):
            continue
        filepath = os.path.join(IMAGES_DIR, filename)
        is_doc = (filename == "tngscreenshot.png")
        print(f"\nProcessing {filename} (is_doc={is_doc})...")
        
        res = run_vision_extraction(filepath, is_doc)
        results[filename] = res
        
        print(f"  Latency: {res['latency_ms']} ms")
        print(f"  Payload Size: {res['upload_payload_size_bytes'] / 1024:.1f} KB (Raw Image: {res['raw_file_size_bytes'] / 1024:.1f} KB)")
        print(f"  Image Tokens: {res['image_tokens']} | Text Tokens: {res['text_prompt_tokens']} | Output Tokens: {res['completion_tokens']}")
        print(f"  Total Tokens: {res['total_tokens']}")
        
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved Vision LLM results to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
