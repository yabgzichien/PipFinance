#!/usr/bin/env python3
"""
Tiny Statistical Classifier Trainer for Pip Finance.
Trains an on-device text classifier for merchant / transaction category prediction
using TF-Weighted Positive Log-Odds with Sub-word Character N-Grams and CJK Bigrams.

Features:
- Pure Python 3 (zero dependencies, no pip install required).
- Tokenizes words, character 3/4-grams (typo resilience), and CJK 1/2-grams.
- TF-weighted positive log-odds prevents rare noise tokens from dominating core brands.
- Evaluates with stratified random train/test split (precision, recall, accuracy).
- Exports compact, optimized JSON model (~80KB-95KB) for React Native / TypeScript runtime.
"""

import json
import math
import os
import random
import re
import sys
from collections import Counter, defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_FILE = os.path.join(SCRIPT_DIR, "dataset.json")
EXPORT_APP_PATH = os.path.join(SCRIPT_DIR, "../../src/data/merchantClassifierModel.json")
EXPORT_LOCAL_PATH = os.path.join(SCRIPT_DIR, "model.json")

def tokenize(text: str) -> list[str]:
    """
    Extracts word tokens, sub-word character 3-grams/4-grams, edge prefixes/suffixes, and CJK 1/2-grams.
    Edge anchors and character n-grams provide automatic typo tolerance (e.g. 'luch' -> 'lunch', 'strbucks' -> 'starbucks').
    """
    text = text.lower().strip()
    cleaned = re.sub(r'[$€£¥₩฿₹₽₸0-9,._\-/:;!?#@%&*+=/\\|<>(){}[\]~`"\']', ' ', text)
    words = [w for w in cleaned.split() if len(w) > 0]
    tokens = []

    for word in words:
        tokens.append(f"w:{word}")

        # Prefix and suffix edge tokens (anchors word boundaries)
        if len(word) >= 3:
            tokens.append(f"^{word[:3]}")
            tokens.append(f"{word[-3:]}$")
            if len(word) >= 4:
                tokens.append(f"^{word[:4]}")
                tokens.append(f"{word[-4:]}$")

        # Sub-word character n-grams for typo resilience
        if len(word) >= 3:
            for n in (3, 4):
                if len(word) >= n:
                    for i in range(len(word) - n + 1):
                        tokens.append(f"#{word[i:i+n]}")

        # CJK characters (single and bigrams) for Chinese / Japanese text
        cjk_chars = [ch for ch in word if re.search(r'[\u4e00-\u9fff]', ch)]
        for ch in cjk_chars:
            tokens.append(f"cjk:{ch}")
        for i in range(len(cjk_chars) - 1):
            tokens.append(f"cjk2:{cjk_chars[i]}{cjk_chars[i+1]}")

    return tokens

