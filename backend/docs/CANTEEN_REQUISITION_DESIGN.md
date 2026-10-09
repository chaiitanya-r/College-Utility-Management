# Canteen Requisition Workflow — Design Document

## Overview

A strict, sequential approval flow for canteen food/beverage requisitions. Each step is status-locked; approvers receive only requests at their stage.

---

## 1. Status Flow (Strict Sequential)

```
                    ┌──────────────┐
                    │   CANCELLED  │
                    └──────▲───────┘
                           │ cancel (HOD/Registrar/Director)
    ┌──────────────────────┼───────────────────────┐
    │                      │                       │
    │  ┌──────────────┐    │    ┌──────────────┐   │
    │  │ PENDING_HOD  │────┼───►│ APPROVED_HOD │   │
    │  └──────────────┘    │    └──────┬───────┘   │
    │         ▲            │           │           │
    │         │ create     │           │ approve   │
    │         │ (assistant)│           │ (hod)     │
    │         │            │           ▼           │
    │         │            │    ┌──────────────────┐
    │         │            │    │ APPROVED_REGISTRAR│
    │         │            │    └──────┬───────────┘
    │         │            │           │ approve (registrar)
    │         │            │           ▼           │
    │         │            │    ┌──────────────────┐
    │         │            │    │ APPROVED_DIRECTOR │
    │         │            │    └──────┬───────────┘
    │         │            │           │ approve (director)
    │         │            │           ▼           │
    │         │            │    ┌──────────────────┐
    │         │            └───►│ PREPARED         │  ← canteen marks ready
    │         │                 └──────┬───────────┘
    │         │                        │ hand over (peon)
    │         │                        ▼
    │         │                 ┌──────────────────┐
    │         │                 │ HANDED_OVER      │  ← peon name/phone stored
    │         │                 └──────────────────┘
    │         │
    └─────────┴─────────────────────────────────────┘
```

| Status | Meaning | Next Allowed Transitions |
|--------|---------|--------------------------|
| `PENDING_HOD` | Awaiting HOD approval | `APPROVED_HOD`, `CANCELLED` |
| `APPROVED_HOD` | HOD approved, awaiting Registrar | `APPROVED_REGISTRAR`, `CANCELLED` |
| `APPROVED_REGISTRAR` | Registrar approved, awaiting Director | `APPROVED_DIRECTOR`, `CANCELLED` |
| `APPROVED_DIRECTOR` | Fully approved, awaiting canteen | `PREPARED`, `CANCELLED` |
| `PREPARED` | Canteen marked order ready | `HANDED_OVER` |
| `HANDED_OVER` | Delivered to peon, billing stored | (terminal) |
| `CANCELLED` | Rejected or cancelled | (terminal) |

---

## 2. Role-Permission Matrix

| Action | Assistant | HOD | Registrar | Director | Canteen |
|--------|:---------:|:--:|:---------:|:--------:|:-------:|
| **Create** requisition | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Edit** after create | ✗ (locked) | ✓ | ✓ | ✓ | ✗ |
| **Add/remove items** | ✗ | ✓ | ✓ | ✓ | ✗ |
| **Add comments** | ✗ | ✓ | ✓ | ✓ | ✗ |
| **Accept** (approve) | ✗ | ✓ | ✓ | ✓ | ✗ |
| **Cancel** | ✗ | ✓ | ✓ | ✓ | ✗ |
| **View** (at stage) | Own only | PENDING_HOD | APPROVED_HOD | APPROVED_REGISTRAR | APPROVED_DIRECTOR only |
| **Mark prepared** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Hand over to peon** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Store peon info** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Generate/store billing** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Dashboard/history** | Own | Inbox + history | Inbox + history | Inbox + history | All approved + fulfillment |

---

## 3. Data Models

### 3.1 RequisitionItem (embedded)

```javascript
{
  type: String,           // "food" | "beverage"
  name: String,           // e.g. "Sandwich", "Coffee"
  quantity: Number,
  unit: String,           // e.g. "pcs", "cups", "kg"
  reasoning: String       // required for each item
}
```

### 3.2 Comment (embedded)

```javascript
{
  authorId: String,
  authorName: String,
  authorRole: String,
  content: String,
  createdAt: Date
}
```

