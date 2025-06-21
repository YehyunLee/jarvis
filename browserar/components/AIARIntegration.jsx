import React, { useEffect } from 'react';
import { useLiveAPIContext } from '../jarvis/src/contexts/LiveAPIContext';
import AIARBridge from '../lib/ai-ar-bridge';

/**
 * Component to integrate AI speech responses with AR window creation
 * Place this component in your Jarvis app to enable AR visualization
 */
export function AIARIntegration() {
  const { client } = useLiveAPIContext();

  useEffect(() => {
    if (!client) return;

    const bridge = new AIARBridge();
    
    // Connect the bridge to the Jarvis client
    bridge.connectToJarvis(client);

    // Enhanced tool call handler for HTML responses
    const handleToolCall = (toolCall) => {
      if (!toolCall.functionCalls) return;      toolCall.functionCalls.forEach((fc) => {
        if (fc.name === 'render_html_file' && fc.args && fc.args.html_file) {
          console.log('AI-AR Integration: Creating AR window for HTML response');
          bridge.createARWindow(fc.args.html_file, { title: 'AI Visualization' });
        }
      });
    };

    // Enhanced content handler for text responses
    const handleContent = (data) => {
      if (!data.serverContent || !data.serverContent.modelTurn) return;

      const parts = data.serverContent.modelTurn.parts || [];      parts.forEach((part) => {
        if (part.text) {
          console.log('AI-AR Integration: Creating AR window for text response');
          // Check if text contains HTML
          if (part.text.includes('<') && part.text.includes('>')) {
            bridge.createARWindow(part.text, { title: 'AI HTML Response' });
          } else {
            bridge.handleTextResponse(part.text, { title: 'AI Response' });
          }
        }
      });
    };

    // Register event handlers
    client.on('toolcall', handleToolCall);
    client.on('content', handleContent);

    // Cleanup
    return () => {
      client.off('toolcall', handleToolCall);
      client.off('content', handleContent);
      bridge.disconnectFromJarvis(client);
    };
  }, [client]);

  // This component doesn't render anything visible
  return null;
}

export default AIARIntegration;
