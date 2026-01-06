#!/bin/bash

# Deploy all Supabase Edge Functions
# Make sure you're logged in: supabase login

set -e  # Exit on error

echo "🚀 Deploying all Supabase Edge Functions..."
echo ""

# Deploy proxy-ai (most critical - handles AI chat requests)
echo "📦 Deploying proxy-ai..."
supabase functions deploy proxy-ai --no-verify-jwt
echo "✅ proxy-ai deployed"
echo ""

# Deploy initialize-payment
echo "📦 Deploying initialize-payment..."
supabase functions deploy initialize-payment --no-verify-jwt
echo "✅ initialize-payment deployed"
echo ""

# Deploy paystack-webhook
echo "📦 Deploying paystack-webhook..."
supabase functions deploy paystack-webhook --no-verify-jwt
echo "✅ paystack-webhook deployed"
echo ""

# Deploy verify-payment
echo "📦 Deploying verify-payment..."
supabase functions deploy verify-payment --no-verify-jwt
echo "✅ verify-payment deployed"
echo ""

# Deploy manage-plans
echo "📦 Deploying manage-plans..."
supabase functions deploy manage-plans --no-verify-jwt
echo "✅ manage-plans deployed"
echo ""

# Deploy manage-subscriptions
echo "📦 Deploying manage-subscriptions..."
supabase functions deploy manage-subscriptions --no-verify-jwt
echo "✅ manage-subscriptions deployed"
echo ""

# Deploy manage-site-settings
echo "📦 Deploying manage-site-settings..."
supabase functions deploy manage-site-settings --no-verify-jwt
echo "✅ manage-site-settings deployed"
echo ""

echo "🎉 All edge functions deployed successfully!"

