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
SITE_URL=https://your-domain.com  (or http://localhost:3000 for local)
```

**Note**: `PAYSTACK_WEBHOOK_SECRET` is optional. If not set, the code will use `PAYSTACK_SECRET_KEY` for webhook signature verification (which is the correct approach for Paystack).

### Option B: Using Supabase CLI

```bash
# Set Paystack secret key (used for both API calls and webhook verification)
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Set site URL
supabase secrets set SITE_URL=https://your-domain.com

# Optional: Set separate webhook secret (if not set, PAYSTACK_SECRET_KEY will be used)
# supabase secrets set PAYSTACK_WEBHOOK_SECRET=sk_test_xxxxxxxxxxxxx
```

## Step 4: Set Up Paystack Webhook

The webhook is crucial for receiving payment notifications from Paystack.

**Important Note**: Paystack doesn't use a separate webhook secret. It uses your **Secret Key** (the same `PAYSTACK_SECRET_KEY`) to sign webhook events. The signature is sent in the `x-paystack-signature` header and verified using HMAC SHA512.

### 4.1 Get Your Webhook URL

Your webhook URL will be:
```
https://[your-project-ref].supabase.co/functions/v1/paystack-webhook
```

To find your project reference:
1. Go to Supabase Dashboard → **Project Settings** → **API**
2. Your project URL will be: `https://[project-ref].supabase.co`

### 4.2 Configure Webhook in Paystack

1. Log in to your **Paystack Dashboard** at https://dashboard.paystack.com
2. Navigate to **Settings** in the sidebar
3. Click on **API Keys & Webhooks** tab
4. Scroll down to find the **Webhook URL** section
5. Enter your webhook URL in the **Webhook URL** field:
   ```
   https://[your-project-ref].supabase.co/functions/v1/paystack-webhook
   ```
6. Click **Save** to save your webhook URL

**Note**: Paystack automatically sends webhook events for all transaction types. You don't need to manually select events - the system will receive:
- `charge.success` - When a payment is successful
- `charge.failed` - When a payment fails
- `subscription.create` - When a subscription is created
- `subscription.disable` - When a subscription is cancelled

### 4.3 Webhook Security

Paystack secures webhooks by:
- Including an `x-paystack-signature` header in each webhook request
- The signature is an HMAC SHA512 hash of the payload, signed with your Secret Key
- Your code already verifies this signature automatically

**No separate webhook secret needed** - the code uses `PAYSTACK_SECRET_KEY` for verification (or `PAYSTACK_WEBHOOK_SECRET` if you set it, but it's optional).

### 4.4 Test Your Webhook

1. Make a test payment using Paystack test card: `4084084084084081`
2. Check your Supabase Edge Function logs:
   ```bash
   supabase functions logs paystack-webhook
   ```
3. You should see logs showing:
   - Webhook received
   - Signature verification
   - Event processing
   - Database updates

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

1. **Check webhook URL** is correct in Paystack dashboard (Settings → API Keys & Webhooks)
2. **Verify PAYSTACK_SECRET_KEY** is set correctly in Supabase secrets
3. **Check Supabase function logs** for errors: `supabase functions logs paystack-webhook`
4. **Verify webhook URL is publicly accessible** (Supabase Edge Functions are public by default)
5. **Test with a real payment** - Paystack doesn't have a "test event" feature, but you can use test cards

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
- **"Invalid signature"**: Secret key doesn't match (check you're using the correct test/live key)
- **"Missing signature"**: Paystack didn't send `x-paystack-signature` header (check webhook URL is correct)
- **"Missing required fields"**: Check metadata in webhook event (user_id, plan_id, etc.)

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

