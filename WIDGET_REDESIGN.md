# Widget Redesign Plan

## Overview
Redesigning the chat widget to match the modern expandable-chat component aesthetic while maintaining vanilla JS compatibility for embedding.

## Key Design Changes

### 1. Launcher Button
- Modern rounded button (56px → 56px, fully rounded)
- Better shadow: `0 4px 16px rgba(0,0,0,0.2)`
- Smooth hover/active states
- Icon: MessageCircle from lucide-react style

### 2. Chat Window
- Desktop: Rounded corners (rounded-lg), max-width constraints
- Mobile: Full screen (maintain current behavior)
- Modern shadow: `0 24px 48px -12px rgba(0,0,0,0.5)`
- Smooth animations

### 3. Header
- Cleaner design with better spacing
- Modern typography
- Better icon styling

### 4. Message Bubbles
- Rounded-lg corners
- Better spacing between messages
- Modern color scheme
- Avatar support (optional)

### 5. Input Area
- Rounded input field
- Modern button styling
- Better spacing

### 6. Color Scheme
- Use modern color palette
- Better contrast
- Support for light/dark themes

## Implementation Notes
- Keep all existing functionality
- Maintain vanilla JS structure
- Update CSS to match new design
- Preserve mobile-first approach
- Keep all animations smooth

