/**
 * Generates the base CSS for the Aether AI widget
 * Mobile-first approach: base styles are for mobile, desktop is enhancement
 */
export const generateWidgetCSS = (): string => {
  return `/* ============================================
   CSS ISOLATION - Prevent host website interference
   ============================================ */

/* Scoped CSS Variables - Only apply within widget */
#aether-widget-container {
  --aether-brand-color: #6366f1;
  --aether-bg-color: #ffffff;
  --aether-text-color: #18181b;
  --aether-secondary-bg: #f4f4f5;
  --aether-border-color: rgba(0,0,0,0.1);
  --aether-bot-msg-bg: #f3f4f6;
  --aether-bot-msg-text: #1f2937;
  --aether-spacing-xs: 8px;
  --aether-spacing-sm: 12px;
  --aether-spacing-md: 16px;
  --aether-spacing-lg: 24px;
  --aether-spacing-xl: 32px;
  --aether-touch-target: 44px;
}

/* ============================================
   MOBILE BASE STYLES (No Media Query)
   ============================================ */

/* Widget container - only critical positioning needs !important */
#aether-widget-container {
  position: fixed !important;
  bottom: 0 !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 99999 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  pointer-events: none;
  font-size: 15px;
  line-height: 1.4;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-sizing: border-box;
}

/* Reset only critical inherited properties that commonly interfere */
#aether-widget-container *,
#aether-widget-container *::before,
#aether-widget-container *::after {
  box-sizing: border-box !important;
}

#aether-widget-container > * {
  pointer-events: auto !important;
}

/* Launcher Button - Modern Design */
#aether-launcher {
  width: 56px;
  height: 56px;
  min-width: 56px;
  min-height: 56px;
  border-radius: 50% !important;
  background: linear-gradient(135deg, var(--aether-brand-color), color-mix(in srgb, var(--aether-brand-color), black 15%)) !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2), 0 0 0 0 rgba(0,0,0,0) !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  border: none !important;
  color: white !important;
  position: fixed !important;
  bottom: 24px !important;
  right: 24px !important;
  z-index: 99999 !important;
  overflow: hidden !important;
  visibility: visible !important;
  opacity: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
  -webkit-tap-highlight-color: transparent !important;
  touch-action: manipulation !important;
}

#aether-launcher:hover {
  box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 0 rgba(0,0,0,0) !important;
  transform: scale(1.05) !important;
}

#aether-widget-container[data-position="left"] #aether-launcher {
  right: auto;
  left: 24px;
}

body.aether-chat-open #aether-launcher {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

#aether-launcher:active {
  transform: scale(0.95);
}

#aether-launcher svg {
  width: 28px;
  height: 28px;
  transition: transform 0.3s ease;
  position: relative;
  z-index: 1;
}

/* Window - Modern Design (Mobile Full Screen, Desktop Rounded) */
#aether-window {
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  background: var(--aether-bg-color);
  border-radius: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
  opacity: 0;
  transform: translateY(100%);
  transform-origin: bottom;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  visibility: hidden;
  position: fixed;
  bottom: 0;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99998;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#aether-window.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
  visibility: visible;
}

/* Header - Modern Design */
.aether-header {
  padding: 16px;
  padding-top: calc(16px + env(safe-area-inset-top, 0px));
  padding-bottom: 16px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  -webkit-tap-highlight-color: transparent;
  margin: 0;
  border: none;
  box-sizing: border-box;
}

.aether-header-icon {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 10px;
  background: var(--aether-brand-color) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white !important;
  flex-shrink: 0;
  touch-action: manipulation;
}

.aether-header-icon svg {
  width: 20px;
  height: 20px;
  display: block;
}

.aether-header-image {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.aether-header-content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 2;
}

.aether-title {
  font-weight: 700;
  font-size: 18px;
  position: relative;
  z-index: 1;
  letter-spacing: -0.02em;
  color: white;
  line-height: 1.2;
}

.aether-subtitle {
  font-size: 13px;
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  position: relative;
  z-index: 1;
  color: white;
  line-height: 1.3;
}

.aether-close-window-btn {
  width: var(--aether-touch-target);
  height: var(--aether-touch-target);
  min-width: var(--aether-touch-target);
  min-height: var(--aether-touch-target);
  border-radius: 50%;
  background: transparent;
  border: none;
  color: white;
  display: flex !important;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative !important;
  z-index: 20 !important;
  margin: 0 !important;
  padding: 0 !important;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.aether-close-window-btn:active {
  background: rgba(255,255,255,0.15);
  transform: scale(0.95);
}

.aether-close-window-btn svg {
  width: 20px;
  height: 20px;
  display: block;
}

/* Content Area - Mobile First */
.aether-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--aether-bg-color);
  min-height: 0;
  margin: 0;
  padding: 0;
  border: none;
  box-sizing: border-box;
}

/* Messages - Mobile First */
.aether-messages {
  flex: 1;
  padding: var(--aether-spacing-md) var(--aether-spacing-sm);
  padding-bottom: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--aether-spacing-sm);
  scroll-behavior: smooth;
  background: var(--aether-bg-color);
  position: relative;
  -webkit-overflow-scrolling: touch;
  margin: 0;
  border: none;
  box-sizing: border-box;
}

.aether-messages::-webkit-scrollbar {
  width: 4px;
}

.aether-messages::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.2);
  border-radius: 2px;
}

/* Welcome Container - Mobile First */
.aether-welcome-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--aether-spacing-xl) var(--aether-spacing-md);
  text-align: center;
  min-height: 250px;
  width: 100%;
}

.aether-sparkle-icon {
  width: 64px;
  height: 64px;
  margin-bottom: var(--aether-spacing-md);
  color: var(--aether-brand-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.aether-sparkle-icon svg {
  width: 40px;
  height: 40px;
  display: block;
}

.aether-welcome-message {
  font-size: 16px;
  color: #71717a;
  line-height: 1.5;
  margin-bottom: var(--aether-spacing-lg);
  max-width: 100%;
  padding: 0 var(--aether-spacing-md);
}

.aether-quick-actions {
  display: flex;
  gap: var(--aether-spacing-xs);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--aether-spacing-xs);
  width: 100%;
  padding: 0 var(--aether-spacing-md);
}

.aether-quick-action-btn {
  padding: var(--aether-spacing-sm) var(--aether-spacing-md);
  min-height: var(--aether-touch-target);
  background: white;
  border: 1px solid rgba(0,0,0,0.1);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  color: var(--aether-text-color);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

.aether-quick-action-btn:active {
  background: #f9fafb;
  transform: scale(0.98);
  box-shadow: 0 1px 1px rgba(0,0,0,0.05);
}

/* Message Bubbles - Mobile First (Native Style) */
.aether-msg {
  max-width: 85%;
  padding: var(--aether-spacing-sm) var(--aether-spacing-md);
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.4;
  position: relative;
  word-wrap: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  animation: messageSlideIn 0.25s ease-out;
  white-space: pre-wrap;
  -webkit-tap-highlight-color: transparent;
  margin: 0;
  box-sizing: border-box;
}

@keyframes messageSlideIn {
  from { 
    opacity: 0; 
    transform: translateY(8px) scale(0.96); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0) scale(1); 
  }
}

.aether-msg.bot {
  background: hsl(var(--muted, 210 40% 96.1%));
  color: hsl(var(--foreground, 222.2 84% 4.9%));
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  align-self: flex-start;
  border: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.aether-msg.user {
  background: var(--aether-brand-color) !important;
  color: white !important;
  align-self: flex-end;
  border-radius: 12px;
  border-bottom-right-radius: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

@media (prefers-color-scheme: dark) {
  .aether-msg.bot {
    background: var(--aether-bot-msg-bg);
    color: var(--aether-bot-msg-text);
  }
}

/* Action Cards */
.aether-action-card {
  margin-top: var(--aether-spacing-sm);
  padding: var(--aether-spacing-md);
  background: rgba(255,255,255,0.05);
  border-radius: 16px;
  border: 1px solid var(--aether-border-color);
  max-width: 90%;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translateY(10px); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

.aether-action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--aether-spacing-sm) var(--aether-spacing-md);
  min-height: var(--aether-touch-target);
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 15px;
  text-decoration: none;
  transition: all 0.2s;
  margin-top: var(--aether-spacing-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.aether-action-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.aether-action-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

/* Typing Indicator */
.aether-typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--aether-spacing-md) var(--aether-spacing-md);
  background: var(--aether-bot-msg-bg);
  border-radius: 20px;
  border-bottom-left-radius: 4px;
  max-width: fit-content;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.aether-typing-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--aether-bot-msg-text);
  opacity: 0.5;
  animation: typingBounce 1.4s ease-in-out infinite;
  transform-origin: center;
}

.aether-typing-dot:nth-child(1) { animation-delay: 0s; }
.aether-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.aether-typing-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typingBounce {
  0%, 60%, 100% {
    opacity: 0.4;
    transform: translateY(0) scale(1);
  }
  30% {
    opacity: 1;
    transform: translateY(-6px) scale(1.1);
  }
}

/* Input Area - Mobile First */
/* Input Area - Mobile First */
.aether-input-area {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--aether-spacing-md) var(--aether-spacing-md);
  padding-bottom: calc(var(--aether-spacing-md) + max(env(safe-area-inset-bottom, 0px), 30px));
  background: var(--aether-bg-color);
  border-top: 1px solid var(--aether-border-color);
  z-index: 1000;
  transition: bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: bottom;
  min-height: 80px;
  box-sizing: border-box;
  margin: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
  display: block;
}

/* Increase bottom padding on mobile devices for better keyboard handling */
@media (max-width: 768px) {
  .aether-input-area {
    padding-bottom: calc(var(--aether-spacing-md) + max(env(safe-area-inset-bottom, 0px), 40px));
  }
}

/* Extra padding for very small screens */
@media (max-width: 480px) {
  .aether-input-area {
    padding-bottom: calc(var(--aether-spacing-md) + max(env(safe-area-inset-bottom, 0px), 50px));
  }
}

.aether-input-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
}

.aether-image-btn {
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
  background: hsl(var(--background, 0 0% 100%));
  color: hsl(var(--foreground, 222.2 84% 4.9%));
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  margin: 0 !important;
  padding: 0 !important;
  align-self: flex-end;
  margin-bottom: 0 !important;
}

.aether-image-btn:hover {
  background: hsl(var(--accent, 210 40% 96.1%));
  border-color: hsl(var(--border, 214.3 31.8% 91.4%));
}

.aether-image-btn:active {
  background: var(--aether-border-color);
  transform: scale(0.95);
}

.aether-image-btn svg {
  width: 20px;
  height: 20px;
  display: block;
}

.aether-image-input {
  display: none;
}

.aether-image-preview {
  margin-top: var(--aether-spacing-xs);
  padding: var(--aether-spacing-xs);
  background: var(--aether-secondary-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: var(--aether-spacing-xs);
  max-width: 200px;
}

.aether-image-preview img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 8px;
}

.aether-image-preview button {
  background: transparent;
  border: none;
  color: var(--aether-text-color);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  min-width: var(--aether-touch-target);
  min-height: var(--aether-touch-target);
  opacity: 0.6;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.aether-image-preview button:active {
  opacity: 1;
}

/* Input Field - Modern Design */
.aether-input {
  flex: 1;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
  background: hsl(var(--background, 0 0% 100%));
  color: hsl(var(--foreground, 222.2 84% 4.9%)) !important;
  outline: none;
  font-size: 15px;
  font-family: inherit;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 48px;
  max-height: 120px;
  line-height: 1.5;
  -webkit-appearance: none;
  appearance: none;
  overflow-y: hidden; /* Hide scrollbar by default */
  margin: 0;
  box-sizing: border-box;
  width: auto;
  resize: none;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Hide scrollbar on mobile until needed (4+ lines) */
.aether-input::-webkit-scrollbar {
  display: none; /* Hide scrollbar for Chrome, Safari, Edge */
  width: 0;
  height: 0;
}

.aether-input {
  -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
  scrollbar-width: none; /* Hide scrollbar for Firefox */
}

/* Show scrollbar when content exceeds 4 lines (approximately 84px) */
.aether-input.show-scrollbar {
  overflow-y: auto;
}

.aether-input.show-scrollbar::-webkit-scrollbar {
  display: block;
  width: 4px;
}

.aether-input.show-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
}

.aether-input.show-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.aether-input::placeholder {
  color: var(--aether-text-color);
  opacity: 0.5;
}

[data-theme="dark"] .aether-input,
.aether-input[data-theme="dark"] {
  color: var(--aether-text-color) !important;
}

.aether-input:focus {
  border-color: var(--aether-brand-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--aether-brand-color) 10%, transparent);
  background: var(--aether-bg-color);
}

/* Send Button - Modern Design */
.aether-send-btn {
  width: 48px;
  height: 48px;
  min-width: 48px;
  min-height: 48px;
  border-radius: 12px;
  background: var(--aether-brand-color);
  color: white;
  border: none;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  position: relative;
  z-index: 1;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  margin: 0 !important;
  padding: 0 !important;
  align-self: flex-end;
  margin-bottom: 0 !important;
}

.aether-send-btn svg {
  width: 24px !important;
  height: 24px !important;
  stroke-width: 2.5;
  display: block;
  flex-shrink: 0;
}

.aether-send-btn:active:not(:disabled) {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  opacity: 0.9;
}

.aether-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: scale(1);
}

/* Lead Form */
#aether-lead-form {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--aether-bg-color);
  z-index: 10;
  padding: var(--aether-spacing-xl) var(--aether-spacing-md);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--aether-spacing-lg);
  text-align: center;
  margin: 0;
  border: none;
  box-sizing: border-box;
}

.aether-form-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--aether-text-color);
  margin-bottom: var(--aether-spacing-xs);
  margin-top: 0;
  margin-left: 0;
  margin-right: 0;
  letter-spacing: -0.02em;
  font-family: inherit;
  line-height: 1.2;
  text-align: center;
  box-sizing: border-box;
  display: block;
  padding: 0;
  border: none;
  background: transparent;
}

.aether-form-desc {
  font-size: 15px;
  color: #71717a;
  margin-bottom: var(--aether-spacing-lg);
  margin-top: 0;
  margin-left: 0;
  margin-right: 0;
  line-height: 1.5;
  font-family: inherit;
  text-align: center;
  box-sizing: border-box;
  display: block;
  padding: 0;
  border: none;
  background: transparent;
}

.aether-form-group {
  text-align: left;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  box-sizing: border-box;
  display: block;
}

.aether-form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: var(--aether-spacing-xs);
  margin-top: 0;
  margin-left: var(--aether-spacing-xs);
  margin-right: 0;
  color: var(--aether-text-color);
  font-family: inherit;
  line-height: inherit;
  text-align: left;
  box-sizing: border-box;
  padding: 0;
  border: none;
  background: transparent;
}

/* Make form inputs full width */
#aether-lead-form .aether-input {
  width: 100%;
  box-sizing: border-box;
}

.aether-btn {
  width: 100%;
  padding: var(--aether-spacing-md);
  min-height: var(--aether-touch-target);
  border-radius: 16px;
  background: var(--aether-brand-color) !important;
  color: white !important;
  border: none !important;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
  margin-top: var(--aether-spacing-sm);
  margin-left: 0;
  margin-right: 0;
  margin-bottom: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  font-family: inherit;
  line-height: inherit;
  text-align: center;
  outline: none;
  box-sizing: border-box;
  display: block;
}

.aether-btn:active {
  opacity: 0.95;
  transform: scale(0.98);
}

/* Input error styles */
.aether-form-error {
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.25rem;
  display: block;
}

.aether-input-error-border {
  border-color: #ef4444 !important;
}

/* Date separator styles */
.aether-date-separator {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1.5rem 0;
  color: var(--aether-text-color);
  opacity: 0.6;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.aether-date-separator::before,
.aether-date-separator::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--aether-border-color);
  opacity: 0.3;
}

.aether-date-separator:not(:empty)::before {
  margin-right: 0.75rem;
}

.aether-date-separator:not(:empty)::after {
  margin-left: 0.75rem;
}

/* Markdown rendering styles */
.aether-msg code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 0.9em;
}

.aether-inline-code {
  background: rgba(0, 0, 0, 0.08);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  color: #e83e8c;
}

[data-theme="dark"] .aether-inline-code,
.aether-msg[data-theme="dark"] .aether-inline-code {
  background: rgba(255, 255, 255, 0.1);
  color: #f78fb3;
}

.aether-code-block {
  display: block;
  background: rgba(0, 0, 0, 0.05);
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75em 0;
  font-size: 0.85em;
  line-height: 1.5;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] .aether-code-block,
.aether-msg[data-theme="dark"] .aether-code-block {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e9ecef;
}

.aether-msg pre {
  margin: 0.75em 0;
  overflow-x: auto;
}

.aether-msg pre code {
  display: block;
  padding: 0;
  background: transparent;
  border: none;
}

.aether-msg strong {
  font-weight: 600;
  color: inherit;
}

.aether-msg em {
  font-style: italic;
  color: inherit;
}

.aether-msg .aether-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.9;
  transition: opacity 0.2s;
}

.aether-msg .aether-link:hover {
  opacity: 1;
}

.aether-msg .aether-h1,
.aether-msg .aether-h2,
.aether-msg .aether-h3,
.aether-msg .aether-h4,
.aether-msg .aether-h5,
.aether-msg .aether-h6 {
  font-weight: 600;
  margin: 0.75em 0 0.5em 0;
  line-height: 1.3;
  color: inherit;
}

.aether-msg .aether-h1 {
  font-size: 1.5em;
}

.aether-msg .aether-h2 {
  font-size: 1.3em;
}

.aether-msg .aether-h3 {
  font-size: 1.15em;
}

.aether-msg .aether-h4 {
  font-size: 1.05em;
}

.aether-msg .aether-h5,
.aether-msg .aether-h6 {
  font-size: 1em;
}

.aether-msg .aether-blockquote {
  border-left: 3px solid rgba(0, 0, 0, 0.2);
  padding-left: 1em;
  margin: 0.75em 0;
  padding-top: 0.5em;
  padding-bottom: 0.5em;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  font-style: italic;
  opacity: 0.9;
}

[data-theme="dark"] .aether-blockquote,
.aether-msg[data-theme="dark"] .aether-blockquote {
  border-left-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.03);
}

.aether-msg .aether-hr {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.2);
  margin: 1em 0;
  height: 1px;
}

[data-theme="dark"] .aether-hr,
.aether-msg[data-theme="dark"] .aether-hr {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.aether-msg .aether-unordered-list,
.aether-msg .aether-ordered-list {
  margin: 0.75em 0;
  padding-left: 1.5em;
  line-height: 1.6;
}

.aether-msg .aether-unordered-list {
  list-style-type: disc;
}

.aether-msg .aether-ordered-list {
  list-style-type: decimal;
}

.aether-msg .aether-list-item {
  margin: 0.25em 0;
  padding-left: 0.25em;
}

.aether-msg .aether-list-item::marker {
  color: inherit;
  opacity: 0.7;
}

/* Nested lists */
.aether-msg .aether-list-item .aether-unordered-list,
.aether-msg .aether-list-item .aether-ordered-list {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* ============================================
   DESKTOP ENHANCEMENTS (min-width: 641px)
   ============================================ */

@media (min-width: 641px) {
  #aether-widget-container {
    bottom: 0;
    top: auto;
    left: auto;
    right: 0;
  }

  #aether-widget-container[data-position="left"] {
    right: auto;
    left: 0;
  }

  #aether-launcher {
    width: 64px;
    height: 64px;
    bottom: 24px !important;
    right: 24px !important;
  }

  #aether-widget-container[data-position="left"] #aether-launcher {
    left: 24px;
    right: auto;
  }

  #aether-launcher:hover {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 12px 48px rgba(0,0,0,0.4), 0 0 0 4px rgba(99, 102, 241, 0.2);
  }

  #aether-window {
    width: 400px;
    height: 700px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 120px);
    border-radius: 24px;
    box-shadow: 0 24px 48px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
    border: 1px solid var(--aether-border-color);
    transform: translateY(20px) scale(0.95);
    transform-origin: bottom right;
    position: fixed !important;
    bottom: 100px !important;
    top: auto !important;
    right: 24px !important;
    left: auto !important;
  }

  #aether-widget-container[data-position="left"] #aether-window {
    transform-origin: bottom left;
    right: auto !important;
    left: 24px !important;
  }

  #aether-window.open {
    transform: translateY(0) scale(1);
  }

  .aether-header {
    padding: var(--aether-spacing-lg) var(--aether-spacing-lg);
    padding-top: var(--aether-spacing-lg);
    border-radius: 24px 24px 0 0;
  }

  .aether-messages {
    padding: var(--aether-spacing-lg) var(--aether-spacing-md);
    padding-bottom: 100px;
  }

  .aether-msg {
    max-width: 75%;
  }

  .aether-input-area {
    position: relative;
    padding: var(--aether-spacing-md);
    padding-bottom: var(--aether-spacing-md);
    border-radius: 0 0 24px 24px;
  }

  .aether-quick-action-btn:hover {
    background: #f9fafb;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .aether-send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }

  .aether-btn:hover {
    opacity: 0.95;
    transform: translateY(-1px);
  }

  /* Lightbox styles - Full screen on all devices */
  /* Ensure lightbox is not affected by widget container */
  body > #aether-lightbox {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    width: 100dvw !important;
    height: 100vh !important;
    height: 100dvh !important;
    min-width: 100vw !important;
    min-width: 100dvw !important;
    min-height: 100vh !important;
    min-height: 100dvh !important;
    max-width: 100vw !important;
    max-width: 100dvw !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
    z-index: 999999 !important;
    display: none !important; /* Hidden by default */
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    transform: translateZ(0) !important; /* Force hardware acceleration */
    -webkit-transform: translateZ(0) !important;
    will-change: transform !important;
    isolation: isolate !important; /* Create new stacking context */
  }
  
  /* Fallback selector */
  #aether-lightbox {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    width: 100dvw !important;
    height: 100vh !important;
    height: 100dvh !important;
    min-width: 100vw !important;
    min-width: 100dvw !important;
    min-height: 100vh !important;
    min-height: 100dvh !important;
    max-width: 100vw !important;
    max-width: 100dvw !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
    z-index: 999999 !important;
    display: none !important;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    transform: translateZ(0) !important;
    -webkit-transform: translateZ(0) !important;
    will-change: transform !important;
    isolation: isolate !important;
  }

  /* Lightbox visible state */
  body > #aether-lightbox[style*="display: flex"],
  body > #aether-lightbox[style*="display:flex"],
  #aether-lightbox[style*="display: flex"],
  #aether-lightbox[style*="display:flex"] {
    display: flex !important;
  }

  .aether-lightbox-backdrop {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    background: #000000 !important;
    backdrop-filter: blur(8px);
    margin: 0 !important;
    padding: 0 !important;
  }

  .aether-lightbox-content {
    position: relative !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 100% !important;
    min-height: 100% !important;
    display: flex !important;
    align-items: center;
    justify-content: center;
    z-index: 1;
    padding: 0 !important;
    margin: 0 !important;
    box-sizing: border-box !important;
  }

  .aether-lightbox-content img {
    width: 100% !important;
    height: 100% !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    max-height: 100dvh !important;
    object-fit: contain !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
  }

  .aether-lightbox-close {
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    background: rgba(0, 0, 0, 0.6) !important;
    border: 2px solid rgba(255, 255, 255, 0.3) !important;
    border-radius: 50% !important;
    width: 48px !important;
    height: 48px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    cursor: pointer !important;
    color: white !important;
    transition: all 0.2s;
    z-index: 1000000 !important;
    backdrop-filter: blur(10px);
    pointer-events: auto !important;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1) inset !important;
  }

  .aether-lightbox-close:hover {
    background: rgba(0, 0, 0, 0.8) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.2) inset !important;
  }

  .aether-lightbox-close:active {
    background: rgba(0, 0, 0, 0.9) !important;
    transform: scale(0.95);
  }

  .aether-lightbox-close svg {
    width: 24px !important;
    height: 24px !important;
    stroke-width: 2.5 !important;
    stroke: white !important;
    pointer-events: none !important;
  }

  .aether-clickable-image {
    transition: opacity 0.2s;
    cursor: pointer;
    -webkit-tap-highlight-color: rgba(255, 255, 255, 0.1);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  .aether-clickable-image:hover {
    opacity: 0.9;
  }

  .aether-clickable-image:active {
    opacity: 0.8;
  }

  /* Mobile-specific lightbox adjustments */
  @media (max-width: 640px) {
    #aether-lightbox {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      width: 100dvw !important;
      width: -webkit-fill-available !important;
      height: 100vh !important;
      height: 100dvh !important;
      height: -webkit-fill-available !important;
      min-width: 100vw !important;
      min-width: 100dvw !important;
      min-width: -webkit-fill-available !important;
      min-height: 100vh !important;
      min-height: 100dvh !important;
      min-height: -webkit-fill-available !important;
      max-width: 100vw !important;
      max-width: 100dvw !important;
      max-width: -webkit-fill-available !important;
      max-height: 100vh !important;
      max-height: 100dvh !important;
      max-height: -webkit-fill-available !important;
      z-index: 999999 !important;
      transform: translateZ(0) !important;
      -webkit-transform: translateZ(0) !important;
    }

    .aether-lightbox-content {
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
      padding: 0 !important;
    }

    .aether-lightbox-content img {
      width: 100% !important;
      height: 100% !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      max-height: 100dvh !important;
      object-fit: contain !important;
    }

    .aether-lightbox-close {
      top: 16px !important;
      right: 16px !important;
      width: 44px !important;
      height: 44px !important;
      background: rgba(0, 0, 0, 0.7) !important;
      border: 2px solid rgba(255, 255, 255, 0.4) !important;
      z-index: 1000000 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1) inset !important;
    }

    .aether-lightbox-close svg {
      width: 22px !important;
      height: 22px !important;
      stroke: white !important;
      pointer-events: none !important;
    }
  }

  .aether-image-btn:hover {
    background: var(--aether-border-color);
    transform: scale(1.05);
  }

  .aether-close-window-btn:hover {
    background: rgba(255,255,255,0.1);
    transform: scale(1.1);
  }

  .aether-department-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .aether-department-btn {
    width: 100% !important;
    padding: 12px 16px !important;
    background: rgba(255,255,255,0.05) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-radius: 8px !important;
    color: white !important;
    text-align: left !important;
    cursor: pointer !important;
    transition: all 0.2s !important;
    font-size: 14px !important;
    font-weight: 500 !important;
  }

  .aether-department-btn:hover {
    background: rgba(255,255,255,0.1) !important;
    border-color: rgba(99,102,241,0.5) !important;
    transform: translateY(-1px) !important;
  }

  .aether-department-btn[data-selected="true"] {
    background: rgba(99,102,241,0.2) !important;
    border-color: rgba(99,102,241,0.5) !important;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.1) !important;
  }
}
`;
};
