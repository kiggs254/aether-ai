# Enable Supabase Real-Time for Notifications

## Quick Setup (2 Methods)

### Method 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Database** → **Replication** (in the left sidebar)
4. Find the `conversations` table and toggle the switch to enable replication
5. Find the `messages` table and toggle the switch to enable replication

That's it! Real-time is now enabled.

### Method 2: Using SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (in the left sidebar)
3. Click **New Query**
4. Copy and paste this SQL:

```sql
-- Enable real-time for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

5. Click **Run** (or press Cmd/Ctrl + Enter)

## Verify Real-Time is Enabled

After enabling, you should see:
- In the Replication page: Both tables show as "Enabled"
- In your browser console: You should see "Conversations channel status: SUBSCRIBED" and "Messages channel status: SUBSCRIBED"

## Testing

1. Open your app in the browser
2. Open the browser console (F12)
3. Start a new chat from your website
4. You should see console logs:
   - "Setting up real-time subscriptions..."
   - "Conversations channel status: SUBSCRIBED"
   - "Messages channel status: SUBSCRIBED"
5. When a new message arrives, you should see:
   - "New message received: ..."
   - A notification popup
   - Unread badge count increases

## Troubleshooting

If real-time still doesn't work:

1. **Check RLS Policies**: Make sure your RLS policies allow the user to read conversations and messages
2. **Check Console**: Look for any errors in the browser console
3. **Check Network Tab**: Verify WebSocket connections are established (look for `realtime` connections)
4. **Verify Tables**: Make sure the tables exist and have data

## Important Notes

- Real-time must be enabled on **both** `conversations` and `messages` tables
- The subscription will only receive events for data the user has permission to see (based on RLS policies)
- Real-time works via WebSocket connections, so make sure your network allows WebSocket connections

