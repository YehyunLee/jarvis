# AI Speech to AR Windows Integration Guide

This guide shows how to connect the Jarvis AI speech functionality with your AR browser to automatically create AR windows from AI responses.

## Overview

The integration allows AI speech responses (both HTML visualizations and text) to automatically appear as floating windows in AR space.

## Files Created

1. `lib/ai-ar-bridge.js` - Core bridge functionality
2. `components/AIARIntegration.jsx` - React integration component  
3. `components/AltairAREnabled.tsx` - Modified Altair component for Jarvis

## Setup Instructions

### 1. In your AR Browser project

Your AR browser is already set up! The following functions are now available globally:

- `window.createARWindowFromAI(htmlContent, title)` - Creates AR window from AI HTML
- `window.handleAIResponse(textContent)` - Creates AR window from AI text

### 2. In your Jarvis project

Add this to your main App component (or where you want AI-AR integration):

```jsx
// Import the bridge
import { AIARBridge } from '../browserar/lib/ai-ar-bridge.js';

// In your component:
function YourComponent() {
  const { client } = useLiveAPIContext();
  
  useEffect(() => {
    if (!client) return;
    
    const bridge = new AIARBridge();
    bridge.connectToJarvis(client);
    
    return () => bridge.disconnectFromJarvis(client);
  }, [client]);
  
  // ... rest of your component
}
```

### 3. Modify the Altair component

Replace the existing `onToolCall` handler in `src/components/altair/Altair.tsx`:

```tsx
const onToolCall = (toolCall: LiveServerToolCall) => {
  if (!toolCall.functionCalls) return;
  
  const fc = toolCall.functionCalls.find(
    (fc) => fc.name === declaration.name
  );
  
  if (fc) {
    const str = (fc.args as any).html_file;
    setHtmlString(str);
    
    // Send to AR browser
    if (typeof window !== 'undefined' && (window as any).createARWindowFromAI) {
      (window as any).createARWindowFromAI(str, 'AI Visualization');
    }
  }
  
  // ... rest of function
};
```

### 4. Also handle text responses

Add this to your component where you have the Live API client:

```tsx
useEffect(() => {
  const onContent = (data: any) => {
    if (data.serverContent && data.serverContent.modelTurn) {
      const parts = data.serverContent.modelTurn.parts || [];
      parts.forEach((part: any) => {
        if (part.text && typeof window !== 'undefined' && (window as any).handleAIResponse) {
          (window as any).handleAIResponse(part.text);
        }
      });
    }
  };
  
  client.on("content", onContent);
  return () => client.off("content", onContent);
}, [client]);
```

## Usage

1. Start your AR browser (`npm run dev` in browserar folder)
2. Start Jarvis (`npm start` in jarvis folder)
3. Open AR browser in one tab, Jarvis in another
4. In AR browser, enter AR mode
5. In Jarvis, click the play button to start speech
6. Ask for visualizations like:
   - "Create a bar chart showing sales data"
   - "Make an interactive dashboard"
   - "Show me a graph of stock prices"
   - "Create a data visualization"

## How it Works

1. User speaks to Jarvis AI
2. AI generates HTML content or text response
3. Bridge detects the response
4. AR browser receives the content via `window.createARWindowFromAI()`
5. New AR window appears with the AI content

## Example AI Prompts

Try these with the speech interface:

- "Create a colorful bar chart with sample data"
- "Make an interactive pie chart showing market segments"  
- "Show me a dashboard with multiple charts"
- "Create a data table with styling"
- "Make an animated graph"

## Troubleshooting

1. **AR windows not appearing**: Check browser console for "AR Browser not connected" messages
2. **Functions not found**: Make sure AR browser is loaded first
3. **No AI responses**: Check Jarvis API key configuration
4. **HTML not rendering**: Check browser console for HTML parsing errors

## Testing the Integration

### Quick Test
1. Load the AR browser (`npm run dev` in the browserar folder)
2. Enter AR mode
3. Click "🎤 Start AI Speech" button
4. Watch as demo AI responses appear as floating AR windows!

### Connect to Real Jarvis AI
The system is designed to automatically capture AI speech output and display it in AR:

```javascript
// The AI speech system should call this to display content in AR:
if (window.createARWindowFromAI) {
  // For HTML content
  await window.createARWindowFromAI('<div>HTML from AI</div>', {
    title: 'AI Generated Content',
    position: { x: 0, y: 0, z: -3 }
  });
  
  // For plain text
  await window.handleAIResponse('Text response from AI');
}
```

## Auto-Integration Features

The system now includes:
- ✅ **Automatic HTML detection** - Detects if AI output is HTML or plain text
- ✅ **Styled text wrapping** - Plain text gets beautiful AR-friendly styling
- ✅ **Error handling** - Graceful fallbacks if content can't be displayed
- ✅ **Multiple content types** - Supports HTML, text, and mixed content
- ✅ **Position randomization** - Windows appear in different locations
- ✅ **Interactive elements** - Buttons, inputs, and forms work in AR
- ✅ **Global accessibility** - Functions available to any external script

Enjoy your AI-powered AR visualizations! 🚀
