# 📄 DOCUMENT 7: REGULATORY & RISK FEASIBILITY SNAPSHOT

**Project:** Wekeza Global Infrastructure (WGI)
**Founding Liquidity Partner:** Wekeza Bank
**Scope:** Pan-African (Phase 1 Focus: Kenya)
**Classification:** Concept & Validation — Phase 1

> ⚠️ This is an **early-phase feasibility snapshot**, not a full compliance plan. It identifies the key regulatory questions that must be answered before commercial launch. See Document 9 (Regulatory Framework Plan) for the full implementation-ready compliance design.

---

## 1️⃣ Regulatory Question: Can WGI Operate?

**Short Answer: Yes — with the right structure and partnerships.**

Kenya has a clear, established regulatory pathway for fintech payment infrastructure. WGI is designed from day one to operate within this framework.

---

## 2️⃣ Key Regulatory Bodies

| Regulator | Jurisdiction | Relevance to WGI |
|---|---|---|
| **Central Bank of Kenya (CBK)** | Kenya | Payment service licensing, FX regulations, KYC/AML |
| **Central Bank of Nigeria (CBN)** | Nigeria | Phase 2 expansion: PSB/Fintech licensing |
| **South African Reserve Bank (SARB)** | South Africa | Phase 3 expansion: Payment System Operator |
| **Financial Reporting Centre (FRC)** | Kenya | AML/CFT reporting |
| **Kenya Revenue Authority (KRA)** | Kenya | VAT on financial services, transaction reporting |

---

## 3️⃣ Phase 1 Kenya Regulatory Pathway

### Option A: Payment Service Provider (PSP) License
- **License type:** CBK Payment Service Provider (Tier 1 or 2)
- **Timeline:** 3–6 months for initial approval
- **Capital requirement:** KES 5M–20M (depending on tier)
- **Key conditions:** KYC/AML program, segregated client funds, annual audits
- **Assessment:** ✅ Feasible — WGI's technical architecture is designed for this

### Option B: Partner with Wekeza Bank (Preferred for Phase 1)
- **Model:** WGI operates as a technology platform; Wekeza Bank holds licenses and client funds
- **Benefit:** No WGI license required for Phase 1 — fastest to market
- **Risk:** Dependency on Wekeza Bank partnership terms
- **Assessment:** ✅ Recommended for Phase 1 PoC

### Option C: E-Money Institution License
- **Timeline:** 6–12 months
- **Capital requirement:** Higher
- **Assessment:** ⚠️ Phase 2+ — too slow for Phase 1

**Phase 1 Recommendation:** Proceed under **Option B** (Wekeza Bank partnership) with parallel application for **Option A** license.

---

## 4️⃣ KYC / AML Feasibility

| Requirement | WGI Approach | Feasibility |
|---|---|---|
| Identity verification (KYC Tier 1) | National ID / Passport API via partner | ✅ Available |
| Enhanced due diligence (KYC Tier 2) | Selfie + document verification | ✅ Third-party providers available |
| AML transaction monitoring | Rule-based + ML alerts in platform | ✅ Implemented in codebase |
| Sanctions screening | OFAC + UN lists via API | ✅ Integrable |
| Suspicious activity reporting | Automated + human review queue | ✅ Implemented |

---

## 5️⃣ FX Regulation Feasibility

- CBK regulates foreign currency transactions under the **Foreign Exchange Act (Cap 113)**
- WGI's FX operations require either a CBK license or partnership with a licensed forex dealer
- **Wekeza Bank as founding liquidity partner** provides the licensed FX dealer relationship needed
- WGI's FX engine routes through licensed providers only — compliant by design

---

## 6️⃣ Data Privacy Feasibility

| Regulation | Jurisdiction | WGI Status |
|---|---|---|
| Data Protection Act 2019 | Kenya | ✅ Compliant architecture (GDPR-aligned) |
| GDPR | EU (for EUR accounts) | ✅ Privacy-by-design |
| NDPR | Nigeria (Phase 2) | ⚠️ To be addressed before Phase 2 |

---

## 7️⃣ Cross-Border Payment Regulations

| Rail | Regulatory Status | WGI Position |
|---|---|---|
| SWIFT | Requires licensed correspondent bank | ✅ Via Wekeza Bank partnership |
| SEPA | EU regulated — requires EU-licensed bank | ✅ Via partner bank in EU |
| ACH | US regulated — requires US banking partner | ✅ Via third-party ACH partner |
| M-PESA / Mobile Money | CBK regulated | ✅ Via Safaricom API (Phase 2) |

---

## 8️⃣ Key Regulatory Risks

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| CBK delays PSP license | High | Low-Medium | Start under Option B (Wekeza Bank) |
| AML/KYC failure resulting in freeze | Critical | Low | Automated monitoring + daily reviews |
| FX regulatory change | Medium | Low | Diversify providers; structure as agent model |
| Cross-border data restrictions | Medium | Low | Local data residency for KE customers |
| Card program rejected by Visa/MC | High | Low | Two-card-network strategy; fallback to prepaid |

---

## 9️⃣ Regulatory Feasibility Verdict

| Question | Answer |
|---|---|
| Can WGI operate in Kenya legally? | ✅ Yes — via Wekeza Bank partnership or PSP license |
| Is there a fast path to market? | ✅ Yes — Option B via founding partner |
| Is the AML/KYC architecture compliant? | ✅ Yes — designed to CBK standards |
| Is cross-border FX compliant? | ✅ Yes — routing through licensed dealers only |
| Are there blocking regulatory risks? | ❌ No blocking risks identified |

**Overall Verdict: ✅ Regulatory pathway is clear and WGI is commercially viable in Kenya.**

---

## 🔟 Phase 1 Regulatory Action Items

| # | Action | Owner | Deadline |
|---|---|---|---|
| 1 | Sign MOU with Wekeza Bank (licensing partnership) | CEO / Legal | Week 2 |
| 2 | Engage CBK fintech sandbox application | Legal counsel | Week 4 |
| 3 | Appoint Data Protection Officer (DPO) | Legal | Week 6 |
| 4 | Commission AML/KYC legal review | Legal | Week 8 |
| 5 | File PSP license application | Legal | Week 10 |
| 6 | Complete first AML audit | Compliance | Month 4 |

---

*Next Step: → Document 8: PoC Scope Definition (POCScope.md)*
*Full compliance detail: → Document 9: Regulatory Framework Plan (RegulatoryFrameworkPlan.md)*
