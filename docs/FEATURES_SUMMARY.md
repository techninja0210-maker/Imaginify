## 👤 USER FEATURES

### Authentication
✅ Gmail-only sign-up and sign-in via Clerk  
✅ Automatic organization creation  
✅ Session management  

### Credit System
✅ **Credit Breakdown** (`/credits`)
- Total credits display
- Separate subscription vs top-up credits
- Individual grant tracking with expiry dates

✅ **Credit Purchase**
- One-time top-up credit packs via Stripe
- 12-month expiry for top-ups
- Instant credit grant after payment

✅ **Credit Expiry**
- Subscription credits: 30-day expiry (no rollover)
- Top-up credits: 12-month expiry
- Automatic cleanup of expired credits

✅ **Credit Deduction Priority**
1. Subscription credits first (soonest expiring)
2. Top-up credits second (earliest expiring)
- Atomic transactions, no negative credits

### Subscription Management (`/billing`)
✅ View current subscription (plan, credits, renewal date)  
✅ Upgrade/downgrade plans  
✅ Cancel subscription  
✅ Legacy plan support (grandfathering)  
✅ Stripe integration for plan changes  

### Image Transformations
✅ Image Restore, Generative Fill, Object Remove, Object Recolor, Background Remove  
✅ Credit check before processing  
✅ Insufficient credits modal with "Buy Credits" button  
✅ Credit cost from Price Book  
✅ Job creation and status tracking  

### Pages
✅ Home (`/`) - Dashboard with credit balance  
✅ Credits (`/credits`) - Detailed breakdown  
✅ Billing (`/billing`) - Subscription management  
✅ Pricing (`/pricing`) - Plan display  
✅ Profile (`/profile`) - User settings and activity  

---

## 🔧 ADMIN FEATURES

### User Management (`/admin?tab=users`)
✅ View all users with search  
✅ Update user credits  
✅ Update user roles (USER, ADMIN, SUPER_ADMIN)  
✅ Activate/deactivate users  
✅ Delete users  

### Price Book (`/admin/price-book`)
✅ **Simple Structure**: `pipelineKey` → `creditCost` + `active`  
✅ Create, edit, delete entries  
✅ Jobs automatically use Price Book for credit costs  

### Subscription Plans (`/admin/subscription-plans`)
✅ CRUD operations  
✅ Plan versioning and grandfathering  
✅ Stripe integration (Price ID, Product ID)  
✅ Status flags (active, legacy, hidden, default)  
✅ Upgrade/downgrade rules  

### Top-Up Plans (`/admin/top-up-plans`)
✅ CRUD operations  
✅ Stripe integration  
✅ Purchase without subscription option  

### Credit Management (`/admin?tab=credits`)
✅ Grant credits manually  
✅ Fix missing credits  
✅ Sync credits  

### Trending Import (`/admin?tab=trending`)
✅ Upload trending data (XLSX)  
✅ Product upserting  
✅ Week stats creation  

---

## 🔌 SYSTEM INTEGRATIONS

### Stripe Webhooks
✅ `checkout.session.completed` → Top-up credit grants  
✅ `invoice.paid` → Subscription credit grants  
✅ `customer.subscription.created/updated/deleted` → Subscription sync  
✅ Webhook signature verification  
✅ Idempotency for duplicate prevention  

### API Endpoints
✅ `GET /api/me/credits-breakdown` - Credit breakdown  
✅ `POST /api/credits/deductions` - External credit deductions (HMAC)  
✅ `POST /api/jobs/callback` - Job status updates (HMAC)  
✅ Admin APIs for Price Book, Plans, Users  

### HMAC Authentication
✅ Secure external service callbacks  
✅ Signature verification  

---

## 🎯 KEY ARCHITECTURE

### Credit System
- **CreditGrant**: Tracks individual grants with expiry (SUBSCRIPTION/TOPUP)
- **CreditLedger**: Complete audit trail
- **Deduction Priority**: Subscription → Top-up (earliest expiring first)
- **Atomic Transactions**: All credit operations are transaction-safe

### Price Book
- **Simple Lookup**: `pipelineKey` → `creditCost`
- **Integration**: Jobs automatically use Price Book
- **Fallback**: Defaults to 1 credit if entry not found

### Subscription System
- **Database-Driven**: Plans managed in database, not hardcoded
- **Grandfathering**: Legacy plan support with versioning
- **Stripe Sync**: Webhooks keep subscriptions in sync

---

## 📊 Database Models

✅ **User** - Accounts, roles, credit balance  
✅ **Organization** - One per user  
✅ **CreditGrant** - Individual grants with expiry  
✅ **CreditLedger** - Transaction audit trail  
✅ **UserSubscription** - Active subscriptions  
✅ **TopUpPurchase** - Top-up records  
✅ **SubscriptionPlan** - Plan definitions with versioning  
✅ **TopUpPlan** - Top-up plan definitions  
✅ **PriceBookEntry** - Pipeline → credit cost mapping  
✅ **Job** - Processing jobs  
✅ **TrendingProduct, AmazonProduct, ProductWeekStat** - Trending data  
