# Interactive AR Windows Feature

This enhancement adds full interactivity to AR windows, allowing users to click and interact with content inside AR windows as if they were regular web pages.

## Features

### 1. Interactive HTML Content
- Click detection on AR windows
- Real-time interaction with buttons, inputs, and links
- Content updates after interactions

### 2. Iframe Support
- Load full web pages in AR windows
- Interactive overlay for cross-origin content
- Modal interaction mode for complex web pages

### 3. Easy URL Input
- Simple button to add web pages
- URL prompt dialog
- Automatic window creation

## How to Use

### Creating AR Windows

1. **From UI**: Click the "Add Web Page to AR" or "+ Web Window" button
2. **Programmatically**: Use the exposed global functions:
   ```javascript
   // HTML content
   window.createARHTMLWindow('<h1>Hello AR!</h1>');
   
   // Web page URL
   window.createARIframeWindow('https://www.google.com');
   
   // Prompt for URL
   window.createARWindowFromURL();
   ```

### Interacting with Windows

1. **Click on content**: Click directly on buttons, links, or interactive elements
2. **Iframe interaction**: Click on iframe content to open interactive overlay
3. **Close windows**: Click the X button in the title bar

### Testing Interactive Content

Use the sample interactive content at `/sample-interactive-content.html` which includes:
- Click counter
- Text input
- Color changer
- External links
- Live time display

## Technical Implementation

### Click Detection
- Uses Three.js raycasting to convert 3D clicks to 2D coordinates
- Maps UV coordinates to pixel positions
- Dispatches synthetic mouse events

### Content Rendering
- HTML content: Uses html2canvas for rendering
- Iframe content: Creates blob URLs for same-origin content
- Interactive overlay: Modal system for cross-origin iframes

### Performance
- Efficient raycasting with object filtering
- Minimal re-renders with useCallback hooks
- Texture updates only when needed

## Browser Compatibility

- Chrome/Edge: Full AR and WebXR support
- Firefox: Limited AR support
- Safari: WebXR not supported (fallback to regular 3D)

## Security Considerations

- Cross-origin iframe limitations handled with overlay system
- Blob URLs for safe HTML rendering
- Proper cleanup of event listeners and DOM elements
