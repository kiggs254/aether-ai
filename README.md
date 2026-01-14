# Aether AI - Custom Bot Platform

A comprehensive AI chatbot platform that enables users to create, customize, and deploy intelligent chatbots for their websites. Built with React, TypeScript, Supabase, and integrated with multiple AI providers including Google Gemini, OpenAI, and Deepseek.

## What This App Does

Aether AI is a full-featured SaaS platform for building and managing AI chatbots. Users can create custom chatbots with their own knowledge bases, deploy them as embeddable widgets on websites, manage conversations in real-time, collect leads, and integrate e-commerce functionality.

## Core Features

### 🤖 Bot Builder
- **Visual Bot Creation**: Create and configure AI chatbots through an intuitive interface
- **Custom Instructions**: Define system instructions that shape the bot's personality and behavior
- **Knowledge Base**: Train bots with custom knowledge bases and training data
- **AI Model Selection**: Choose from multiple AI providers:
  - Google Gemini (fast and reasoning models)
  - OpenAI (GPT models)
  - Deepseek (fast and reasoning models)
- **Temperature Control**: Adjust creativity and response randomness
- **Bot Actions**: Configure interactive actions like:
  - Links (open URLs)
  - Phone calls
  - WhatsApp messages
  - Human handoff
  - Custom actions
  - Media sharing (images, audio, PDFs, videos)
  - Product recommendations (e-commerce)
- **Branding**: Customize bot appearance with:
  - Header images
  - Custom branding text
  - Avatar colors
- **E-commerce Integration**: 
  - Connect product feeds (XML/JSON)
  - Enable product recommendations in chat
  - Visual product carousels
  - Smart product search and filtering

### 💬 Chat Widget
- **Embeddable Widget**: Deploy chatbots on any website with a simple script tag
- **Mobile-First Design**: Fully responsive, optimized for mobile and desktop
- **Real-time Chat**: Streaming responses for natural conversation flow
- **Lead Collection**: Capture visitor emails and phone numbers before or during chat
- **Departmental Routing**: Route conversations to different bots based on department selection (Premium feature)
- **Customizable Themes**: Dark and light themes with brand color customization
- **Position Control**: Place widget on left or right side of screen
- **Welcome Messages**: Customizable greeting messages
- **Markdown Support**: Rich text formatting in bot responses
- **Image Support**: Users can send images in chat
- **Action Buttons**: Interactive buttons for links, calls, and custom actions
- **Product Carousels**: Visual product recommendations with images and prices

### 📊 Dashboard & Analytics
- **Overview Statistics**: 
  - Total bots
  - Total messages
  - Active conversations
  - Unread message counts
- **Visual Analytics**: Charts and graphs showing:
  - Message trends over time
  - Bot performance metrics
  - Conversation statistics
- **Recent Activity**: Quick view of recent conversations and interactions
- **Bot Management**: View, edit, and manage all your bots from one place

### 📨 Inbox & Conversation Management
- **Unified Inbox**: View all conversations from all bots in one place
- **Real-time Updates**: Live notifications when new messages arrive
- **Unread Tracking**: Track unread messages per conversation
- **Conversation Filtering**: Filter by bot, search conversations
- **Archive System**: Archive conversations while preserving all messages
- **Message History**: Complete conversation history with timestamps
- **Lead Information**: View captured email and phone numbers
- **Product Recommendations**: View product recommendations made during conversations

### 🔗 Integrations Management
- **Integration Creation**: Create multiple widget integrations per bot
- **Single Bot Integrations**: Standard integration with one bot
- **Departmental Integrations**: Route users to different bots based on department (Premium)
- **Integration Settings**: Configure:
  - Theme (dark/light)
  - Position (left/right)
  - Brand color
  - Welcome message
  - Lead collection settings
- **Embed Code Generation**: Get ready-to-use embed code for each integration
- **Integration Limits**: Based on subscription plan

### 🎮 Chat Playground
- **Bot Testing**: Test bots before deploying
- **Real-time Streaming**: See responses stream in real-time
- **Action Testing**: Test bot actions and interactions
- **No Persistence**: Playground conversations are not saved (for testing only)

### 👥 User Management & Authentication
- **Supabase Authentication**: Secure email/password authentication
- **User Profiles**: Manage account settings
- **Session Management**: Secure session handling

### 💳 Subscription System
- **Multiple Plans**: 
  - **Free**: Limited bots, messages, and features
  - **Pro**: More bots, integrations, and advanced features
  - **Premium**: Full access including e-commerce and departmental bots
- **Feature Limits**: 
  - Bot limits per plan
  - Message limits per month
  - Integration limits
  - Knowledge base character limits
  - Storage limits
  - Model access restrictions
- **Paystack Integration**: Secure payment processing for subscriptions
- **Admin Management**: Super admin panel for managing plans and subscriptions

### 🔐 Admin Features
- **Super Admin Panel**: 
  - View all users and bots
  - Manage subscription plans
  - Manage user subscriptions
  - System-wide analytics
- **Admin Controls**: Enhanced permissions for platform management

