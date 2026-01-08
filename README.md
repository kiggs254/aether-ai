<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js, Supabase account

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase:
   - Create a Supabase project at https://supabase.com
   - Get your project URL and anon key from Settings > API
   - Create a `.env` file with:
     ```env
     VITE_SUPABASE_URL=your_supabase_project_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. Deploy the edge function:
   ```bash
   # Install Supabase CLI (macOS)
   brew install supabase/tap/supabase
   
   # Or use npx (no installation needed)
   # npx supabase@latest login
   
   # Login and link your project
   supabase login
   supabase link --project-ref your-project-ref
   
   # Set API keys as secrets (set only the ones you need)
   supabase secrets set GEMINI_API_KEY=your_gemini_api_key
   supabase secrets set OPENAI_API_KEY=your_openai_api_key  # Optional
   supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key  # Optional
   
   # Deploy the function
   supabase functions deploy proxy-ai
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

### Detailed Setup

For detailed setup instructions, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## Features

- ✅ Supabase Authentication (Email/Password)
- ✅ Edge Functions for secure AI API proxying
- ✅ Protected routes requiring authentication
- ✅ Real-time chat streaming
- ✅ Bot builder and management
