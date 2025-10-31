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

## The Issue You're Seeing

Based on your API response:
- **User Balance**: 10 credits (`users.creditBalance`)
- **Org Balance**: 1000 credits (`credit_balances.balance`)
- **Status**: Out of sync ❌

**What happened**: 
- Your purchases updated the org balance to 1000
- But the user balance stayed at 10
- The UI shows **10** (the user balance) - which is correct behavior!
- But you should have **1000** credits

**The fix**: Sync the user balance to match org balance (1000)

## Summary

- **User Balance** = Your personal credits (shown in UI everywhere)
- **Org Balance** = Organization credits (legacy table, should match user balance)
- **UI always shows**: User Balance (`users.creditBalance`)
- **Problem**: Your user balance is 10, but should be 1000

Visit `/admin/sync-balance?email=techninja0210@gmail.com` to sync them!