class TFWeightedLogOddsClassifier:
    """
    TF-Weighted Log-Odds Ratio Classifier with Positive Signal Pruning.
    Feature importance: (1 + ln(TF(t, c))) * ln(P(t|c) / P(t|not c)) * TypeBonus.
    Tokens with negative log-odds are pruned, maintaining high speed and compact size.
    """
    def __init__(self, alpha: float = 0.1, min_freq: int = 1, top_n_per_cat: int = 800):
        self.alpha = alpha
        self.min_freq = min_freq
        self.top_n_per_cat = top_n_per_cat
        self.categories = []
        self.vocab = set()
        self.weights = {}  # category -> {token: weight}
        self.priors = {}   # category -> prior log probability

    def train(self, samples: list[dict]):
        by_cat = defaultdict(list)
        cat_token_count = defaultdict(Counter)
        total_cat_tokens = Counter()
        all_tokens = Counter()
        doc_freq = Counter()

        for s in samples:
            cat = s["category"]
            by_cat[cat].append(s["text"])
            toks = tokenize(s["text"])
            for t in set(toks):
                doc_freq[t] += 1
            for t in toks:
                cat_token_count[cat][t] += 1
                total_cat_tokens[cat] += 1
                all_tokens[t] += 1

        self.categories = sorted(list(by_cat.keys()))
        total_docs = len(samples)

        # Filter noise n-grams: keep words, CJK, and edge anchors; require internal character n-grams to appear at least twice
        self.vocab = {t for t, cnt in doc_freq.items() if (t.startswith("w:") or t.startswith("cjk") or t.startswith("^") or t.endswith("$") or cnt >= 2)}
        v_size = len(self.vocab)
        total_all_tokens = sum(total_cat_tokens.values())

        self.weights = {}
        self.priors = {}

        for c in self.categories:
            self.priors[c] = round(math.log(len(by_cat[c]) / total_docs), 4)
            comp_tokens = total_all_tokens - total_cat_tokens[c]
            cat_scores = {}

            for t in self.vocab:
                cnt_in_c = cat_token_count[c][t]
                if cnt_in_c == 0:
                    continue

                p_c = (cnt_in_c + self.alpha) / (total_cat_tokens[c] + self.alpha * v_size)
                comp_count = all_tokens[t] - cnt_in_c
                p_not_c = (comp_count + self.alpha) / (comp_tokens + self.alpha * v_size)
                log_ratio = math.log(p_c / p_not_c)

                # Keep distinctive positive signal
                if log_ratio > 0.1:
                    tf_factor = 1.0 + math.log(cnt_in_c)
                    # Feature weights: words & CJK 1.5x, edge tokens 1.2x, internal n-grams 1.0x
                    if t.startswith("w:") or t.startswith("cjk"):
                        bonus = 1.5
                    elif t.startswith("^") or t.endswith("$"):
                        bonus = 1.2
                    else:
                        bonus = 1.0
                    cat_scores[t] = round(tf_factor * log_ratio * bonus, 2)

            # Keep top-N most distinctive features per category to keep model light (~130KB-140KB)
            sorted_tokens = sorted(cat_scores.items(), key=lambda x: x[1], reverse=True)[:self.top_n_per_cat]
            self.weights[c] = dict(sorted_tokens)

    def predict(self, text: str) -> list[tuple[str, float]]:
        """
        Returns ranked list of (category, confidence) pairs.
        """
        tokens = tokenize(text)
        scores = {}

        for c in self.categories:
            w_map = self.weights[c]
            # Sum TF-weighted log-odds of matching tokens
            tok_score = sum(w_map.get(t, 0.0) for t in tokens)
            scores[c] = tok_score

        max_score = max(scores.values()) if scores else 0.0
        if max_score <= 0.0:
            uniform = 1.0 / len(self.categories) if self.categories else 0.0
            return [(c, uniform) for c in self.categories]

        # Softmax over positive scores for calibrated confidence
        exp_scores = {c: math.exp(min(50.0, score - max_score)) for c, score in scores.items()}
        sum_exp = sum(exp_scores.values()) or 1.0
        ranked = [(c, round(exp_scores[c] / sum_exp, 4)) for c in self.categories]
        ranked.sort(key=lambda x: x[1], reverse=True)
        return ranked

    def export_json(self) -> dict:
        return {
            "version": 2,
            "categories": self.categories,
            "weights": self.weights,
        }

def evaluate(samples: list[dict], train_ratio: float = 0.8, seed: int = 42):
    random.seed(seed)
    by_cat = defaultdict(list)
    for s in samples:
        by_cat[s["category"]].append(s)

    train_data = []
    test_data = []
    for cat, items in by_cat.items():
        shuffled = list(items)
        random.shuffle(shuffled)
        split_idx = max(1, int(len(shuffled) * train_ratio))
        train_data.extend(shuffled[:split_idx])
        test_data.extend(shuffled[split_idx:])

    clf = TFWeightedLogOddsClassifier(alpha=0.1, min_freq=1, top_n_per_cat=800)
    clf.train(train_data)

    correct = 0
    cat_correct = Counter()
    cat_total_test = Counter()
    cat_predicted = Counter()

    for s in test_data:
        actual = s["category"]
        cat_total_test[actual] += 1
        preds = clf.predict(s["text"])
        top_pred = preds[0][0]
        cat_predicted[top_pred] += 1
        if top_pred == actual:
            correct += 1
            cat_correct[actual] += 1

    accuracy = (correct / len(test_data)) * 100 if test_data else 0.0
    print(f"\n========================================================")
    print(f" Model Evaluation (Train: {len(train_data)}, Test: {len(test_data)})")
    print(f" Overall Test Accuracy: {accuracy:.2f}% ({correct}/{len(test_data)})")
    print(f"========================================================")
    print(f"{'Category':<16} | {'Test Count':<10} | {'Precision':<10} | {'Recall':<10}")
    print("-" * 54)

    for c in sorted(by_cat.keys()):
        actual_cnt = cat_total_test[c]
        corr_cnt = cat_correct[c]
        pred_cnt = cat_predicted[c]
        precision = (corr_cnt / pred_cnt * 100) if pred_cnt > 0 else 0.0
        recall = (corr_cnt / actual_cnt * 100) if actual_cnt > 0 else 0.0
        print(f"{c:<16} | {actual_cnt:<10} | {precision:>8.1f}% | {recall:>8.1f}%")

