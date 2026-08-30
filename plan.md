# Pip Roadmap & Implementation Milestones

This document tracks completed architectural milestones and active roadmap items for **Pip**, the on-device personal finance & budgeting app.

---

## 1. Completed Milestones

### Milestone 1: Standalone Architecture & Lending Decoupling
- [x] Completely decoupled from the legacy competition codebase and removed credit scoring, loan marketplace, fraud models, and credit passports.
- [x] Restructured primary navigation to 4 core tabs: **Home**, **Activity**, **Net Worth**, and **Settings**, plus center **Add (+)**.
- [x] Cleaned SQLite schema down to budgeting, net worth, commitments, and tax relief tables.

### Milestone 2: Onboarding Setup Wizard & Taxonomy Retune
- [x] Replaced legacy onboarding with a 5-step interactive setup wizard (Mascot intro → monthly budget baseline → recurring commitments → notifications → widget setup).
- [x] Streamlined expense category taxonomy to 7 intuitive buckets with automatic database migration and remap table.

### Milestone 3: Multi-Currency & Real-Time FX
- [x] Added support for global fiat currencies (USD, SGD, EUR, GBP, JPY, CNY, AUD, etc.).
- [x] Integrated real-time FX conversion with automatic base currency normalization.
- [x] Supported multi-currency asset balances and foreign transactions.

### Milestone 4: Malaysian Tax Relief Tagging (LHDN)
- [x] Built tax relief tagging engine for LHDN Form BE (G6 to G13).
- [x] Implemented sub-cap monitoring (Lifestyle RM2,500, Sports RM1,000, Medical RM10,000, etc.).
- [x] Built tax audit pack exporter and receipt evidence attachment.

### Milestone 5: Smart Bill Splitting & Receivables
- [x] Itemized bill splitting engine handling SST (6%/8%), service charges (10%), vouchers, and unequal shares.
- [x] Real-time **Owed** screen for managing receivables and recording one-tap settlements.

---

## 2. Active Roadmap & Future Enhancements

### Phase A: Play Store Release Polish
- [ ] Implement user privacy policy document compliant with Google Play financial data requirements.
- [ ] Configure client-side or proxy rate limits for AI vision extraction keys.
- [ ] Finalize store screenshot generation and marketing assets.

### Phase B: Performance Optimizations (Ref: `docs/PerformanceOptimization.md`)
- [ ] Implement list virtualization / FlatList optimization in `AllTransactionsScreen.tsx`.
- [ ] Optimize Net Worth historical calculation memoization.
- [ ] Optimize budget progress bar layout animations to eliminate UI thread overhead.

### Phase C: Advanced Personal Finance Features
- [ ] Enhanced tax relief receipt categorization and audit export summaries.
- [ ] Enhanced recurring subscription renewal alert notifications.
- [ ] Customizable CSV / Excel export templates.
