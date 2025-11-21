# Credit System Testing Guide

This guide helps you systematically test all credit system functionality to ensure everything works as expected.

## Prerequisites

1. **Database Setup**
   ```bash
   npx prisma db push
   npm run migrate:plans
   ```

2. **Environment Variables**
   - Ensure Stripe keys are configured
   - Ensure database URL is set

3. **Test Accounts**
   - Create at least 2 test accounts (one for regular testing, one for admin testing)

---

## 1. Authentication & Basic UX

### Test Steps:
1. **Sign Up**
   - [ ] Go to `/sign-up`
   - [ ] Create a new account
   - [ ] Verify email confirmation (if enabled)
   - [ ] Log in successfully

2. **Credit Balance Display**
   - [ ] After login, check home page (`/`)
   - [ ] Verify "Total Credits" is displayed
   - [ ] Click "View breakdown →" link
   - [ ] Verify it goes to `/credits` page
   - [ ] Check that credit breakdown shows (may be empty initially)

3. **Logout/Login**
   - [ ] Log out
   - [ ] Log back in
   - [ ] Verify credit balance persists correctly
   - [ ] Check that renewal date is visible (if you have a subscription)

**Expected Results:**
- Account creation works
- Credit balance displays correctly
- Navigation works smoothly

---

## 2. New Subscription Purchase

### Test Steps:
1. **Choose a Plan**
   - [ ] Go to `/pricing` or `/billing`
   - [ ] Select "Starter Plan" (or any subscription plan)
   - [ ] Click subscribe button

2. **Complete Stripe Checkout**
   - [ ] Complete payment in Stripe test mode
   - [ ] Use test card: `4242 4242 4242 4242`
   - [ ] Complete checkout

