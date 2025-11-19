# Credit System Implementation Status

## ✅ Completed (Steps 1-5)

### 1. Database Schema ✅
- ✅ Added `CreditGrant` model for tracking individual credit grants with expiry
- ✅ Added `SubscriptionPlan` model with versioning support
- ✅ Added `TopUpPlan` model for one-time credit packs
- ✅ Added `UserSubscription` model for tracking active subscriptions
- ✅ Added `TopUpPurchase` model for tracking top-up purchases
- ✅ Added enums: `CreditType` (SUBSCRIPTION, TOPUP), `SubscriptionStatus`

### 2. Credit Expiry Tracking System ✅
- ✅ Created `lib/services/credit-grants.ts` with:
  - `getActiveCreditGrants()` - Get all active grants sorted by priority
  - `deductCreditsFromGrants()` - Deduct credits following priority order
  - `createCreditGrant()` - Create new credit grants
  - `getUserEffectiveBalance()` - Get real balance from grants
  - `cleanupExpiredGrants()` - Clean up expired grants

### 3. Credit Deduction Logic ✅
- ✅ Updated `deductCredits()` in `lib/actions/user.actions.ts` to:
  - Use credit grants system instead of simple balance check
  - Prioritize subscription credits first
  - Then use top-up credits (earliest expiring first)
  - Track which grants were used in ledger metadata

### 4. Credit Grant Functions ✅
- ✅ Created `lib/actions/credit-grant-with-expiry.ts`:
  - `grantCreditsWithExpiry()` - Grants credits with expiry tracking
  - Creates `CreditGrant` records
  - Links to subscriptions or top-up purchases
  - Updates user balance and ledger

### 5. Stripe Webhooks ✅
- ✅ Updated `app/api/webhooks/stripe/route.ts`:
  - Top-up purchases: Creates `TopUpPurchase` and grants credits with 365-day expiry
  - Subscription renewals: Creates/updates `UserSubscription` and grants credits with 30-day expiry
  - Auto-creates plans from Stripe metadata
  - Falls back to old method if price ID not found

### 6. Helper Services ✅
- ✅ Created `lib/services/stripe-plans.ts`:
  - `findOrCreateSubscriptionPlan()` - Find or create subscription plan from Stripe
  - `findOrCreateTopUpPlan()` - Find or create top-up plan from Stripe
- ✅ Created `lib/services/user-balance-sync.ts`:
  - `syncUserBalance()` - Sync user balance with grants
  - `syncAllUserBalances()` - Sync all users (for cron)

---

## 🚧 In Progress / Pending

### 7. Subscription Plan Management API
- ⏳ Create API endpoints for:
  - GET `/api/admin/subscription-plans` - List all plans
  - POST `/api/admin/subscription-plans` - Create new plan
  - PATCH `/api/admin/subscription-plans/[id]` - Update plan
  - DELETE `/api/admin/subscription-plans/[id]` - Delete plan
  - Similar endpoints for top-up plans

### 8. Price Book UI Updates
- ⏳ Update `components/admin/PriceBookEntryForm.tsx` to support:
  - Plan Type selector (Subscription vs Top-Up)
  - Plan versioning fields
  - Legacy plan flags
  - Credit expiry days
  - Plan family/group

### 9. User-Facing UI Updates
- ⏳ Update credit display to show:
  - Breakdown: Subscription credits vs Top-up credits
  - Expiry dates for each grant
  - Renewal date for subscriptions
  - Next expiry warnings

### 10. Subscription Management UI
- ⏳ Add UI for:
  - Viewing current subscription
  - Upgrading/downgrading plans
  - Canceling subscription
  - Viewing subscription history

### 11. Migration & Data Backfill
- ⏳ Create migration script to:
  - Convert existing user balances to CreditGrant records
  - Set default expiry dates (30 days for existing credits)
  - Create initial subscription/top-up plans

---

## 📋 Next Steps

1. **Create Subscription Plan Management API** (Step 7)
2. **Update Price Book UI** (Step 8)
3. **Update User-Facing UI** (Step 9)
4. **Add Subscription Management UI** (Step 10)
5. **Create Migration Script** (Step 11)
6. **Test End-to-End** (Step 12)

---

## 🔧 Technical Notes

### Database Migration Required
Run `npx prisma db push` or create a migration to apply the new schema.

### Backward Compatibility
- Old `updateCredits()` function still works (doesn't create grants)
- New grants system works alongside old system
- User balance is synced with grants for display

### Stripe Metadata Requirements
For the new system to work fully, Stripe prices should have metadata:
- `credits` - Number of credits
- `planFamily` - Plan family name (for subscriptions)
- `version` - Plan version number
- `internalId` - Internal plan identifier
- `publicName` - Display name

---

## ⚠️ Known Issues / TODOs

1. **Stripe Session Line Items**: May need to expand line_items when retrieving sessions
2. **Balance Sync**: Should run periodically to keep user.creditBalance in sync
3. **Expired Grants Cleanup**: Should run as a cron job
4. **Plan Migration**: Existing plans in Stripe need metadata added
5. **UI Polish**: Credit breakdown display needs design work

