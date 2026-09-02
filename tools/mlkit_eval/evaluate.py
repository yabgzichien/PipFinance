import json
import os

def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    ground_truth = load_json("/home/yang/Project/PipFinance/tools/mlkit_eval/ground_truth.json")
    vision_res = load_json("/home/yang/Project/PipFinance/tools/mlkit_eval/vision_results.json")
    text_res = load_json("/home/yang/Project/PipFinance/tools/mlkit_eval/text_llm_results.json")

    # Gemini 3.1 Flash Lite pricing ($ per 1M tokens)
    INPUT_PRICE_PER_M = 0.075
    OUTPUT_PRICE_PER_M = 0.30

    print("=" * 80)
    print("EXPERIMENT EVALUATION: DIRECT VISION LLM vs. ON-DEVICE OCR + TEXT LLM")
    print("Model: Gemini 3.1 Flash Lite (gemini-3.1-flash-lite)")
    print("=" * 80)

    total_vis_input_tokens = 0
    total_vis_output_tokens = 0
    total_vis_latency = 0
    total_vis_payload = 0

    total_text_input_tokens = 0
    total_text_output_tokens = 0
    total_text_latency = 0
    total_text_payload = 0

    for file_key in ground_truth.keys():
        v = vision_res.get(file_key, {})
        t = text_res.get(file_key, {})

        v_in = v.get("prompt_tokens_total", 0)
        v_out = v.get("completion_tokens", 0)
        v_lat = v.get("latency_ms", 0)
        v_pay = v.get("upload_payload_size_bytes", 0)

        t_in = t.get("prompt_tokens_total", 0)
        t_out = t.get("completion_tokens", 0)
        t_lat = t.get("latency_ms", 0)
        t_pay = t.get("upload_payload_size_bytes", 0)

        total_vis_input_tokens += v_in
        total_vis_output_tokens += v_out
        total_vis_latency += v_lat
        total_vis_payload += v_pay

        total_text_input_tokens += t_in
        total_text_output_tokens += t_out
        total_text_latency += t_lat
        total_text_payload += t_pay

        token_savings_pct = (1.0 - (t_in + t_out) / (v_in + v_out)) * 100.0
        payload_savings_pct = (1.0 - t_pay / v_pay) * 100.0
        speedup = (v_lat / t_lat) if t_lat > 0 else 1.0

        print(f"\n--- FILE: {file_key} ---")
        print(f"  [Pipeline A: Direct Multimodal Vision]")
        print(f"    - Network Payload: {v_pay / 1024:.1f} KB (Base64 image upload)")
        print(f"    - Latency: {v_lat:.1f} ms")
        print(f"    - Input Tokens: {v_in} (Image: {v.get('image_tokens', 0)} + Prompt: {v.get('text_prompt_tokens', 0)})")
        print(f"    - Output Tokens: {v_out}")
        print(f"    - Total Tokens: {v_in + v_out}")
        print(f"  [Pipeline B: Google ML Kit OCR + Text LLM]")
        print(f"    - Network Payload: {t_pay / 1024:.1f} KB (Plaintext upload)")
        print(f"    - Latency: {t_lat:.1f} ms (API time; on-device OCR is local ~150-300ms on phone)")
        print(f"    - Input Tokens: {t_in} (0 image tokens)")
        print(f"    - Output Tokens: {t_out}")
        print(f"    - Total Tokens: {t_in + t_out}")
        print(f"  -> DIFFERENCE:")
        print(f"    * Token Reduction: {token_savings_pct:.1f}% fewer tokens")
        print(f"    * Bandwidth Reduction: {payload_savings_pct:.2f}% bandwidth saved")
        print(f"    * LLM Speedup: {speedup:.2f}x faster API response")

    # Aggregate
    vis_cost = (total_vis_input_tokens / 1_000_000 * INPUT_PRICE_PER_M) + (total_vis_output_tokens / 1_000_000 * OUTPUT_PRICE_PER_M)
    text_cost = (total_text_input_tokens / 1_000_000 * INPUT_PRICE_PER_M) + (total_text_output_tokens / 1_000_000 * OUTPUT_PRICE_PER_M)

    vis_cost_per_10k = vis_cost / len(ground_truth) * 10000
    text_cost_per_10k = text_cost / len(ground_truth) * 10000

    print("\n" + "=" * 80)
    print("OVERALL SUMMARY & UNIT ECONOMICS (Across 4 Diverse Scans)")
    print("=" * 80)
    print(f"Total Vision Tokens: {total_vis_input_tokens + total_vis_output_tokens} (Avg {(total_vis_input_tokens + total_vis_output_tokens)/4:.0f} / scan)")
    print(f"Total OCR+Text Tokens: {total_text_input_tokens + total_text_output_tokens} (Avg {(total_text_input_tokens + total_text_output_tokens)/4:.0f} / scan)")
    print(f"Total Token Reduction: {(1.0 - (total_text_input_tokens + total_text_output_tokens)/(total_vis_input_tokens + total_vis_output_tokens))*100.0:.1f}%")
    print(f"\nAverage Payload Upload:")
    print(f"  - Vision: {total_vis_payload / 4 / 1024:.1f} KB / scan")
    print(f"  - OCR+Text: {total_text_payload / 4 / 1024:.2f} KB / scan ({(1.0 - total_text_payload/total_vis_payload)*100.0:.2f}% network savings)")
    print(f"\nAverage API Latency:")
    print(f"  - Vision: {total_vis_latency / 4:.1f} ms")
    print(f"  - OCR+Text: {total_text_latency / 4:.1f} ms ({(total_vis_latency / total_text_latency):.2f}x faster)")
    print(f"\nCost per 10,000 Receipt Scans (Gemini 3.1 Flash Lite):")
    print(f"  - Pipeline A (Vision): ${vis_cost_per_10k:.4f}")
    print(f"  - Pipeline B (ML Kit + Text LLM): ${text_cost_per_10k:.4f}")
    print(f"  - Cost Savings: {(1.0 - text_cost_per_10k/vis_cost_per_10k)*100.0:.1f}% cheaper (${vis_cost_per_10k - text_cost_per_10k:.4f} saved per 10k scans)")

if __name__ == "__main__":
    main()
