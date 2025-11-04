# ShoppableVideos - AI Video Processing SaaS Platform

<div align="center">
  <br />
  <h3 align="center">AI-Powered Video Processing Platform</h3>
  <p align="center">
    A complete SaaS platform for video processing with credit-based billing, subscription management, and affiliate tracking.
  </p>
</div>

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [Quick Start](#quick-start)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [API Documentation](#api-documentation)
8. [Deployment](#deployment)
9. [Project Structure](#project-structure)

## 🤖 Introduction

ShoppableVideos is a production-ready SaaS platform for AI-powered video processing. The platform features:

- **Credit-based billing system** with subscription plans and one-time top-ups
- **Auto top-up** functionality for seamless credit management
- **Admin console** for user and pricing management
- **Affiliate program** integration with Rewardful
- **Stripe integration** for secure payments
- **HMAC authentication** for external service integrations
- **Job-based workflow** system for video processing

## ⚙️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk (Gmail-only)
- **Payments**: Stripe
- **Affiliate**: Rewardful
- **Styling**: Tailwind CSS + shadcn/ui
- **Hosting**: Vercel (recommended)

## 🔋 Features

### Core Features
- ✅ **Gmail-only Authentication** via Clerk
- ✅ **Subscription Plans** (Starter, Pro, Business)
- ✅ **One-time Credit Purchases**
- ✅ **Auto Top-up** with configurable thresholds
- ✅ **Credit Ledger** with full audit trail
- ✅ **Job Processing** with quote-based workflow
- ✅ **Invoice Management** with download/view
- ✅ **Subscription Upgrade/Downgrade** UI
- ✅ **Admin Console** for user management
- ✅ **Price Book** management per organization
- ✅ **Affiliate Tracking** via Rewardful
- ✅ **HMAC Authentication** for external services

### API Endpoints
- `POST /api/quote` - Create job quote
- `GET /api/quote/estimate` - Estimate credits without creating quote
- `POST /api/jobs` - Create job from quote
- `POST /api/jobs/callback` - External service callback (HMAC-protected)
- `POST /api/jobs/:id/refund` - Refund job credits (admin)
- `GET /api/me/balance` - Get user credit balance
- `GET /api/me/ledger` - Get credit transaction history

## 🤸 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon or Supabase recommended)
- Clerk account for authentication
- Stripe account for payments
- Rewardful account for affiliates (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Imaginify
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory with all required variables (see [Environment Variables](#environment-variables) section).

4. **Set up database**
```bash
# Generate Prisma client
npm run prisma:generate

# Push schema to database
npm run prisma:push

# (Optional) Seed database
npm run db:seed
```

5. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔐 Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Required Variables

```env
# Server
NEXT_PUBLIC_SERVER_URL=https://your-domain.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (for subscription plans)
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_...
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_...
NEXT_PUBLIC_STRIPE_PRICE_SCALE=price_...

# HMAC Authentication (for external service callbacks)
SHARED_HMAC_SECRET=your-secret-key-here

# Rewardful (Optional - for affiliate tracking)
NEXT_PUBLIC_REWARDFUL_ID=your-rewardful-id

# Cron Jobs (Optional - for auto-topup and low balance checks)
CRON_SECRET=your-cron-secret
```

### How to Obtain Credentials

1. **PostgreSQL**: Sign up at [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. **Clerk**: Create account at [Clerk](https://clerk.com)
   - Configure webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
   - Enable Gmail-only sign-in restriction
3. **Stripe**: Create account at [Stripe](https://stripe.com)
   - Create products and prices for subscription plans
   - Set up webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Add `credits` metadata to prices (e.g., `credits: 100`)
4. **Rewardful**: Create account at [Rewardful](https://rewardful.com)
   - Get your Rewardful ID from dashboard
   - Configure Stripe integration in Rewardful

## 🗄️ Database Setup

### Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema changes to database
npm run prisma:push

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Seed database (if seed file exists)
npm run db:seed
```

### Database Schema

The project uses PostgreSQL with Prisma. Key models include:
- `User` - User accounts with credit balances
- `Organization` - Organizations (each user has one)
- `CreditBalance` - Organization-level credit tracking
- `CreditLedger` - Complete transaction audit trail
- `Job` - Video processing jobs
- `JobQuote` - Provisional quotes before job creation
- `PriceBookEntry` - Dynamic pricing per organization
- `Transaction` - Stripe payment records

## 📚 API Documentation

### Quote API

**POST /api/quote**
Create a job quote with pricing.

```json
{
  "actionKey": "text_to_video",
  "units": 60,
  "parameters": {}
}
```

**GET /api/quote/estimate?actionKey=text_to_video&units=60**
Estimate credits without creating a quote.

### Jobs API

**POST /api/jobs**
Create a job from a quote (deducts credits atomically).

```json
{
  "quoteId": "quote-id",
  "idempotencyKey": "optional-key"
}
```

**POST /api/jobs/callback** (HMAC-protected)
External service callback to update job status.

```json
{
  "jobId": "job-id",
  "status": "completed|failed|running|cancelled",
  "resultUrl": "https://...",
  "errorMessage": "..."
}
```

Headers:
- `X-HMAC-Signature`: HMAC-SHA256 signature of request body

**POST /api/jobs/:id/refund** (Admin only)
Refund credits for a failed/cancelled job.

### User API

**GET /api/me/balance**
Get current user's credit balance.

**GET /api/me/ledger?page=1&limit=50**
Get credit transaction history.

## 🚀 Deployment

### Vercel Deployment

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Add all environment variables in Vercel dashboard
   - Deploy

3. **Configure Webhooks**
   - **Clerk**: Set webhook URL to `https://your-domain.com/api/webhooks/clerk`
   - **Stripe**: Set webhook URL to `https://your-domain.com/api/webhooks/stripe`
   - **Rewardful**: Configure in Rewardful dashboard

4. **Database**
   - Ensure your PostgreSQL database is accessible from Vercel
   - Run migrations: `npm run prisma:push` (or use Vercel CLI)

### Custom Domain

1. Add custom domain in Vercel dashboard
2. Update `NEXT_PUBLIC_SERVER_URL` environment variable
3. Update Clerk and Stripe webhook URLs

## 📁 Project Structure

```
├── app/
│   ├── (auth)/          # Authentication pages
│   ├── (root)/          # Main application pages
│   │   ├── admin/       # Admin console
│   │   ├── billing/     # Billing and invoices
│   │   ├── credits/      # Credit purchase
│   │   ├── profile/     # User profile
│   │   └── legal/       # Terms and Privacy
│   └── api/             # API routes
│       ├── admin/       # Admin APIs
│       ├── credits/     # Credit management
│       ├── jobs/        # Job processing
│       ├── quote/       # Quote generation
│       └── webhooks/    # Webhook handlers
├── components/
│   ├── admin/          # Admin components
│   ├── profile/       # Profile components
│   ├── shared/        # Shared components
│   └── ui/            # UI components (shadcn)
├── lib/
│   ├── actions/       # Server actions
│   ├── auth/          # Authentication utilities
│   ├── database/       # Database connection
│   ├── middleware/    # HMAC middleware
│   ├── services/       # Business logic
│   └── utils/         # Utility functions
├── prisma/
│   └── schema.prisma  # Database schema
└── docs/              # Documentation
```

## 🔒 Security Features

- **Gmail-only sign-in** enforced at multiple levels
- **HMAC authentication** for external service callbacks
- **Idempotency keys** on credit transactions
- **Stripe webhook signature verification**
- **Role-based access control** (USER, ADMIN, SUPER_ADMIN)

## 📖 Additional Documentation

- [Credit Balance Architecture](./docs/credit-balance-architecture.md)
- [HMAC Authentication Guide](./docs/HMAC_AUTHENTICATION.md)

## 🛠️ Development

### Running Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npm run prisma:generate
npm run prisma:push

# Run development server
npm run dev
```

### Database Migrations

```bash
# After schema changes
npm run prisma:generate
npm run prisma:push
```

### Testing

Test the quote estimation endpoint:
```bash
curl "http://localhost:3000/api/quote/estimate?actionKey=text_to_video&units=60" \
  -H "Cookie: __session=your-session-cookie"
```

## 📝 License

This project is proprietary. All rights reserved.

## 🤝 Support

For issues or questions, please contact the development team or create an issue in the repository.

---

**Note**: This project uses PostgreSQL with Prisma, not MongoDB. The database schema is defined in `prisma/schema.prisma`.
