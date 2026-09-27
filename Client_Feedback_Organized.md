# Client Feedback — Organized by Tab

Notes from the client visit, organized by where each change belongs in the system.

---

## 1. System-wide (all forms)

- Auto-**capitalize all text inputs** everywhere (Rent Car, Manage Vehicle / Add Vehicle, Edit Vehicle, and other forms). Always uppercase or title-case as needed — no lowercase entries.

---

## 2. Manage Vehicle

- **Fix OR/CR scan** — currently not working; make upload + autofill reliable again.
- **Add Insurance** — new field/section for vehicle insurance details (document upload and/or info fields).
- For **third-party owned** vehicles: support **before & after photos** of the car
  - *Before* = when the unit was received/turned over to Alatas
  - *After* = when the unit is returned/taken back by the owner

---

## 3. Rent Car

- Add **Drive type**: **City Drive** or **Outside Drive** (in addition to existing Self-drive / With-driver if kept).
- Expand **vehicle photos** to **8 or more** (not just the current 4 sides). Include front, back, sides, and **interior**, plus room for more angles.
- Add **driver rates** (when with driver):
  - **City drive:** PHP 80/hour, **minimum 12 hours**
  - **Outside drive:** PHP 100/hour, **minimum 12 hours**
- **Repeat customers:** when typing name/details, suggest / autofill from past renters so returning customers don’t re-encode from scratch.

---

## 4. Dashboard / Active Rentals (Complete flow)

- Keep the existing **Complete** action when the rental is finished.
- Add a separate path/button for cases with **damage** (e.g. **Damaged** / damage report) — not only a simple “Complete.”
- Possibly a **Damaged** status or dedicated section/tab so damaged returns are tracked apart from normal completed rentals.

---

## 5. Transaction / Car History (rental detail + print/download)

- Allow **editing overdue charges** when the rental exceeds the agreed time/price.
- Any price updates (overdue / extra charges) must also **update the downloaded/printed document** before printing.
- Downloaded documents should use **long bond paper** size (Philippine long bond: **8.5" × 13"**), not short bond/A4-only.

---

## 6. Rates / Pricing logic

*(Touches Rent Car + Manage Vehicle rates + Transaction totals)*

- Apply the driver rate rules above when computing rental cost.
- Ensure final totals (base + driver + overdue + damage-related extras, if any) stay consistent on screen and on the printable document.