### 3.3 ApprovalRecord (embedded, same pattern as Booking)

```javascript
{
  stepOrder: Number,
  role: String,
  label: String,
  approverId: String,
  approverName: String,
  status: String,         // "approved" | "rejected"
  remarks: String,
  timestamp: Date
}
```

### 3.4 Requisition (main document)

```javascript
{
  organizationId: ObjectId,
  requesterId: String,          // assistant
  requesterName: String,
  requesterEmail: String,
  requesterDepartment: String,
  
  items: [RequisitionItem],
  department: String,
  
  status: String,               // enum per section 1
  approvals: [ApprovalRecord],
  comments: [Comment],
  
  // Assistant: no edit after submit
  submittedAt: Date,
  
  // Canteen fulfillment (only when APPROVED_DIRECTOR → PREPARED → HANDED_OVER)
  peonName: String,
  peonPhone: String,
  handedOverAt: Date,
  
  // Billing (stored when marking prepared or handed over)
  billing: {
    totalAmount: Number,
    currency: String,
    items: [{ name: String, quantity: Number, unitPrice: Number, amount: Number }],
    generatedAt: Date
  }
}
```

---

## 4. Status Locking Rules

| Rule | Description |
|------|-------------|
| **Assistant lock** | After `submittedAt` is set, assistant cannot edit. Requisition moves to `PENDING_HOD`. |
| **Stage visibility** | HOD sees `PENDING_HOD`; Registrar sees `APPROVED_HOD`; Director sees `APPROVED_REGISTRAR`; Canteen sees `APPROVED_DIRECTOR` and fulfillment statuses. |
| **Edit scope** | Only the current approver (HOD/Registrar/Director) can edit items/comments before approve/cancel. |
| **No skip** | Approvals must follow HOD → Registrar → Director. No bypass. |

---

## 5. API Design

Base path: `/api/orgs/:orgId/requisitions`

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | assistant, hod, registrar, director, canteen_owner, org_admin, super_admin | List requisitions (filtered by role & status) |
| POST | `/` | assistant | Create requisition → PENDING_HOD |
| GET | `/:reqId` | (role-based visibility) | Get single requisition |
| PATCH | `/:reqId` | hod, registrar, director | Edit items/comments (only at current stage) |
| PATCH | `/:reqId/status` | hod, registrar, director | Approve or cancel |
| POST | `/:reqId/comments` | hod, registrar, director | Add comment |
| PATCH | `/:reqId/prepare` | canteen_owner | Mark prepared, optionally attach billing |
| PATCH | `/:reqId/handover` | canteen_owner | Hand over to peon (name, phone), finalize billing |

### 5.1 List Filtering (by role)

| Role | Visible statuses |
|------|------------------|
| assistant | Own requisitions, all statuses |
| hod | PENDING_HOD (+ own department if applicable) |
| registrar | APPROVED_HOD |
| director | APPROVED_REGISTRAR |
| canteen_owner | APPROVED_DIRECTOR, PREPARED, HANDED_OVER |
| org_admin, super_admin | All |

---

## 6. Validation Rules

- **Create**: At least one item; each item has type, name, quantity, unit, reasoning.
- **Approve**: Current status must match approver’s expected stage (e.g. HOD only approves `PENDING_HOD`).
- **Prepare**: Status must be `APPROVED_DIRECTOR`.
- **Hand over**: Status must be `PREPARED`; peonName and peonPhone required.

---

## 7. Integration with Existing Codebase

- Add `requisitionRoutes.js`, `requisitionController.js`, `requisitionService.js`, `Requisition.js` model.
- Mount at `/orgs/:orgId/requisitions` in `routes/index.js`.
- Use `authMiddleware`, `requireOrgAccess`, `requirePermission` as in booking module (see `docs/CONVENTIONS.md`).
- Use existing error handling and response format (`{ message }` for errors).

---

## 8. Dashboard / History

- **Assistant**: "My requisitions" — all own requisitions with status.
- **HOD / Registrar / Director**: "Inbox" (awaiting action) + "History" (approved/cancelled).
- **Canteen**: "Orders to fulfill" (`APPROVED_DIRECTOR`), "Prepared", "Handed over" + billing history for reports.
