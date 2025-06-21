/**
 * Bridge component to connect AI speech responses to AR window creation
 * This can be imported and used in the Jarvis project
 */

export class AIARBridge {
  constructor() {
    this.isInitialized = false;
    this.checkForARBrowser();
  }

  checkForARBrowser() {
    // Check if AR browser functions are available
    if (typeof window !== 'undefined' && window.createARWindowFromAI) {
      this.isInitialized = true;
      console.log('AI-AR Bridge: Connected to AR Browser');
    } else {
      console.warn('AI-AR Bridge: AR Browser not found');
    }
  }
  /**
   * Handle AI response and create AR window
   * @param {string} content - HTML content from AI response
   * @param {object} options - Window options (title, position, etc.)
   */
  async createARWindow(content, options = {}) {
    if (!this.isInitialized) {
      console.warn('AI-AR Bridge: AR Browser not available');
      return false;
    }

    try {
      const window = await window.createARWindowFromAI(content, options);
      return window;
    } catch (error) {
      console.error('AI-AR Bridge: Error creating AR window:', error);
      return false;
    }
  }
  /**
   * Handle simple text responses from AI
   * @param {string} text - Plain text response
   * @param {object} options - Window options
   */
  async handleTextResponse(text, options = {}) {
    if (!this.isInitialized) {
      console.warn('AI-AR Bridge: AR Browser not available');
      return false;
    }

    try {
      const window = await window.handleAIResponse(text, options);
      return window;
    } catch (error) {
      console.error('AI-AR Bridge: Error handling text response:', error);
      return false;
    }
  }

  /**
   * Connect to Jarvis Live API events
   * @param {object} client - Jarvis Live API client
   */
  connectToJarvis(client) {
    if (!client) {
      console.error('AI-AR Bridge: No client provided');
      return;
    }    // Listen for tool calls (HTML generation)
    client.on('toolcall', (toolCall) => {
      if (toolCall.functionCalls) {
        toolCall.functionCalls.forEach((fc) => {
          if (fc.name === 'render_html_file' && fc.args && fc.args.html_file) {
            this.createARWindow(fc.args.html_file, { title: 'AI Visualization' });
          }
        });
      }
    });

    // Listen for content responses (text and HTML)
    client.on('content', (data) => {
      if (data.serverContent && data.serverContent.modelTurn) {
        const parts = data.serverContent.modelTurn.parts || [];
        parts.forEach((part) => {
          if (part.text) {
            // Check if text contains HTML
            if (part.text.includes('<') && part.text.includes('>')) {
              this.createARWindow(part.text, { title: 'AI HTML Response' });
            } else {
              this.handleTextResponse(part.text, { title: 'AI Response' });
            }
          }
        });
      }
    });

    console.log('AI-AR Bridge: Connected to Jarvis Live API');
  }

  /**
   * Disconnect from Jarvis Live API events
   * @param {object} client - Jarvis Live API client
   */
  disconnectFromJarvis(client) {
    if (client && typeof client.off === 'function') {
      client.off('toolcall');
      client.off('content');
      console.log('AI-AR Bridge: Disconnected from Jarvis Live API');
    }
  }
}

// React hook for easy integration
export function useAIARBridge(client) {
  const [bridge] = useState(() => new AIARBridge());

  useEffect(() => {
    if (client) {
      bridge.connectToJarvis(client);
      return () => bridge.disconnectFromJarvis(client);
    }
  }, [client, bridge]);

  return bridge;
}

// Default export
export default AIARBridge;
