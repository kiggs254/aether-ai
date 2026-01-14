# Widget Deployment Script

## Overview

The `deploy-widget.js` script automates the process of generating, uploading, and deploying widget files to Supabase storage and pushing code changes to Git.

## How It Works

The deployment script performs the following steps in sequence:

### Step 1: Generate Widget Files
- Runs `npm run generate-widget` to create the widget JavaScript and CSS files
- Verifies that both `widget.js` and `widget.css` files are generated in the `public/` directory

### Step 2: Upload to Supabase Storage
- Checks for Supabase CLI installation
- Uploads widget files to Supabase storage bucket (`Assets/public/`)
- Includes retry logic for network errors and duplicate file conflicts
- Automatically removes existing files before uploading new versions

### Step 3: Push to Git
- Stages all changes except files in the `public/` folder (widget files are excluded from git)
- Generates an accurate commit message that includes:
  - Summary with widget file sizes
  - Deployment timestamp
  - Categorized list of changed files (widget-related, configuration, other)
  - Confirmation of Supabase storage upload
- Commits and pushes changes to the remote repository

## Usage

Run the deployment script:

```bash
npm run deploy-widget
```

Or directly:

```bash
node scripts/deploy-widget.js
```

## Prerequisites

- Node.js installed
- Supabase CLI installed and configured
- Git repository initialized with remote configured
- Logged into Supabase: `supabase login`
- Project linked: `supabase link --project-ref your-project-ref`
- `Assets` bucket exists in your Supabase project

## Commit Message Format

The script automatically generates descriptive commit messages like:

```
Deploy widget update to Supabase storage (widget.js: 45.2KB, widget.css: 12.3KB)

Deployed at: 2024-01-15 14:30:25

Widget-related changes:
  - components/BotBuilder.tsx
  - components/ChatPlayground.tsx

Configuration changes:
  - package.json

Widget files uploaded to Supabase storage (Assets/public)
```

This provides clear visibility into what changed in each deployment.
