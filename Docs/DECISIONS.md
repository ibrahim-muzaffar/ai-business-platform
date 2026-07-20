# AI Business OS — Architectural Decisions

**Version:** 1.0

## ADR format

Each decision contains:

- Status
- Context
- Decision
- Rationale
- Consequences

---

## ADR-001 — Build one AI Business OS rather than separate bots

**Status:** Accepted

**Context:** The product may provide reception, sales, booking, support, email, documents, and later agentic capabilities.

**Decision:** Build one shared multi-tenant platform containing reusable modules.

**Rationale:** Shared foundations prevent duplicated customer, conversation, security, and integration logic.

**Consequences:** Module boundaries must be explicit. Separate industry backends are prohibited.

---

## ADR-002 — Treat industries as configuration

**Status:** Accepted

**Context:** Barbers, restaurants, dentists, gyms, estate agents, and other businesses need different workflows.

**Decision:** Represent industry differences through business data, workflows, enabled modules, required fields, permissions, and integrations.

**Rationale:** A new industry should reuse the platform rather than copy it.

**Consequences:** Restaurant is added only after the barber vertical slice proves the reusable architecture.

---

## ADR-003 — Keep modules separate from channels

**Status:** Accepted

**Context:** The same capability may be needed through website, email, WhatsApp, Instagram, or phone.

**Decision:** Modules define capabilities; channels define transport and message origin.

**Rationale:** Booking should not be reimplemented for every channel.

**Consequences:** Channel adapters normalise requests into the shared conversation and module system.

---

## ADR-004 — Use repository interfaces to isolate infrastructure

**Status:** Accepted

**Context:** The prototype uses JSON and in-memory storage, while the permanent system will use PostgreSQL and external providers.

**Decision:** Application services depend on stable repository and adapter contracts.

**Rationale:** Infrastructure can change without rewriting routes and business logic.

**Consequences:** Direct storage access from routes is prohibited.

---

## ADR-005 — Use PostgreSQL as permanent storage

**Status:** Accepted

**Context:** Leads, conversations, business settings, and users require durable relational storage.

**Decision:** PostgreSQL is the permanent application database.

**Rationale:** It supports relational integrity, transactions, tenant scoping, migrations, and reporting.

**Consequences:** JSON and in-memory storage remain temporary and are replaced in Phase 2.

---

## ADR-006 — Complete one barber vertical slice before multi-industry expansion

**Status:** Accepted

**Context:** Broad industry support too early would encourage duplicated and unproven workflows.

**Decision:** Build the barber end-to-end before adding the restaurant.

**Rationale:** One complete vertical slice validates the platform more effectively than several shallow demos.

**Consequences:** Other businesses remain unsupported live demos until Phase 11.

---

## ADR-007 — Build permanent data storage before the dashboard

**Status:** Accepted

**Context:** A dashboard built on JSON and in-memory sessions would require significant rework.

**Decision:** Complete PostgreSQL persistence before dashboard implementation.

**Rationale:** The dashboard should read the permanent data model from the start.

**Consequences:** Dashboard work begins in Phase 4.

---

## ADR-008 — Add authentication and tenant isolation before owner data access

**Status:** Accepted

**Context:** Owner data includes leads, customers, conversations, bookings, and settings.

**Decision:** Authentication and tenant isolation are completed before the owner dashboard.

**Rationale:** Protected data must never rely on UI hiding alone.

**Consequences:** Cross-tenant tests are required before dashboard release.

---

## ADR-009 — Freeze major public website work until Phase 9

**Status:** Accepted

**Context:** The product positioning, contact flow, login links, legal pages, and launch content depend on the completed core product.

**Decision:** Before Phase 9, only fix website defects that block development or testing.

**Rationale:** Completing the public site too early creates rework around an evolving product.

**Consequences:** The About area, contact section and flow, and footer are currently absent and remain planned for Phase 9. Final navigation, SEO, legal pages, and launch polish also remain incomplete until Phase 9.

---

## ADR-010 — Complete and deploy the public website in Phase 9

**Status:** Accepted

**Context:** The public site must eventually represent a real, deployable product rather than a prototype.

**Decision:** Finish the public website, contact workflow, legal pages, accessibility, SEO, and deployment during Phase 9.

**Rationale:** At that point the real barber MVP capabilities and onboarding flow are known.

