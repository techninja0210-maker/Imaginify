# Credit Balance Architecture Explanation

## Two Types of Balances

### 1. **User Balance** (`users.creditBalance`) - PRIMARY ✅
- **What it is**: Personal credit balance for each individual user
- **Where it's stored**: `users` table, column `creditBalance`
- **Who owns it**: Each user has their own balance
- **This is the source of truth** for spending credits

### 2. **Organization Balance** (`credit_balances.balance`) - LEGACY/MIRRORED
- **What it is**: Organization-level balance (designed for multi-member orgs)
- **Where it's stored**: `credit_balances` table, column `balance`
- **Who owns it**: Each organization has one balance
- **Current behavior**: Should mirror user balance for single-member orgs
- **Future use**: When multi-member orgs are enabled, this could be shared credits

## Current Architecture

For **single-member organizations** (current setup):
- Each user has their own `creditBalance` in the `users` table
- Each user belongs to one organization
- The `credit_balances` table should mirror the user's balance
- When credits are granted/spent, BOTH should update together

## Where User Balance is Shown in UI

✅ **Home Page** (`/`): Shows `user.creditBalance`
- Line 25: `const credits = user?.creditBalance || 0;`
- Line 105: Displays in the account panel

✅ **Profile Page** (`/profile`): Shows `user.creditBalance`
- Line 38: `<h2>{user.creditBalance || 0}</h2>`

✅ **Billing Page** (`/billing`): Shows `user.creditBalance`
- Line 116: `Credits: {user?.creditBalance || 0}`

## Common Issue: Out of Sync Balances

If you notice that your user balance and org balance are different:
- **User Balance**: Shown in UI (`users.creditBalance`)
- **Org Balance**: Stored in `credit_balances.balance`
- **Status**: Out of sync ❌

**What can happen**: 
- Purchases or credits might update the org balance
- But the user balance might not update
- The UI shows the user balance (which is correct behavior)
- But the balances should be synchronized

**The fix**: Use the admin sync endpoint to sync the user balance to match org balance:
- Visit `/admin/sync-balance` to sync balances for all users
- Or use the API endpoint: `POST /api/admin/sync-credits`

## Summary

- **User Balance** = Personal credits (shown in UI everywhere)
- **Org Balance** = Organization credits (legacy table, should match user balance)
- **UI always shows**: User Balance (`users.creditBalance`)
- **Sync**: Use admin tools to keep balances in sync when needed

