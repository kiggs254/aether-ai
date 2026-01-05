#!/bin/bash

# Deploy all Supabase Edge Functions
# Make sure you're logged in: supabase login

echo "Deploying Supabase Edge Functions..."

# Deploy initialize-payment
echo "Deploying initialize-payment..."
supabase functions deploy initialize-payment --no-verify-jwt

# Deploy paystack-webhook
echo "Deploying paystack-webhook..."
supabase functions deploy paystack-webhook --no-verify-jwt

# Deploy manage-plans
echo "Deploying manage-plans..."
supabase functions deploy manage-plans --no-verify-jwt

# Deploy manage-subscriptions
echo "Deploying manage-subscriptions..."
supabase functions deploy manage-subscriptions --no-verify-jwt

# Deploy manage-site-settings
echo "Deploying manage-site-settings..."
supabase functions deploy manage-site-settings --no-verify-jwt

echo "All edge functions deployed successfully!"

