# Credit Deduction API - Integration Guide

## Overview

I've initially built the credit deduction API that Other developer can use to deduct credits from user accounts after AI processing is complete. This API handles the billing side - Other developer will calculate credits based on their AI platform database, then call this API to actually deduct those credits from the user's account.

## What This Does

Once the backend system the other develop implemented has:
1. Processed content through AI platforms (fal.ai, OpenAI, Veo3, etc.)
2. Calculated how many credits were used based on your credits database

Other developer can then call this API to deduct those credits from the user's billing account. The API handles all the balance checking, transaction recording, and ensures users can't be charged twice.

## API Endpoint

```
POST /api/credits/deductions
```

This is the endpoint Other developer will call after calculating credits.

## Security

The API uses HMAC authentication for security. This means Other developer needs to:
1. Generate an HMAC-SHA256 signature using a shared secret (`SHARED_HMAC_SECRET`)
2. Include that signature in the `X-HMAC-Signature` header

This ensures only authorized services can deduct credits. I'll provide the `SHARED_HMAC_SECRET` when you're ready to integrate.

## Request Format

### Headers Required
```
Content-Type: application/json
X-HMAC-Signature: <hmac-signature-generated-by-your-developer>
```

### Request Body
```json
{
  "userId": "user_xxx",           // Clerk user ID (or use userEmail)
  "userEmail": "user@example.com", // User's email (or use userId)
  "amount": 10,                     // Required: How many credits to deduct
  "reason": "AI video generation",  // Optional: Description of what was processed
  "idempotencyKey": "unique-key"   // Optional: Prevents duplicate charges
}
```

**Important:** Either `userId` OR `userEmail` must be provided (not both). The `amount` field is required - this is how many credits Other developer calculated should be deducted.

## Response Format

### Success Response
When the deduction is successful:
```json
{
  "success": true,
  "newBalance": 90,
  "deducted": 10,
  "ledgerId": "ledger-entry-id",
  "userId": "user_xxx",
  "email": "user@example.com",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

This confirms the credits were deducted and shows the user's updated balance.

### Error Responses

**Insufficient Credits (402)**
If the user doesn't have enough credits:
```json
{
  "error": "Insufficient credits. Current: 5, Required: 10",
  "code": "INSUFFICIENT_CREDITS"
}
```

**User Not Found (404)**
If the userId or email doesn't exist in our system:
```json
{
  "error": "User not found with email: user@example.com",
  "code": "USER_NOT_FOUND"
}
```

**Invalid Authentication (401)**
If the HMAC signature is incorrect:
```json
{
  "error": "Invalid HMAC signature",
  "code": "HMAC_VALIDATION_FAILED"
}
```

## Complete Integration Example

Here's a full example Other developer can use as a reference:

```javascript
const crypto = require('crypto');

// Step 1: After AI processing completes, calculate credits
// Other developer will use their credits database here
const creditsUsed = calculateCreditsBasedOnAI(platform, duration, quality);
// Example: Returns 10 credits for a 60-second video on fal.ai

// Step 2: Build the request payload
const payload = {
  userId: "user_abc123",           // The Clerk user ID from your system
  amount: creditsUsed,              // The credits calculated from your database
  reason: "Video generation - fal.ai", // Optional: What this was for
  idempotencyKey: `job-${jobId}`    // Unique per job to prevent duplicate charges
};

// Step 3: Generate HMAC signature
const bodyString = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', process.env.SHARED_HMAC_SECRET)
  .update(bodyString)
  .digest('hex');

// Step 4: Make the API call
const response = await fetch('https://your-domain.com/api/credits/deductions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-HMAC-Signature': signature
  },
  body: bodyString
});

const result = await response.json();

// Step 5: Handle the response
if (result.success) {
  console.log(`✅ Successfully deducted ${result.deducted} credits. New balance: ${result.newBalance}`);
} else {
  console.error(`❌ Error: ${result.error}`);
  // Handle insufficient credits, user not found, etc.
}
```

## Complete Process Flow

Here's how everything works together from start to finish:

```
1. User requests AI processing (video generation, etc.)
   ↓
2. Other developer's backend calls AI platform (fal.ai, OpenAI, Veo3, etc.)
   ↓
3. AI platform processes and returns the result
   ↓
4. Other developer's backend calculates credits using their credits database
   (This is where they determine: "Fal.ai 60-second video = 10 credits")
   ↓
5. Other developer's backend calls this API:
   POST /api/credits/deductions
   { userId, amount: 10, reason, idempotencyKey }
   ↓
6. Our API deducts the credits from the user's account
   ↓
7. API returns success with the new balance
```

## Key Features

### Idempotency Protection
The `idempotencyKey` parameter prevents duplicate charges. Even if Other developer's system retries the request (due to network issues, etc.), the user will only be charged once. Other developer should use a unique key per job (like the job ID).

### Automatic Balance Checking
The API automatically checks if the user has enough credits before deducting. If they don't have enough, it returns an error and doesn't deduct anything. This prevents negative balances.

### Complete Audit Trail
Every deduction is recorded in our ledger system, so you can track exactly when and why credits were deducted from each user's account.

## What Other Developer Needs

1. **The API endpoint**: `POST /api/credits/deductions`
2. **The HMAC secret**: `SHARED_HMAC_SECRET` (I'll provide this)
3. **User identification**: Either `userId` (Clerk ID) or `userEmail`
4. **Credit calculation**: Their credits database that maps AI platforms to credit costs

## Important Notes for Other Developer

### Error Handling
Different error codes mean different things:
- **INSUFFICIENT_CREDITS**: The user needs to purchase more credits before they can use this feature. Other developer should show a message prompting the user to buy credits.
- **USER_NOT_FOUND**: The userId or email doesn't exist in our system. Other developer should verify the user identifier is correct.
- **HMAC_VALIDATION_FAILED**: The HMAC secret doesn't match. Verify the `SHARED_HMAC_SECRET` environment variable is set correctly.

### Credit Calculation Responsibility
Other developer is responsible for calculating the correct number of credits based on their credits database. This API only handles the deduction - it doesn't calculate credits. Make sure their calculation logic is correct before calling this API.

### Testing
I recommend Other developer test this API with small amounts first to ensure everything works correctly before going live.

## Environment Setup

Other developer will need this environment variable:
```
SHARED_HMAC_SECRET=your-secret-key-here
```

I'll provide the actual secret value when you're ready to integrate. This should be kept secure and never committed to version control.
