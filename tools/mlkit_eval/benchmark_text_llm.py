import json
import os
import time
import requests

MLKIT_SPATIAL_TEXTS = {
    "1000105419.jpg": """NS PLT
(202304001569 (LLP0035619-LGN))
NO 21 JALAN BRP 6/10
BUKIT RAHMAN PUTRA
47000 SUNGAI BULOH SELANGOR
TABLE: 12
BILL: 57
23/08/2026 13:17:00
CASHIER: CASHIER 1

ITEM    QTY    PRICE    AMOUNT
----------------------------------------
A15    1    12.00    12.00
A18    1    14.00    14.00
----------------------------------------
TOTAL QTY: 2
SUBTOTAL: 26.00
DISCOUNT: 0.00
ROUNDING: 0.00
TOTAL (RM): 26.00
CASH: 50.00
CHANGE: 24.00
THANK YOU PLEASE COME AGAIN""",

    "1000105421.jpg": """THE ML KITCHEN (SEPANG) SDN. BHD.
202401019741 (1565590-T)
NO 15-G, JALAN KLIA AVENUE,
PUSAT PERNIAGAAN KLIA AVENUE,
43900 SEPANG, SELANGOR.
TEL: 011-5427 8688

Receipt No: CS00016422
Date: 23/08/2026    7:15:59 PM
Cashier: CASHIER
Table: T12

Item    Qty    Price    Total(RM)
----------------------------------------
麻辣烫 Mala Soup    0.59    55.00    32.45
微辣 Less Spicy
白汤 White Soup
白饭 Rice    1    2.00    2.00
白饭 Rice    1    2.00    2.00
----------------------------------------
Sub Total:    36.45
Discount (5%):    -1.82
Total (RM):    34.58
Rounding:    0.00
Grand Total (RM):    34.58
Payment - DuitNow:    34.58
THANK YOU!""",

    "1000105423.jpg": """ECONSAVE CASH & CARRY (SPG) SDN BHD
LOT 1234, JALAN SEPANG,
43900 SEPANG, SELANGOR.
TEL: 03-8706 1234
TAX INVOICE
INVOICE NO: INV-20260831-0982
DATE: 31/08/2026    19:37:12
CASHIER: POS 04

DESCRIPTION    QTY    PRICE    TOTAL(RM)
--------------------------------------------------
KOBIS BULAT LOCAL    1    0.91    0.91 S
DELIFISH SMALL FRI    1    3.20    3.20 S
C.KIMCHAM (+-100G)    1    0.99    0.99 S
C.KIMCHAM (+-100G)    1    0.99    0.99 S
C.KIMCHAM (+-100G)    1    0.99    0.99 S
SHRIMP PASTE    1    9.90    9.90 S
ANCHOR CHEDDAR CHE    1    9.45    9.45 S
KNIFE CLAS LIGHT S    1    5.80    5.80 S
LACT B/YOG SBRRY    1    4.79    4.79 S
NR 3IN1 ORI 14X28G    1    8.90    8.90 S
(PS) MI SEDAAP GOR    1    4.45    4.45 S
MS INS SOTO 5X75G    1    5.20    5.20 S
MILO 400G    1    9.80    9.80 S
GARDENIA ORI CLAS    1    2.85    2.85 S
100PLUS 1.5L    1    2.89    2.89 S
T/MORAH POTONG    1    4.42    4.42 S
PLASTIC BAG    1    0.20    0.20 S
PLASTIC BAG    1    0.20    0.20 S
PLASTIC BAG    1    0.20    0.20 S
--------------------------------------------------
TOTAL ITEMS: 19
SUBTOTAL:    76.24
ROUNDING:    0.01
TOTAL AMOUNT (RM):    76.25
CASH RECEIVED:    100.00
CHANGE:    23.75
GOODS SOLD ARE NOT RETURNABLE
THANK YOU""",

    "tngscreenshot.png": """9:41
Touch 'n Go eWallet
Transaction History

20 Aug 2026
GOLDEN BITE FOODS
DuitNow QR
-RM 5.00

NAN SAN HWAN
Transfer to Wallet
-RM 8.00

BBT KOPITIAM
DuitNow QR TNGD
-RM 1.00

MUHAMAD FADERILAH SUHAIMI BIN AZAM
Payment
-RM 7.50

CHATHERINE WIJAYA
DuitNow Received
+RM 8.00

FONG YAN YAN
DuitNow Received
+RM 8.00"""
}

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

