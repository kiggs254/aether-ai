# Paystack Setup Guide

This guide will help you set up Paystack payment integration for your Aether AI platform.

## Prerequisites

1. A Paystack account (sign up at https://paystack.com)
2. Access to your Supabase project dashboard
3. Your application deployed or running locally

## Step 1: Create a Paystack Account

1. Go to https://paystack.com and sign up for an account
2. Complete the account verification process
3. Activate your account (may require business verification depending on your country)

## Step 2: Get Your Paystack API Keys

1. Log in to your Paystack Dashboard
2. Navigate to **Settings** → **API Keys & Webhooks**
3. You'll see two sets of keys:
   - **Test Keys** (for development/testing)
   - **Live Keys** (for production)

### For Development/Testing:
- Copy your **Test Secret Key** (starts with `sk_test_...`)
- Copy your **Test Public Key** (starts with `pk_test_...`) - if needed for frontend

### For Production:
- Copy your **Live Secret Key** (starts with `sk_live_...`)
- Copy your **Live Public Key** (starts with `pk_live_...`) - if needed for frontend

## Step 3: Configure Supabase Environment Variables

You need to set the following environment variables in your Supabase project:

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Add the following secrets:

```
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx  (or sk_live_... for production)
PAYSTACK_WEBHOOK_SECRET=your_webhook_secret  (see Step 4)
SITE_URL=https://your-domain.com  (or http://localhost:3000 for local)
```

### Option B: Using Supabase CLI

```bash
# Set Paystack secret key
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Set webhook secret (after creating webhook in Step 4)
supabase secrets set PAYSTACK_WEBHOOK_SECRET=your_webhook_secret

# Set site URL
supabase secrets set SITE_URL=https://your-domain.com
```

## Step 4: Set Up Paystack Webhook

The webhook is crucial for receiving payment notifications from Paystack.

### 4.1 Get Your Webhook URL

Your webhook URL will be:
```
https://[your-project-ref].supabase.co/functions/v1/paystack-webhook
```

To find your project reference:
1. Go to Supabase Dashboard → **Project Settings** → **API**
2. Your project URL will be: `https://[project-ref].supabase.co`

### 4.2 Configure Webhook in Paystack

1. In Paystack Dashboard, go to **Settings** → **API Keys & Webhooks**
2. Scroll down to **Webhooks** section
3. Click **Add Webhook URL**
4. Enter your webhook URL: `https://[your-project-ref].supabase.co/functions/v1/paystack-webhook`
5. Select the events you want to listen to:
   - ✅ `charge.success` (Required - for successful payments)
   - ✅ `subscription.create` (For subscription creation)
   - ✅ `subscription.disable` (For subscription cancellation)
   - ✅ `charge.failed` (For failed payments)
6. Click **Save**
7. **Copy the webhook secret** - you'll need this for `PAYSTACK_WEBHOOK_SECRET`

### 4.3 Test Your Webhook

1. In Paystack Dashboard, go to your webhook settings
2. Click **Send Test Event**
3. Select `charge.success` event
4. Check your Supabase Edge Function logs to verify it's receiving events

## Step 5: Deploy Edge Functions

Make sure your Paystack-related edge functions are deployed:

```bash
# Deploy all edge functions (including Paystack ones)
./scripts/deploy-edge-functions.sh

# Or deploy individually:
supabase functions deploy initialize-payment --no-verify-jwt
supabase functions deploy paystack-webhook --no-verify-jwt
```

## Step 6: Configure Payment Callback URL

The payment callback URL is where users are redirected after payment. Update it in your frontend:

In `components/PaymentFlow.tsx`, the callback URL is set to:
```typescript
callback_url: `${window.location.origin}/payment/callback`
```

Make sure you have a route handler for `/payment/callback` that:
1. Verifies the payment status
2. Redirects users to a success/failure page
3. Updates the UI to reflect subscription status

## Step 7: Test the Integration

### 7.1 Test Payment Flow

1. Use Paystack test cards:
   - **Success**: `4084084084084081`
   - **Decline**: `5060666666666666666`
   - **Insufficient Funds**: `5060666666666666667`
   - CVV: Any 3 digits
   - Expiry: Any future date
   - PIN: Any 4 digits

2. Go through the payment flow in your app
3. Check that:
   - Payment initializes correctly
   - Redirects to Paystack payment page
   - Webhook receives the event
   - Subscription is created in database
   - User sees success message

### 7.2 Verify Webhook Events

Check Supabase Edge Function logs:
```bash
supabase functions logs paystack-webhook
```

You should see logs for:
- Webhook signature verification
- Event processing
- Database updates

## Step 8: Switch to Production

When ready for production:

1. **Switch to Live Keys**:
   ```bash
   supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
   ```

2. **Update Webhook URL** in Paystack to point to your production Supabase project

3. **Update SITE_URL**:
   ```bash
   supabase secrets set SITE_URL=https://your-production-domain.com
   ```

4. **Test with real cards** (start with small amounts)

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL** is correct in Paystack dashboard
2. **Verify webhook secret** matches in Supabase secrets
3. **Check Supabase function logs** for errors
4. **Test webhook** using Paystack's test event feature

### Payment Initialization Fails

1. **Verify PAYSTACK_SECRET_KEY** is set correctly
2. **Check function logs**: `supabase functions logs initialize-payment`
3. **Verify user is authenticated** (needs valid session token)
4. **Check plan exists** in database

### Subscription Not Created After Payment

1. **Check webhook logs** to see if `charge.success` event was received
2. **Verify webhook signature** is valid
3. **Check database** for transaction records
4. **Verify plan_id** in metadata matches existing plan

### Common Errors

- **"Paystack configuration missing"**: `PAYSTACK_SECRET_KEY` not set
- **"Invalid signature"**: Webhook secret doesn't match
- **"Missing required fields"**: Check metadata in webhook event

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use test keys** during development
3. **Rotate keys** periodically
4. **Monitor webhook events** for suspicious activity
5. **Verify webhook signatures** (already implemented)
6. **Use HTTPS** for all webhook URLs

## Additional Resources

- [Paystack API Documentation](https://paystack.com/docs/api)
- [Paystack Webhooks Guide](https://paystack.com/docs/payments/webhooks)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)

## Support

If you encounter issues:
1. Check Supabase Edge Function logs
2. Check Paystack Dashboard → **Transactions** for payment status
3. Review webhook events in Paystack Dashboard
4. Check database for transaction and subscription records