3. **Verify After Payment**
   - [ ] Check `/credits` page
   - [ ] Verify credits were added (should match plan's `creditsPerCycle`)
   - [ ] Check credit breakdown:
     - [ ] Total credits shows correct amount
     - [ ] Subscription credits section shows the grant
     - [ ] Expiry date is ~30 days from now
   - [ ] Check `/billing` page:
     - [ ] Current plan shows correctly
     - [ ] Renewal date is visible
     - [ ] Credits per cycle matches plan

**Expected Results:**
- Credits granted immediately after payment
- Credits tagged as `SUBSCRIPTION` type
- Expiry date is 30 days from purchase
- UI shows breakdown correctly

---

## 3. Top-Up Credits Purchase

### Test Steps:
1. **Buy Top-Up**
   - [ ] Go to `/credits` page
   - [ ] Select a top-up pack (e.g., "1,000 Credit Boost")
   - [ ] Complete Stripe checkout

2. **Verify After Payment**
   - [ ] Check credit breakdown:
     - [ ] New total credits includes top-up
     - [ ] Top-up credits section shows the grant
     - [ ] Expiry date is ~365 days from purchase
   - [ ] Verify subscription credits are still separate

**Expected Results:**
- Top-up credits added as separate grant
- Expiry is 12 months (365 days)
- Multiple top-ups can stack with individual expiry dates

---

## 4. Credit Deduction (Pipeline Testing)

### Test Setup:
You need to have credits available. Make sure you have:
- Some subscription credits
- Some top-up credits (optional, for mixed testing)

### Test Case 1: Only Subscription Credits
1. **Setup**
   - [ ] Ensure you have only subscription credits (no top-ups)
   - [ ] Note the amount and expiry dates

2. **Run Action**
   - [ ] Use a pipeline/action that deducts credits (e.g., image transformation)
   - [ ] Deduct a small amount (e.g., 10 credits)

3. **Verify**
   - [ ] Check credit breakdown
   - [ ] Subscription credits decreased
   - [ ] Used amount increased on the grant
   - [ ] Expiry date unchanged

### Test Case 2: Only Top-Up Credits
1. **Setup**
   - [ ] Cancel subscription (or wait for it to expire)
   - [ ] Purchase a top-up pack
   - [ ] Note the expiry date

2. **Run Action**
   - [ ] Deduct credits (e.g., 50 credits)

3. **Verify**
   - [ ] Top-up credits decreased
   - [ ] Deduction came from earliest-expiring top-up first
   - [ ] Expiry dates unchanged

### Test Case 3: Both Subscription and Top-Up Credits
1. **Setup**
   - [ ] Have active subscription credits
   - [ ] Have at least one top-up grant
   - [ ] Note amounts of each

2. **Run Action**
   - [ ] Deduct credits that exceed subscription credits
   - [ ] (e.g., if you have 100 sub credits, deduct 150)

3. **Verify**
   - [ ] Subscription credits used first (should be 0 or fully used)
   - [ ] Then top-up credits used
   - [ ] Top-up used from earliest expiring first
   - [ ] Total deduction matches amount

### Test Case 4: Insufficient Credits
1. **Setup**
   - [ ] Ensure total credits < amount needed for action

2. **Run Action**
   - [ ] Try to run action requiring more credits than available

3. **Verify**
   - [ ] Action should NOT run
   - [ ] Clear error message shown
   - [ ] Call to action to top up or upgrade displayed
   - [ ] No negative credits possible

**Expected Results:**
- Subscription credits always used first
- Top-ups used in expiry order (earliest first)
- No negative credits possible
- Clear error messages when insufficient

---

## 5. Upgrading/Downgrading Plans

### Test Case 1: Upgrade
1. **Setup**
   - [ ] Have active subscription on Starter Plan
   - [ ] Note current credits and expiry

2. **Upgrade**
   - [ ] Go to `/billing`
   - [ ] Click "Upgrade" on Pro Plan
   - [ ] Confirm in Stripe

3. **Verify**
   - [ ] Stripe subscription updated
   - [ ] Database `UserSubscription` updated with new plan
   - [ ] Existing subscription credits remain usable
   - [ ] Existing top-up credits untouched
   - [ ] Next renewal will use new plan's `creditsPerCycle`
   - [ ] UI shows new plan name

### Test Case 2: Downgrade
1. **Setup**
   - [ ] Have active subscription on Pro Plan

2. **Downgrade**
   - [ ] Go to `/billing`
   - [ ] Click "Downgrade" on Starter Plan
   - [ ] Confirm in Stripe

3. **Verify**
   - [ ] Stripe subscription updated
   - [ ] Database updated
   - [ ] Existing credits remain usable
   - [ ] Next renewal uses lower plan's credits

**Expected Results:**
- Plan changes work smoothly
- Existing credits preserved
- Future renewals use new plan amounts
- UI reflects changes immediately

---

## 6. Cancel Subscription

### Test Steps:
1. **Cancel**
   - [ ] Go to `/billing`
   - [ ] Click "Manage Subscription"
   - [ ] Cancel subscription in Stripe portal
   - [ ] Set to cancel at period end

2. **Verify Immediately**
   - [ ] Check `/billing` page
   - [ ] Should show warning: "Subscription will cancel on [date]"
   - [ ] Subscription credits still usable
   - [ ] Top-up credits still valid

3. **After Period End**
   - [ ] Wait for period to end (or manually trigger in Stripe test mode)
   - [ ] Verify:
     - [ ] No new subscription credits added
     - [ ] Existing subscription credits remain until expiry
     - [ ] Top-up credits still valid with original expiry
     - [ ] UI shows "No active subscription"

**Expected Results:**
- Cancellation warning visible
- Credits remain usable until period end
- No new credits after cancellation
- Top-ups unaffected

---

## 7. Grandfathering / Plan Versioning

### Test Scenario: Legacy Plan Migration

1. **Create Legacy Plan (v1)**
   - [ ] As admin, go to `/admin/subscription-plans`
   - [ ] Create plan: "Starter Plan v1" - $5/month, 5,000 credits
   - [ ] Mark as "Active for new signups"
   - [ ] Note the `internalId` (e.g., `sub_starter_v1`)

2. **User Signs Up on v1**
   - [ ] Create new test account
   - [ ] Subscribe to v1 plan
   - [ ] Verify they get v1 pricing and credits

3. **Create New Plan Version (v2)**
   - [ ] As admin, create "Starter Plan v2" - $9/month, 7,000 credits
   - [ ] Same `planFamily` as v1
   - [ ] Mark v2 as "Active for new signups"
   - [ ] Mark v1 as "Legacy only" (not deleted)

4. **Verify New Signups**
   - [ ] Create another new test account
   - [ ] Check pricing page
   - [ ] Verify only v2 is shown (v1 is hidden)
   - [ ] Subscribe to v2
   - [ ] Verify they get v2 pricing and credits

5. **Verify Legacy User**
   - [ ] Log in as v1 user
   - [ ] Check `/billing`
   - [ ] Verify they still see v1 plan
   - [ ] Verify they still get v1 pricing on renewal
   - [ ] Plan should be labeled as "Legacy" or similar

6. **Legacy User Re-Subscribes**
   - [ ] Cancel v1 user's subscription
   - [ ] Wait for period to end
   - [ ] Re-subscribe
   - [ ] Verify they get v2 (not v1, since v1 is legacy-only)

7. **Legacy User Upgrades**
   - [ ] As v1 user, upgrade to a different plan family (e.g., Pro)
   - [ ] Verify they leave v1 and adopt new plan
   - [ ] Verify future renewals use new plan

**Expected Results:**
- Legacy users stay on old plan
- New signups only see active plans
- Re-subscribing moves to new plan
- Upgrading moves off legacy plan

---

## 8. Admin UX / Price Book Testing

### Test Steps:

1. **Create Plan Version**
   - [ ] Go to `/admin/subscription-plans`
   - [ ] Click "New Plan"
   - [ ] Create v2 of existing plan:
     - [ ] Same `planFamily` as v1
     - [ ] Different price and credits
     - [ ] Mark as "Active for new signups"
   - [ ] Mark v1 as "Legacy only"

2. **Verify Pricing Tables**
   - [ ] Check `/pricing` page (as non-logged-in user)
   - [ ] Verify only active plans shown (v2, not v1)
   - [ ] Verify legacy plans hidden

3. **Edit Live Plan**
   - [ ] Try to edit a plan with active subscribers
   - [ ] Change `creditsPerCycle` or `priceUsd`
   - [ ] Verify:
     - [ ] Warning message appears
     - [ ] Form allows edit but warns about impact
     - [ ] Or form blocks critical changes (if implemented)

4. **Plan Management**
   - [ ] Verify you can't delete plans with active subscribers
   - [ ] Verify you can mark plans as hidden
   - [ ] Verify upgrade/downgrade allowed lists work

**Expected Results:**
- Plan versioning works correctly
- Active plans shown to new users
- Legacy plans hidden from new signups
- Warnings when editing live plans
- Can't delete plans with subscribers

---

## 9. Credit Expiry Testing

### Test Steps:

1. **Manual Expiry Test**
   - [ ] Create a credit grant with expiry in the past (via database or API)
   - [ ] Run cleanup: `GET /api/cron/cleanup-expired-credits`
   - [ ] Verify expired grant marked as fully used
   - [ ] Verify it no longer appears in active grants

2. **Expiry Display**
   - [ ] Check credit breakdown
   - [ ] Verify expiry dates shown correctly
   - [ ] Verify "Expiring soon" warnings (if implemented)

**Expected Results:**
- Expired credits cleaned up
- Expiry dates visible in UI
- Warnings for expiring credits

---

## 10. Edge Cases

### Test These Scenarios:

1. **Multiple Top-Ups**
   - [ ] Purchase 2-3 different top-up packs
   - [ ] Verify each has own expiry
   - [ ] Verify deduction uses earliest expiring first

2. **Subscription Renewal**
   - [ ] Wait for subscription to renew (or trigger in Stripe)
   - [ ] Verify new credits granted
   - [ ] Verify old subscription credits can expire (if not used)

3. **Plan Change Mid-Cycle**
   - [ ] Upgrade/downgrade mid-cycle
   - [ ] Verify proration handled correctly
   - [ ] Verify credits behavior is predictable

4. **Concurrent Deductions**
   - [ ] Try to deduct credits from multiple actions simultaneously
   - [ ] Verify no race conditions
   - [ ] Verify correct total deduction

---

## Troubleshooting

### Common Issues:

1. **Credits Not Showing**
   - Check database: `CreditGrant` table
   - Check webhook logs
   - Verify Stripe webhook is configured

2. **Plan Not Updating**
   - Check `UserSubscription` table
   - Verify webhook received `customer.subscription.updated`
   - Check Stripe dashboard

3. **Deduction Not Working**
   - Check `deductCredits` function logs
   - Verify credit grants exist
   - Check for errors in console

---

## Test Checklist Summary

- [ ] Authentication & Basic UX
- [ ] Subscription Purchase
- [ ] Top-Up Purchase
- [ ] Credit Deduction (all scenarios)
- [ ] Upgrade/Downgrade
- [ ] Cancel Subscription
- [ ] Grandfathering/Versioning
- [ ] Admin Plan Management
- [ ] Credit Expiry
- [ ] Edge Cases

---

## Notes

- Use Stripe test mode for all payments
- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (declined)
- Keep test data separate from production
- Document any bugs or edge cases found


