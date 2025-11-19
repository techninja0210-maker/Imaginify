# Credit System Implementation Analysis

## Executive Summary

**Current Status**: The project has a **basic credit system** but is **missing most of the required features** for subscription/top-up differentiation, expiry tracking, and plan versioning. The system currently treats all credits as a single pool without expiry or type differentiation.

---

## 1. Core Rules Analysis

### ❌ **NOT IMPLEMENTED**

#### 1.1 Subscription Credits (30-day cycle, no rollover)
- **Current**: Credits are stored as a single integer (`User.creditBalance`)
- **Missing**: 
  - No expiry tracking for subscription credits
  - No 30-day cycle enforcement
  - No automatic expiration on renewal
  - No differentiation between subscription and top-up credits

#### 1.2 Top-Up Credits (12-month validity, stackable)
- **Current**: All credits are treated the same
- **Missing**:
  - No expiry date tracking per top-up purchase
  - No 12-month validity enforcement
  - No ability to stack multiple top-ups with individual expiry dates

#### 1.3 Order of Usage (Subscription first, then top-ups)
- **Current**: `deductCredits()` simply decrements `creditBalance` without any ordering logic
- **Missing**:
  - No logic to prioritize subscription credits
  - No logic to use earliest-expiring top-ups first
  - No tracking of which credit type was used

#### 1.4 Grandfathering Plans
- **Current**: `User.planId` is a simple integer reference
- **Missing**:
  - No plan versioning system
  - No legacy plan tracking
  - No differentiation between plan versions

---

## 2. Price Book Changes Analysis

### ❌ **NOT IMPLEMENTED**

The current `PriceBookEntry` model is designed for **pricing actions** (e.g., "text_to_video costs 2 credits per second"), NOT for subscription plans or top-up credit packs.

**Current PriceBookEntry Schema:**
```prisma
model PriceBookEntry {
  id                  String
  organizationId      String
  actionKey           String      // e.g., "text_to_video"
  unitType            String      // e.g., "seconds"
  unitStep            Int
  retailCostPerUnit   Int
  internalCostFormula  String
  isActive            Boolean
}
```

**Required Changes:**
- Need a new model for subscription plans and top-up packs
- Need fields for:
  - Plan Type (Subscription vs Top-Up)
  - Internal Plan ID / Code
  - Public Name
  - Price (USD)
  - Credits Granted
  - Credit Expiry (Days)
  - Credit Type (subscription/topup)
  - Status Flags (Active for new signups, Legacy only, Hidden)
  - Plan Family / Group (for versioning)
  - Default for Public Signup
  - Upgrade/Downgrade Allowed To
  - Can Be Purchased Without Subscription

---

## 3. Database Schema Gaps

### Missing Models/Tables:

1. **Credit Buckets/Expiry Tracking**
   - Need a table to track individual credit grants with expiry dates
   - Example: `CreditGrant` with fields: `userId`, `type` (subscription/topup), `amount`, `grantedAt`, `expiresAt`, `usedAmount`, `planId`

2. **Subscription Plans**
   - Need a `SubscriptionPlan` model with versioning support
   - Fields: `planFamily`, `version`, `internalId`, `publicName`, `price`, `creditsPerCycle`, `creditExpiryDays`, `isActiveForNewSignups`, `isLegacyOnly`, `isHidden`, `defaultForPublicSignup`

3. **User Subscriptions**
   - Need a `UserSubscription` model to track active subscriptions
   - Fields: `userId`, `planId`, `stripeSubscriptionId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`

4. **Top-Up Purchases**
   - Need a `TopUpPurchase` model to track individual top-up purchases
   - Fields: `userId`, `planId`, `amount`, `purchasedAt`, `expiresAt`, `usedAmount`

---

## 4. Credit Deduction Logic Analysis

### Current Implementation (`lib/actions/user.actions.ts` - `deductCredits`):

```typescript
// Current: Simple decrement
if (freshUser.creditBalance < amount) {
  throw new Error(`Insufficient credits`);
}
const newBalance = freshUser.creditBalance - amount;
await tx.user.updateMany({
  where: { clerkId: userId, creditBalanceVersion: currentVersion },
  data: {
    creditBalance: { decrement: amount },
    creditBalanceVersion: { increment: 1 }
  }
});
```

### ❌ **Missing Required Logic:**

1. **No credit type differentiation** - All credits are treated the same
2. **No expiry checking** - Expired credits are not filtered out
3. **No ordering logic** - Should use subscription credits first, then top-ups (earliest expiring first)
4. **No tracking of which credits were used** - Ledger doesn't record credit type or expiry info

### Required Implementation:

```typescript
// Pseudo-code for required logic:
1. Get all active credit grants (not expired, not fully used)
2. Sort by priority:
   - Subscription credits first (by expiry date, soonest first)
   - Then top-up credits (by expiry date, soonest first)
3. Deduct from grants in order until amount is satisfied
4. Update grant.usedAmount for each grant
5. Update user.creditBalance (for display purposes)
6. Record in ledger which grants were used
```