DOC_SYSTEM_PROMPT = "You read financial documents, transaction records, bank/e-wallet history exports, CSVs, or plaintext lists and return ONLY JSON. Never add prose, explanations, or markdown fences."

DOC_USER_PROMPT = """Read the transactions from the text below and return a JSON object with this exact shape:
{
  "transactions": [
    {
      "merchant": "merchant / person name, or clean description",
      "amount": number (always positive),
      "currency": "3-letter ISO code read from the text, e.g. \\"MYR\\", \\"CNY\\", \\"SGD\\" — use \\"MYR\\" if none is shown",
      "direction": "out" | "in",
      "date": "YYYY-MM-DD" or null,
      "category": "Food & Beverage" | "Groceries" | "Shopping" | "Transport" | "Utilities" | "Transfer" | "Income" | "Entertainment" | "Health" | "Other" or null,
      "method": "DuitNow QR" | "Touch 'n Go" | "Dns Transfer" | "Debit Card" | "Credit Card" | "Cash" | null
    }
  ]
}

Text to extract from:
"""

RECEIPT_SYSTEM_PROMPT = "You read a photo of a paper restaurant or shop receipt and return ONLY JSON listing what was ordered. Never add prose, explanations, or markdown fences."

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
  "discount": { "amount": number, "timing": "before" | "after" } or null — a voucher or discount line, if the receipt printed one
}

Receipt text to extract from:
"""

def main():
    api_key = get_api_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}

    results = {}
    
    for filename, text in MLKIT_SPATIAL_TEXTS.items():
        print(f"\nProcessing {filename} with Gemini 3.1 Flash Lite (Text-only)...")
        if filename == "tngscreenshot.png":
            sys_prompt = DOC_SYSTEM_PROMPT
            user_prompt = DOC_USER_PROMPT + text
        else:
            sys_prompt = RECEIPT_SYSTEM_PROMPT
            user_prompt = RECEIPT_USER_PROMPT + text

        payload = {
            "system_instruction": {
                "parts": [{"text": sys_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }

        payload_bytes = len(json.dumps(payload).encode("utf-8"))
        
        t0 = time.perf_counter()
        resp = requests.post(url, headers=headers, json=payload)
        latency_ms = (time.perf_counter() - t0) * 1000.0

        if resp.status_code != 200:
            print(f"Error {resp.status_code}: {resp.text}")
            continue

        data = resp.json()
        usage = data.get("usageMetadata", {})
        cand = data["candidates"][0]["content"]["parts"][0]["text"]
        
        try:
            parsed = json.loads(cand)
        except Exception:
            parsed = cand

        results[filename] = {
            "file": filename,
            "ocr_text_length_chars": len(text),
            "upload_payload_size_bytes": payload_bytes,
            "latency_ms": round(latency_ms, 2),
            "prompt_tokens_total": usage.get("promptTokenCount", 0),
            "completion_tokens": usage.get("candidatesTokenCount", 0),
            "total_tokens": usage.get("totalTokenCount", 0),
            "parsed_json": parsed,
            "mlkit_spatial_text": text
        }

        print(f"  Done in {latency_ms:.1f} ms")
        print(f"  Input Tokens: {usage.get('promptTokenCount')}, Output Tokens: {usage.get('candidatesTokenCount')}, Total: {usage.get('totalTokenCount')}")
        print(f"  Payload Size: {payload_bytes} bytes")

    out_file = "/home/yang/Project/PipFinance/tools/mlkit_eval/text_llm_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved all results to {out_file}")

if __name__ == "__main__":
    main()
