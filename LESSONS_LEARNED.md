# Lessons Learned — Kwality Walls Gift Selection Microsite

A living document capturing mistakes, gotchas, and decisions made during the build.
Reference this before making any architectural or configuration change.

---

## 1. Prisma + Turbopack Cache Staleness (Critical)

**Mistake:** After running `prisma generate`, the dev server continued serving the old compiled Prisma client from `.next/dev/server/chunks/`. This caused a runtime `PrismaClientValidationError` for fields that were correctly defined in the schema — but the stale bundle didn't know about them.

**Symptom:** `POST /api/submit` returned 500 with `Unknown field 'giftSelectedAt' for select statement on model 'Draft'` — even though the field existed in `schema.prisma` and TypeScript was clean.

**Rule:** After ANY `prisma generate` or schema change, always:
```powershell
# Windows
Remove-Item -Recurse -Force ".next"
# Then restart the dev server
& "C:\Program Files\nodejs\npm.cmd" run dev
```
Never just restart the dev server without clearing `.next` after a schema change.

---

## 2. ts-node Incompatibility with `moduleResolution: "bundler"`

**Mistake:** Tried to run a Prisma seed/admin-creation script using `ts-node`. Failed with `Cannot find module` errors because `tsconfig.json` uses `moduleResolution: "bundler"` — which is incompatible with ts-node's module resolution.

**Rule:** Never use `ts-node` for standalone scripts in this project. Instead:
- Use a `.cjs` (CommonJS) script with direct `better-sqlite3` access for one-off DB operations
- Or use `tsx` if a TypeScript runner is needed
- Example that worked: `prisma/add-gifsy-admin.cjs` with `require('better-sqlite3')`

---

## 3. Campaign Status Check Hack (Now Fixed)

**Mistake:** The retailer login page checked campaign status by POSTing to `/api/auth/request-otp` with `mobile: '0000000000'`. This was a hack — it abused the OTP endpoint to get campaign status, caused misleading 404 logs, and was confusing.

**Rule:** Always use the dedicated `GET /api/campaign/status` endpoint for campaign status checks. Never repurpose an endpoint for a different concern.

---

## 4. React Compiler Lint Patterns

Three patterns flagged by `eslint-plugin-react-compiler` that must be avoided:

### 4a. Components Defined Inside Components
```tsx
// ❌ Wrong — SidebarBrand resets state on every render
export default function AdminLayout() {
  const SidebarBrand = () => <div>...</div>; // defined inside
}

// ✅ Correct — defined at module level, accepts props
function SidebarBrand({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return <div>...</div>;
}
export default function AdminLayout() { ... }
```

**Files fixed:** `admin/layout.tsx` (SidebarBrand), `(retailer)/review/page.tsx` (Field)

### 4b. useCallback + useEffect Pattern
```tsx
// ❌ Flagged as "setState synchronously in effect"
const loadData = useCallback(async () => {
  const data = await fetch(...);
  setState(data); // React Compiler flags this
}, [router]);
useEffect(() => { loadData(); }, [loadData]);

// ✅ Correct — inline async IIFE with cancellation flag
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await fetch(...);
    if (!cancelled) setState(data);
  })();
  return () => { cancelled = true; };
}, [router]);
```
**Exception:** If the function is also called from event handlers (e.g. a refresh button), keep the function but add `// eslint-disable-next-line react-hooks/set-state-in-effect`.

### 4c. Date.now() in JSX / render
```tsx
// ❌ Flagged as impure function call in render
<span>{Date.now() - lastActivity < 3600000 ? 'recent' : 'old'}</span>

// ✅ Correct — capture at map/render scope
const now = Date.now();
<span>{now - lastActivity < 3600000 ? 'recent' : 'old'}</span>
// Or add /* eslint-disable react-hooks/purity */ at file top
```

---

## 5. Windows-Specific npm/npx Commands

**Mistake:** Using `node node_modules\.bin\next` or bare `npx` fails on Windows because `.bin\next` is a bash script.

**Rule:** Always use full paths on Windows:
```powershell
# npm
& "C:\Program Files\nodejs\npm.cmd" run dev

# npx
& "C:\Program Files\nodejs\npx.cmd" prisma generate

# next directly
& "C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next dev -p 3001
```

---

## 6. SQLite Adapter vs Standard Prisma

**Current setup (dev only):** Uses `@prisma/adapter-better-sqlite3` — a non-standard adapter that requires explicit instantiation:
```typescript
import { PrismaClient } from '@/generated/prisma';
import { PrismaLibSQL } from '@prisma/adapter-libsql'; // or better-sqlite3
```

**Production setup:** Standard Prisma with PostgreSQL — no adapter needed. The `src/lib/prisma.ts` file changes completely between dev and production.

**Rule:** Never copy the dev Prisma client setup into production code. They are fundamentally different.

---

## 7. Database Path for One-Off Scripts

**Mistake:** A `.cjs` script assumed the database was at `./prisma/dev.db`. Actual location is `./dev.db` (project root).

**Rule:** The SQLite database file is always at the **project root** (`dev.db`), not inside the `prisma/` folder. In scripts:
```javascript
const dbPath = path.resolve(__dirname, '../dev.db'); // if script is in prisma/
const dbPath = path.resolve(__dirname, 'dev.db');    // if script is at root
```

---

## 8. Superadmin vs Admin Access Control

**Architecture decision:** Two admin tiers:
- `admin@kwalitywalls.com` — read-only access (Kwality client)
- `admin@gifsy.in` — superadmin, full edit/delete access

**Enforcement is dual-layer:**
1. **API layer:** `requireSuperAdmin(payload)` throws 403 in PUT/DELETE handlers
2. **UI layer:** Edit/delete buttons hidden via `isSuperAdmin` state (fetched from `/api/admin/me`)

**Rule:** Never enforce access control only on the frontend. API must always validate independently.

---

## 9. The 24-Hour Gift Change Window

**Logic:** The 24h clock starts when the retailer clicks "Confirm My Gift Selection" (`giftConfirmedAt` on the Draft model), NOT when they submit the form.

**Field flow:**
- `Draft.giftSelectedAt` — set when retailer clicks confirm
- `Draft.giftConfirmed` — boolean, set to true on confirm
- `Submission.giftConfirmedAt` — copied from `Draft.giftSelectedAt` at submit time

**Rule:** Never start the 24h clock from `submittedAt`. Always use `giftConfirmedAt` (fall back to `submittedAt` for older records that predate this field).

---

## 10. Git — Never Push Directly to `main` or `staging`

**Rule (from Firebase migration onwards):**
- All work starts on a `feature/*` or `fix/*` branch
- Feature branch → PR to `staging` → tests pass → merge
- Staging → PR to `main` → tests pass → merge
- Direct pushes to `main` or `staging` are blocked via branch protection

---

## Environment Reference

| Environment | Branch | URL | Database |
|---|---|---|---|
| Local dev | any | `localhost:3001` | SQLite (`dev.db`) |
| Staging | `staging` | Firebase staging | Cloud SQL (staging) |
| Production | `main` | Firebase production | Cloud SQL (production) |

## Firebase Project IDs

| Environment | Project ID |
|---|---|
| Staging | `kwality-gift---staging` |
| Production | `kwality-gift---production` |

## GitHub Repository

`NikunjSadani/Gift-Selection` — default branch: `main`
