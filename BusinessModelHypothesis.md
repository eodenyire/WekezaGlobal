# 📄 DOCUMENT 6: BUSINESS MODEL HYPOTHESIS

**Project:** Wekeza Global Infrastructure (WGI)
**Founding Liquidity Partner:** Wekeza Bank
**Scope:** Pan-African
**Classification:** Concept & Validation — Phase 1

> ⚠️ This is a **hypothesis** document. The model below reflects initial assumptions to be validated through market feedback, user interviews, and PoC metrics. It will evolve into the full Revenue Model (Document 8) upon validation.

---

## 1️⃣ Business Model Type

WGI operates as a **B2B2C Financial Infrastructure Platform** with three monetization layers:

```
Individual Users (B2C) ←→ WGI Platform ←→ Banks & Fintechs (B2B)
```

- **B2C layer:** Freelancers, remote workers, SME owners use WGI directly
- **B2B layer:** Fintechs, employers, and payment platforms embed WGI via API
- **Institutional layer:** Banks, card networks, and liquidity providers pay for access and routing

---

## 2️⃣ Hypothesis 1 — Transaction Fee Model

**Assumption:** Users will pay a small fee per transaction in exchange for better rates and faster settlement than competitors.

| Transaction Type | Proposed Fee | Basis |
|---|---|---|
| Inbound international transfer | Free (loss leader) | Drive adoption |
| FX Conversion | 0.5% of converted amount | Below PayPal (3%+) / Wise (~0.65%) |
| Bank withdrawal (KES) | KES 50–150 flat | Per transaction |
| Virtual card transaction | 1% of spend | Interchange-equivalent |

**Validation Signal:** Users currently paying 3–7% to PayPal/Wise will migrate if WGI charges ≤1%.

**Risk:** Price competition from Wise if they expand aggressively to Africa.

---

## 3️⃣ Hypothesis 2 — FX Spread Revenue

**Assumption:** WGI can earn margin between the wholesale rate (from Wekeza Bank + liquidity providers) and the retail rate offered to users.

| Pair | Wholesale Rate (Wekeza Bank) | Retail Rate (User) | WGI Margin |
|---|---|---|---|
| USD→KES | 134.50 | 133.83 | ~0.5% |
| EUR→KES | 146.20 | 145.47 | ~0.5% |
| GBP→KES | 170.30 | 169.45 | ~0.5% |

**Monthly Revenue Estimate (Phase 1 PoC):**
- $5M FX volume × 0.5% = **$25,000/month**

**Validation Signal:** Wekeza Bank confirms wholesale rate access and willingness to provide preferential rates as founding partner.

---

## 4️⃣ Hypothesis 3 — B2B API Revenue (SaaS Pricing)

**Assumption:** Fintechs, payroll providers, and employers will pay a subscription + usage fee to embed WGI infrastructure.

| Tier | Monthly Fee | Included Volume | Per-API-Call Beyond |
|---|---|---|---|
| Starter | $299/mo | 1,000 API calls | $0.05/call |
| Growth | $999/mo | 10,000 API calls | $0.03/call |
| Enterprise | Custom | Unlimited | Custom |

**Validation Signal:** Identify 3–5 fintech partners willing to sign LOIs at Starter tier during PoC.

---

## 5️⃣ Hypothesis 4 — Card Interchange Revenue

**Assumption:** Virtual USD card issuance generates interchange revenue from Visa/Mastercard network on each card transaction.

- Interchange rate: ~1.5% per international transaction
- WGI net share after card network fees: ~0.5%
- Target: 1,000 active virtual cards × $500/month average spend = $500K/month spend volume
- Monthly revenue: $500K × 0.5% = **$2,500/month** at Phase 1

**Validation Signal:** Card program partners (Visa/Mastercard) confirm revenue share terms.

---

## 6️⃣ Hypothesis 5 — Credit Intelligence (Long-Term)

**Assumption:** WGI's transaction data creates a unique credit scoring dataset that can be licensed to lenders or used for WGI's own credit products.

| Model | Revenue | Timeline |
|---|---|---|
| Data licensing to microfinance lenders | Per-query fee | Phase 3+ |
| WGI credit lines against foreign earnings | Interest income | Phase 3+ |
| Credit score API for banks/fintechs | SaaS subscription | Phase 4+ |

**Validation Signal (Phase 1):** Begin capturing transaction behavioral data — demonstrate 90-day trends for 500 freelancers.

---

## 7️⃣ Unit Economics Hypothesis

### Customer Acquisition Cost (CAC)
| Channel | Estimated CAC |
|---|---|
| Freelancer community (online) | $10–$25 |
| SME partnership (referral) | $50–$100 |
| B2B API sale (direct) | $200–$500 |

### Lifetime Value (LTV) Hypothesis
| Segment | Monthly Revenue/User | Avg Lifetime | LTV |
|---|---|---|---|
| Freelancer | $8 | 36 months | $288 |
| SME | $45 | 48 months | $2,160 |
| API Partner | $500 | 36 months | $18,000 |

### LTV:CAC Ratio
- Freelancer: 288/25 = **11.5x** ✅
- SME: 2,160/100 = **21.6x** ✅
- API Partner: 18,000/500 = **36x** ✅

All segments show strong unit economics if assumptions hold.

---

## 8️⃣ Assumptions to Validate

| # | Assumption | Validation Method | Status |
|---|---|---|---|
| 1 | Users will switch from PayPal/Wise for 0.5% FX | User interviews + PoC signups | Phase 1 |
| 2 | Wekeza Bank provides wholesale FX rates | Partner agreement signing | Phase 1 |
| 3 | Settlement within 2h to any KE bank | Technical PoC testing | Phase 1 |
| 4 | Fintechs will pay $299+/mo for API access | 3 signed LOIs | Phase 1 |
| 5 | 2,000 freelancer signups in 90 days | Marketing campaign | Phase 1 |
| 6 | CBK licensing pathway confirmed | Legal counsel engagement | Phase 1 |
| 7 | Card program viability (Visa/MC) | Partner discussions | Phase 2 |
| 8 | Credit data has commercial lending value | Microfinance partner pilot | Phase 3 |

---

## 9️⃣ Hypothesis Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PayPal improves Africa payouts | Medium | High | Speed moat + multi-bank differentiation |
| Wise expands aggressively to Africa | Medium | High | B2B API focus (Wise is B2C) |
| CBK delays licensing | Low | Critical | Structure as payment service provider first |
| Wekeza Bank pulls partnership | Low | High | Diversify to 2+ liquidity providers early |
| Low user adoption rate | Medium | Medium | Incentivized beta + community partnerships |

---

## 🔟 Phase 1 Business Model Validation Goals

By end of Phase 1 PoC (90 days), WGI must prove:

1. ✅ 2,000+ freelancer accounts registered
2. ✅ $1M+ FX volume processed
3. ✅ 3+ fintech partners using sandbox API
4. ✅ Average FX saving of 2%+ vs PayPal demonstrated
5. ✅ Wekeza Bank partnership MOU signed

If these 5 proof points are met → proceed to Series A fundraising and Phase 2 expansion.

---

*Next Step: → Document 7: Regulatory & Risk Feasibility Snapshot*
