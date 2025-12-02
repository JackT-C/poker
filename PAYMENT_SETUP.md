# Casino Games - Payment Integration Guide

## Stripe Setup (Free Tier)

### 1. Create a Stripe Account

- Go to https://stripe.com and sign up for a free account
- Stripe Test Mode is completely free with no fees

### 2. Get Your API Keys

1. Log in to your Stripe Dashboard
2. Click on "Developers" in the left sidebar
3. Click on "API keys"
4. Copy your **Publishable key** (starts with `pk_test_`)
5. Copy your **Secret key** (starts with `sk_test_`)

### 3. Configure Your Application

**Update `.env` file:**

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

**Update `public/app.js` (line 15):**

```javascript
stripe = Stripe("pk_test_your_publishable_key_here");
```

### 4. Test Payment

Use Stripe test cards (no real money):

- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any ZIP code

### 5. Production Mode

When ready for real payments:

1. Complete Stripe account verification
2. Switch to Live mode in Stripe Dashboard
3. Replace test keys with live keys (starts with `pk_live_` and `sk_live_`)

## Features

✅ Free test environment
✅ No credit card required for testing
✅ PCI compliant payment processing
✅ Support for all major cards
✅ 3D Secure authentication support
✅ Mobile-optimized payment form

## Important Notes

- Test mode is **100% free** with no transaction fees
- Live mode charges 2.9% + $0.30 per successful card charge
- First $1M in revenue has no monthly fees
- Perfect for getting started
