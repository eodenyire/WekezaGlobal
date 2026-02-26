# 📄 TECH STACK DECISION

**Project:** Wekeza Global Infrastructure (WGI)
**Founding Liquidity Partner:** Wekeza Bank

---

## 1️⃣ Backend

| Layer / Component              | Technology              | Rationale                                                                     |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| Core Banking Integration       | **C#, C, C++**          | Already existing core systems; high performance and stability                 |
| Microservices / Business Logic | **Python, NodeJS**      | Python for FX, analytics, ML; NodeJS for APIs & fintech integrations          |
| API Layer                      | **NodeJS + TypeScript** | Strong type safety, async performance, easy integration with frontend         |
| FX & Settlement Engine         | **Python**              | Fast prototyping, libraries for numerical computations, AI-based optimization |
| Card Issuing Service           | **C#**                  | Strong integration with banking APIs (Visa, Mastercard)                       |
| Compliance/KYC Engine          | **Python**              | Flexible integration with AML/PEP databases and ML fraud detection            |

---

## 2️⃣ Frontend

| Layer / Component                          | Technology                            | Rationale                                                |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------------------- |
| Web Portal (Admin / Compliance Dashboards) | **ReactJS + TypeScript + HTML + CSS** | Modern, responsive, component-based UI, maintainable     |
| Mobile Apps (iOS & Android)                | **React Native or Flutter**           | Cross-platform, faster development, shared codebase      |
| User Dashboards                            | **ReactJS + TypeScript**              | Real-time wallet balances, FX rates, transaction history |

---

## 3️⃣ Database & Storage

| Layer / Component        | Technology               | Rationale                                                         |
| ------------------------ | ------------------------ | ----------------------------------------------------------------- |
| Transactional DB         | **PostgreSQL**           | ACID-compliant, scalable, supports complex queries                |
| Analytics & Reporting DB | **MySQL**                | Easy integration for analytics, OLAP workloads                    |
| Cache                    | **Redis**                | High-speed caching for wallet balances, FX rates, API throttling  |
| Data Warehouse           | **Snowflake / Redshift** | Cross-region analytics, ML model training for credit intelligence |

---

## 4️⃣ DevOps / Infrastructure

| Component        | Technology                                      | Rationale                                                      |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Containerization | **Docker**                                      | Standardized environments, portability                         |
| Orchestration    | **Kubernetes**                                  | Horizontal scaling, high availability, multi-region deployment |
| CI/CD            | **GitHub Actions / GitLab CI**                  | Automated testing, deployment, rollback                        |
| Monitoring       | **Prometheus + Grafana**                        | Metrics collection, dashboards                                 |
| Logging          | **ELK Stack (Elasticsearch, Logstash, Kibana)** | Centralized logging and auditing                               |
| Cloud Provider   | **Azure / AWS**                                 | Multi-region deployment, managed services, disaster recovery   |

---

## 5️⃣ Security Stack

| Component                 | Technology / Approach                   | Rationale                                       |
| ------------------------- | --------------------------------------- | ----------------------------------------------- |
| Authentication            | OAuth2 + JWT + MFA                      | Standardized secure user access                 |
| Encryption                | AES-256 (at rest), TLS 1.3 (in transit) | Compliance with regulatory standards            |
| Fraud Detection           | Python ML models, anomaly detection     | Real-time monitoring of suspicious transactions |
| Role-Based Access Control | RBAC (backend & frontend)               | Fine-grained permission management              |

---

## 6️⃣ Integration Layer

* **Bank APIs** → C#, NodeJS adapters
* **Fintech APIs** → REST/GraphQL via NodeJS + TypeScript
* **Payment Providers** → PayPal, PesaPal, Visa, Mastercard, Stripe
* **Cross-Border FX & Settlement** → Python-based FX & liquidity engine

---

## 7️⃣ Rationale Summary

1. **Leverage existing Wekeza core banking tech** (C#, C, C++) for stability.
2. **Python for data-heavy modules** (FX, ML, credit scoring).
3. **NodeJS + TypeScript for API layer** to handle fintech integrations and multi-client apps.
4. **React / React Native for cross-platform UI**, fast iteration.
5. **PostgreSQL + MySQL + Redis** ensures transactional integrity, analytics, and caching.
6. **Cloud-native deployment** for scaling across multiple African countries.

---


