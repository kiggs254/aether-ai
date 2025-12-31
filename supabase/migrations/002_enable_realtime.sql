-- Enable real-time for conversations table
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Enable real-time for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