def main():
    if not os.path.exists(DATASET_FILE):
        print(f"Error: dataset file not found at {DATASET_FILE}")
        sys.exit(1)

    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        samples = json.load(f)

    print(f"Loaded {len(samples)} training samples from dataset.json.")

    # 1. Stratified Train / Test evaluation
    evaluate(samples, train_ratio=0.8, seed=42)

    # 2. Train on full dataset for production artifact
    full_clf = TFWeightedLogOddsClassifier(alpha=0.1, min_freq=1, top_n_per_cat=800)
    full_clf.train(samples)

    # 3. Export model JSON
    model_data = full_clf.export_json()
    model_json = json.dumps(model_data, ensure_ascii=False)

    # Save to tools/classifier/model.json
    with open(EXPORT_LOCAL_PATH, "w", encoding="utf-8") as f:
        f.write(model_json)
    print(f"\nLocal model saved to: {EXPORT_LOCAL_PATH} ({len(model_json) / 1024:.1f} KB)")

    # Save to src/data/merchantClassifierModel.json
    os.makedirs(os.path.dirname(EXPORT_APP_PATH), exist_ok=True)
    with open(EXPORT_APP_PATH, "w", encoding="utf-8") as f:
        f.write(model_json)
    print(f"App production model exported to: {EXPORT_APP_PATH}")

    # 4. Multi-lingual & Typo sample query tests
    sample_queries = [
        # Typos
        ("luch", "food"),
        ("diner", "food"),
        ("brekfast", "food"),
        ("strbucks", "food"),
        ("petro", "travelling"),
        ("salry", "salary"),
        # English & Regional
        ("LaundryBar 24h dobi", "other"),
        ("SS2 Dobi Queen", "other"),
        ("Starbucks coffee", "food"),
        ("GSC ticket IMAX", "entertainment"),
        ("TNB electricity bill", "utilities"),
        ("AirAsia flight ticket", "travelling"),
        ("Shopee parcel checkout", "shopping"),
        ("Clinic Panadol medicine", "medical"),
        ("Prudential medical card", "insurance"),
        ("Tuition fee math", "learning"),
        ("Condo rental payment", "rental"),
        ("Monthly salary deposit", "salary"),
        ("Maxis home fibre", "phone-bill"),
        ("Netflix subscription", "subscriptions"),
        ("Baby milk formula", "family"),
        ("Maybank dividend payout", "other-income"),
        ("Mamak roti canai teh tarik", "food"),
        ("Touch n Go reload RFID", "travelling"),
        ("Uniqlo jacket shirt", "shopping"),
        ("Pampers baby diapers", "family"),
        ("Sumbangan Tunai Rahmah STR", "allowance"),
        # Chinese queries
        ("星巴克冰美式咖啡", "food"),
        ("海底捞火锅聚餐", "food"),
        ("轻快铁LRT买车票", "travelling"),
        ("国家能源电费单", "utilities"),
        ("优衣库买两件短袖T恤", "shopping"),
        ("看电影买IMAX电影票", "entertainment"),
        ("投币洗衣店洗床单", "other"),
        ("诊所看医生拿退烧药", "medical"),
        ("牙医洗牙拔智齿", "medical"),
        ("转账主人房租金", "rental"),
        ("公司每月薪水入账", "salary"),
        ("股票分红派息到账", "other-income"),
        ("奈飞网飞会员月费", "subscriptions"),
        ("买婴儿纸尿裤和奶粉", "family"),
        ("每月电话费和宽带网络", "phone-bill"),
        ("买中小学参考书作业本", "learning")
    ]

    print(f"\n--- Live Multi-Lingual Validation ({len(sample_queries)} samples) ---")
    correct = 0
    for q, expected in sample_queries:
        preds = full_clf.predict(q)
        top_cat, top_conf = preds[0]
        second_cat, second_conf = preds[1]
        is_ok = "PASS" if top_cat == expected else "FAIL"
        if top_cat == expected:
            correct += 1
        print(f"[{is_ok}] '{q}' -> {top_cat} ({top_conf*100:.1f}%) [expected: {expected}]")
    print(f"Validation Score: {correct}/{len(sample_queries)} ({correct/len(sample_queries)*100:.1f}%)")

if __name__ == "__main__":
    main()