### 🚀 Deployment & Infrastructure
- **Supabase Backend**: 
  - PostgreSQL database
  - Real-time subscriptions
  - Edge functions for AI API proxying
  - Storage for media files
- **Widget Deployment**: Automated widget file generation and deployment to Supabase storage
- **Netlify Integration**: Optional Netlify deployment support
- **Edge Functions**: Secure AI API calls through Supabase edge functions

## Technical Architecture

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Recharts** for analytics visualization
- **Lucide React** for icons

### Backend
- **Supabase** for:
  - Authentication
  - Database (PostgreSQL)
  - Real-time subscriptions
  - Storage
  - Edge functions

### AI Integration
- **Google Gemini API** (via edge function)
- **OpenAI API** (via edge function)
- **Deepseek API** (via edge function)
- Streaming responses for real-time chat

### Key Services
- **Database Service**: Bot, conversation, and integration management
- **Gemini Service**: AI chat streaming and response generation
- **Product Feed Service**: E-commerce product catalog management
- **Product Query Service**: Product search and recommendations
- **Statistics Service**: Analytics and dashboard metrics
- **Storage Service**: Media file uploads and management

## Database Schema

### Core Tables
- **bots**: Bot configurations and settings
- **bot_actions**: Interactive actions for bots
- **conversations**: Chat conversation records
- **messages**: Individual chat messages
- **integrations**: Widget integration configurations
- **product_catalog**: E-commerce product data
- **subscription_plans**: Available subscription tiers
- **user_subscriptions**: User subscription records
- **admin_users**: Admin user management

## Widget Deployment

The platform includes an automated widget deployment system:

1. **Generate Widget Files**: Creates optimized JavaScript and CSS files
2. **Upload to Supabase Storage**: Deploys files to Supabase storage bucket
3. **Git Integration**: Automatically commits changes with detailed commit messages
4. **Version Control**: Tracks widget file sizes and deployment metadata

## Security Features

- **Row Level Security (RLS)**: Database-level access control
- **API Key Protection**: AI API keys stored securely in Supabase secrets
- **Edge Function Proxying**: All AI calls go through secure edge functions
- **User Isolation**: Users can only access their own bots and conversations
- **Admin Controls**: Super admin access with proper authentication

## Real-time Features

- **Live Message Updates**: Real-time message delivery via Supabase subscriptions
- **Unread Notifications**: Instant unread count updates
- **Conversation Sync**: Automatic conversation updates across all clients
- **Sound Notifications**: Audio alerts for new messages

## E-commerce Capabilities

- **Product Feed Integration**: Import products from XML/JSON feeds
- **Smart Recommendations**: AI-powered product suggestions
- **Visual Product Cards**: Rich product displays in chat
- **Product Search**: Natural language product queries
- **Category Filtering**: Filter products by category
- **Price Range Filtering**: Filter by price ranges
- **Stock Status**: Display product availability

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Set Up Supabase**:
   - Create a Supabase project
   - Configure environment variables
   - Run database migrations
   - Set up edge functions

3. **Configure AI Providers**:
   - Add API keys to Supabase secrets
   - Configure edge function for AI proxying

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Deploy Widget**:
   ```bash
   npm run deploy-widget
   ```

## Project Structure

```
├── components/          # React components
│   ├── BotBuilder.tsx  # Bot creation/editing interface
│   ├── Dashboard.tsx   # Analytics dashboard
│   ├── Inbox.tsx        # Conversation management
│   ├── Integrations.tsx # Integration management
│   ├── ChatPlayground.tsx # Bot testing interface
│   └── ui/             # Reusable UI components
├── services/           # Business logic services
│   ├── database.ts     # Database operations
│   ├── geminiService.ts # AI chat service
│   ├── productFeed.ts  # Product catalog management
│   └── statistics.ts   # Analytics calculations
├── lib/                # Utility libraries
│   ├── supabase.ts     # Supabase client
│   └── subscription.ts # Subscription management
├── supabase/           # Supabase configuration
│   ├── migrations/     # Database migrations
│   └── functions/      # Edge functions
└── scripts/            # Build and deployment scripts
```

## Key Workflows

### Creating a Bot
1. Navigate to Bot Builder
2. Configure bot name, description, and system instructions
3. Add knowledge base content
4. Select AI provider and model
5. Configure actions (optional)
6. Enable e-commerce (optional)
7. Save bot

### Deploying a Widget
1. Create an integration in Integrations page
2. Configure widget settings (theme, position, colors)
3. Copy embed code
4. Add to website HTML
5. Widget automatically loads and connects to bot

### Managing Conversations
1. View conversations in Inbox
2. Filter by bot or search
3. View message history
4. Archive conversations when done
5. Track unread messages

## Subscription Plans

- **Free**: 1 bot, 800 messages/month, basic features
- **Pro**: 3 bots, 8000 messages/month, advanced features, lead collection
- **Premium**: Unlimited bots, unlimited messages, e-commerce, departmental bots

## Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

Supabase secrets (for edge functions):
- `GEMINI_API_KEY`: Google Gemini API key
- `OPENAI_API_KEY`: OpenAI API key (optional)
- `DEEPSEEK_API_KEY`: Deepseek API key (optional)

## License

Private - All rights reserved