---

## 5. Subscription & Credits UX Testing

### 3.1 Authentication / Basic UX
✅ **IMPLEMENTED**
- Sign up, email confirmation, login/logout work
- Credit balance is displayed on home page, profile, billing pages

### 3.2 New Subscription Purchase
⚠️ **PARTIALLY IMPLEMENTED**
- Stripe checkout works (`app/api/stripe/confirm/route.ts`)
- Credits are granted on payment (`updateCredits()`)
- ❌ **Missing**:
  - Credits are NOT tagged as subscription credits
  - No 30-day expiry tracking
  - No renewal date display
  - No breakdown of subscription vs top-up credits

### 3.3 Top-Up Credits Purchase
⚠️ **PARTIALLY IMPLEMENTED**
- Top-up purchases work via Stripe webhook
- Credits are granted
- ❌ **Missing**:
  - Credits are NOT tagged as top-up credits
  - No 12-month expiry tracking
  - No individual top-up purchase tracking

### 3.4 Running Pipelines (Credit Deduction)
❌ **NOT IMPLEMENTED AS REQUIRED**
- Deduction API exists (`/api/credits/deductions`)
- ❌ **Missing**:
  - No subscription-first logic
  - No top-up expiry checking
  - No earliest-expiring-first logic
  - No credit type tracking in deductions

### 3.5 Upgrading / Downgrading Plans
❌ **NOT IMPLEMENTED**
- No upgrade/downgrade logic
- No proration handling
- No plan switching UI

### 3.6 Cancel Subscription
❌ **NOT IMPLEMENTED**
- No cancellation logic
- No handling of remaining subscription credits
- No UI for cancellation

### 3.7 Re-Subscribe / Plan Change After Grandfathering
❌ **NOT IMPLEMENTED**
- No plan versioning system
- No legacy plan tracking
- No logic to assign new plans vs legacy plans

---

## 6. Admin UX / Price Book Testing

### Current Price Book:
- ✅ Can create/edit/delete pricing entries for actions (e.g., "text_to_video")
- ❌ **NOT designed for subscription plans or top-up packs**

### Required Features:
- ❌ No subscription plan management
- ❌ No top-up pack management
- ❌ No plan versioning UI
- ❌ No legacy plan flagging
- ❌ No "Active for new signups" toggle
- ❌ No plan family grouping

---

## 7. Implementation Priority

### **CRITICAL (Must Have):**
1. **Credit Expiry Tracking System**
   - Create `CreditGrant` model
   - Track expiry dates per grant
   - Filter expired credits in balance calculations

2. **Credit Type Differentiation**
   - Add `type` field (subscription/topup) to credit grants
   - Update deduction logic to prioritize subscription credits

3. **Subscription Plan Model**
   - Create `SubscriptionPlan` model with versioning
   - Support plan families and legacy flags

4. **Order of Usage Logic**
   - Implement subscription-first deduction
   - Implement earliest-expiring-first for top-ups

### **HIGH PRIORITY:**
5. **Top-Up Purchase Tracking**
   - Create `TopUpPurchase` model
   - Track 12-month expiry per purchase

6. **Subscription Management**
   - Create `UserSubscription` model
   - Handle renewals and cancellations

7. **UI Updates**
   - Show credit breakdown (subscription vs top-up)
   - Display expiry dates
   - Show renewal dates

### **MEDIUM PRIORITY:**
8. **Plan Versioning UI**
   - Admin interface for plan management
   - Legacy plan flagging
   - Plan family grouping

9. **Upgrade/Downgrade Logic**
   - Plan switching
   - Proration handling

---

## 8. Estimated Implementation Effort

- **Database Schema Changes**: 2-3 days
- **Credit Expiry System**: 3-4 days
- **Credit Type & Ordering Logic**: 2-3 days
- **Subscription Plan Model & Management**: 3-4 days
- **UI Updates**: 2-3 days
- **Testing & QA**: 2-3 days

**Total**: ~14-20 days of development work

---

## 9. Recommendations

1. **Start with Credit Expiry Tracking** - This is the foundation for everything else
2. **Implement Credit Type Differentiation** - Required for proper deduction ordering
3. **Build Subscription Plan Model** - Needed for plan versioning and grandfathering
4. **Update Deduction Logic** - Critical for correct credit usage
5. **Add UI for Credit Breakdown** - Important for user transparency

---

## 10. Conclusion

The current implementation is a **basic credit system** that works for simple credit grants and deductions, but it **does not meet the requirements** for:
- Subscription vs top-up differentiation
- Credit expiry tracking
- Order of usage (subscription first, then top-ups)
- Plan versioning and grandfathering
- Proper expiry enforcement

**A significant refactoring is required** to implement all the required features. The good news is that the existing credit deduction API and ledger system can be extended to support these features with the proper database schema changes.