**Consequences:** Phase 9 combines production readiness, website completion, and barber launch.

---

## ADR-011 — Prefer APIs over browser and desktop automation

**Status:** Accepted

**Context:** Browser and desktop automation are less reliable and harder to secure.

**Decision:** Use the hierarchy: official API, approved integration, browser automation, desktop computer use.

**Rationale:** APIs are more deterministic, auditable, and maintainable.

**Consequences:** Computer use is delayed until Phase 16 and requires stronger safeguards.

---

## ADR-012 — Require confirmed tool success before reporting actions as complete

**Status:** Accepted

**Context:** Language models can generate plausible but unverified claims.

**Decision:** The system reports booking, email, refund, payment, upload, or other external actions as complete only after confirmed provider success.

**Rationale:** Customer-facing trust requires deterministic confirmation.

**Consequences:** Action services and logs must distinguish requested, failed, pending, and confirmed outcomes.

---

## ADR-013 — Use one short-lived feature branch per major phase

**Status:** Accepted

**Context:** The project needs a simple Git workflow without unnecessary branch complexity.

**Decision:** From Phase 2 onward, create one short-lived feature branch per major phase.

**Rationale:** It keeps `main` stable while avoiding a complicated `develop` workflow.

**Consequences:** Each phase is tested, reviewed, merged, and its branch deleted.

---

## ADR-014 — Do not overlap or jump phases

**Status:** Accepted

**Context:** Repeated priority changes cause skipped dependencies and unfinished work.

**Decision:** Complete the active phase before beginning the next.

**Rationale:** The roadmap is dependency-ordered.

**Consequences:** New ideas go to the backlog unless a formal change condition is met.

---

## ADR-015 — Record roadmap changes through formal change control

**Status:** Accepted

**Context:** Some changes may become necessary because of security, technical dependencies, pilot evidence, or provider constraints.

**Decision:** Record every phase-order change in this document.

**Rationale:** The project must preserve decision history and avoid casual drift.

**Consequences:** Every change records reason, evidence, timeline impact, and unchanged commitments.

---

## ADR-016 — Keep public chatbot data separate from protected owner data

**Status:** Accepted

**Context:** Public users need approved business facts, while owners access private leads and settings.

**Decision:** Public routes receive only approved public business data. Protected data requires authenticated tenant context.

**Rationale:** This limits exposure and simplifies authorisation.

**Consequences:** Repositories and services distinguish public and protected access paths.

---

## ADR-017 — Keep routes thin and place business logic in services and modules

**Status:** Accepted

**Context:** A single large chat route would become difficult to test and extend.

**Decision:** Routes validate, resolve context, call services, and return responses.

**Rationale:** Domain logic belongs in reusable, testable services and modules.

**Consequences:** New features must not be added directly as unrelated logic in route files.

---

## ADR-018 — Treat JSON and in-memory storage as temporary prototype infrastructure

**Status:** Accepted

**Context:** The prototype proved the flow using simple storage.

**Decision:** Keep current implementations only until PostgreSQL replacement in Phase 2.

**Rationale:** Temporary infrastructure accelerated validation but is not suitable for production.

**Consequences:** Current repositories should preserve migration-friendly contracts.

---

## ADR-019 — Add commercial SaaS capabilities after the first industry proof and pilot

**Status:** Accepted

**Context:** Billing and packaging depend on a proven product and customer workflow.

**Decision:** Add the commercial SaaS foundation after barber launch, pilot, and restaurant configuration.

**Rationale:** Packaging should reflect validated modules and outcomes.

**Consequences:** Manual invoicing is acceptable for the earliest pilot.

---

## ADR-020 — Add communication channels one at a time using shared modules

**Status:** Accepted

**Context:** Email, WhatsApp, Instagram, and phone each add provider complexity.

**Decision:** Add one channel at a time and route all of them through shared conversations and modules.

**Rationale:** This reduces disconnected systems and makes testing manageable.

**Consequences:** No channel receives a separate AI brain.

---

## Change record template

Use this section only when an accepted roadmap or architectural decision changes.

### Change ID

**Date:**  
**Decision affected:**  
**What changed:**  
**Why it changed:**  
**Supporting evidence:**  
**Timeline impact:**  
**What remains unchanged:**
