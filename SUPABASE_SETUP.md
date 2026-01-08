# Supabase Setup Guide

This guide will help you set up Supabase authentication and edge functions for the Aether AI platform.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Google Gemini API key (get one at https://makersuite.google.com/app/apikey)

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and create a new project
2. Wait for the project to be fully provisioned (this may take a few minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** > **API**
2. Copy the following values:
   - **Project URL** (this is your `VITE_SUPABASE_URL`)
   - **anon/public key** (this is your `VITE_SUPABASE_ANON_KEY`)

## Step 3: Set Up Environment Variables

1. Create a `.env` file in the root of your project (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Step 4: Install Supabase CLI

**For macOS (Recommended):**
```bash
brew install supabase/tap/supabase
```

**For other platforms or if you don't have Homebrew:**
- Visit https://github.com/supabase/cli#install-the-cli for installation options
- Or use npx (no installation needed): `npx supabase@latest <command>`

**Verify installation:**
```bash
supabase --version
```

**Optional: Initialize Supabase locally for testing:**
```bash
supabase init
supabase start
```

## Step 5: Deploy the Edge Function

1. Make sure Supabase CLI is installed (see Step 4)

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (You can find your project ref in the Supabase dashboard URL)

4. Set the API keys as secrets:
   ```bash
   # Set Gemini API key
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   
   # Set OpenAI API key (optional, if using OpenAI)
   supabase secrets set OPENAI_API_KEY=your_openai_api_key
   
   # Set DeepSeek API key (optional, if using DeepSeek)
   supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

5. Deploy the edge function:
   ```bash
   supabase functions deploy proxy-ai
   ```

## Step 6: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** > **Settings**
2. Make sure **Enable email signup** is enabled
3. Configure your site URL (e.g., `http://localhost:3000` for development)
4. Add any additional redirect URLs you need

## Step 7: Install Dependencies

```bash
npm install
```

## Step 8: Run the Application

```bash
npm run dev
```

The app will now:
- Show an authentication page if you're not logged in
- Allow you to sign up or sign in
- Use the edge function to proxy all AI API calls
- Store user sessions securely

## Troubleshooting

### Edge Function Deployment Hanging

If `supabase functions deploy proxy-ai` hangs or gets stuck:

1. **Try with --no-verify flag:**
   ```bash
   supabase functions deploy proxy-ai --no-verify
   ```

2. **Try with debug mode to see what's happening:**
   ```bash
   supabase functions deploy proxy-ai --debug
   ```

3. **Verify you're logged in:**
   ```bash
   supabase projects list
   ```
   If this fails, run `supabase login` again.

4. **Check your project link:**
   ```bash
   cat .supabase/config.toml
   ```
   Verify the project_ref matches your Supabase project.

5. **Try deploying with verbose output:**
   ```bash
   supabase functions deploy proxy-ai --verbose
   ```

6. **If still hanging, try using npx instead:**
   ```bash
   npx supabase@latest functions deploy proxy-ai --no-verify
   ```

### Edge Function Not Working

1. Make sure you've deployed the function: `supabase functions deploy proxy-ai`
2. Check that the `GEMINI_API_KEY` secret is set: `supabase secrets list`
3. Verify the function URL in your Supabase dashboard under **Edge Functions**

### Authentication Issues

1. Check that your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
2. Verify your site URL is configured in Supabase dashboard
3. Check the browser console for any error messages

### CORS Errors

The edge function includes CORS headers. If you're still seeing CORS errors:
1. Make sure you're using the correct Supabase project URL
2. Check that the edge function is deployed and accessible
3. Verify your environment variables are loaded correctly

## Production Deployment

Follow these steps to deploy the edge function to your production Supabase project:

### Step 1: Get Your Production Project Reference

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your production project
3. Look at the URL in your browser - it will be something like:
   `https://supabase.com/dashboard/project/abcdefghijklmnop`
   The part after `/project/` is your **project reference ID** (e.g., `abcdefghijklmnop`)

Alternatively, you can find it in **Settings** > **General** > **Reference ID**

### Step 2: Install and Login to Supabase CLI

**Install Supabase CLI:**

**For macOS (Recommended):**
```bash
brew install supabase/tap/supabase
```

**For other platforms:**
- Visit https://github.com/supabase/cli#install-the-cli
- Or use npx: `npx supabase@latest <command>`

**Verify installation:**
```bash
supabase --version
```

**Login to Supabase:**
```bash
supabase login
```
This will open a browser window for you to authenticate.

### Step 3: Link Your Production Project

```bash
# Link to your production project using the project reference ID
supabase link --project-ref your-production-project-ref
```

Replace `your-production-project-ref` with the reference ID from Step 1.

### Step 4: Set the API Key Secrets

```bash
# Set the Gemini API key as a secret in your production project
supabase secrets set GEMINI_API_KEY=your_gemini_api_key

# Set OpenAI API key (optional, if using OpenAI)
supabase secrets set OPENAI_API_KEY=your_openai_api_key

# Set DeepSeek API key (optional, if using DeepSeek)
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key
```

**Important:** Replace the API keys with your actual keys. These secrets will be securely stored and accessible only to your edge functions. You only need to set the keys for the providers you plan to use.

### Step 5: Deploy the Edge Function

```bash
# Deploy the proxy-ai edge function to production
supabase functions deploy proxy-ai
```

You should see output like:
```
Deploying function proxy-ai...
Function proxy-ai deployed successfully
```

### Step 6: Verify Deployment

1. Go to your Supabase dashboard
2. Navigate to **Edge Functions** in the sidebar
3. You should see `proxy-ai` listed with a status of "Active"
4. Click on it to see the function details and logs

### Step 7: Configure Production Environment Variables

In your production environment (Vercel, Netlify, etc.), set these environment variables:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
```

**Note:** Never commit your `.env` file with real credentials to git!

### Step 8: Configure Authentication Settings

1. In your Supabase dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your production domain (e.g., `https://yourdomain.com`)
3. Add your production domain to **Redirect URLs**:
   - `https://yourdomain.com/**`
   - `https://yourdomain.com`

### Step 9: Test the Deployment

1. Visit your production site
2. Try signing up or logging in
3. Test a chat message to verify the edge function is working
4. Check the Supabase dashboard **Edge Functions** > **proxy-ai** > **Logs** for any errors

### Troubleshooting Production Deployment

**Function not found:**
- Make sure you've linked the correct project: `supabase link --project-ref your-project-ref`
- Verify you're in the correct directory with the `supabase/functions/proxy-ai` folder

**Authentication errors:**
- Check that your production site URL is added to allowed redirect URLs in Supabase
- Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct

**API key errors:**
- Verify the secrets are set: `supabase secrets list`
- Make sure you set them in the correct project (production, not local)
- For DeepSeek: Ensure `DEEPSEEK_API_KEY` is set if using DeepSeek models
- For OpenAI: Ensure `OPENAI_API_KEY` is set if using OpenAI models
- For Gemini: Ensure `GEMINI_API_KEY` is set if using Gemini models

**CORS errors:**
- The edge function includes CORS headers, but verify your production domain is allowed
- Check that you're using the correct Supabase project URL

### Updating the Function

To update the edge function after making changes:

```bash
# Make sure you're linked to the correct project
supabase link --project-ref your-production-project-ref

# Deploy the updated function
supabase functions deploy proxy-ai
```

### Viewing Function Logs

To view real-time logs from your production edge function:

```bash
supabase functions logs proxy-ai
```

Or view them in the Supabase dashboard under **Edge Functions** > **proxy-ai** > **Logs**

