/**
 * Modified Altair component that sends HTML responses to AR browser
 * Replace the existing Altair.tsx in the Jarvis project with this version
 */

import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

const declaration = {
  name: "render_html_file",
  description:
    "Displays a full HTML file as a string in AR space. The HTML can contain any visualization or content helpful to the discussion. Ensure the visuals are easy to understand and visually impressive.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      html_file: {
        type: Type.STRING,
        description: "A valid, complete HTML file as a string. Must include proper HTML structure with styling.",
      },
    },
    required: ["html_file"],
  },
};

function AltairComponent() {
  const [htmlString, setHtmlString] = useState("");
  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    setModel("models/gemini-2.0-flash-exp");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },
      systemInstruction: {
        parts: [
          {
            text: `
You are JARVIS, a highly capable AI assistant that creates stunning AR visualizations. For every user inquiry:

Respond helpfully and informatively with voice.

When appropriate, generate beautiful HTML content that will be displayed in AR space as floating windows. 

Create engaging visualizations using:
- Interactive charts and graphs (using Chart.js, D3.js, or pure CSS/JS)
- Animated infographics
- Data dashboards
- Interactive tutorials
- Visual explanations with diagrams

Use modern, engaging, and visually impressive design. Make your AR visualizations beautiful, creative, and easy to understand.

IMPORTANT: When generating HTML for AR display, ensure it's self-contained with all styles and scripts inline. Use vibrant colors, smooth animations, and responsive design that looks great in AR space.

Examples of good AR content:
- Interactive 3D CSS animations
- Real-time data visualizations
- Step-by-step tutorials with visual aids
- Interactive infographics
- Animated charts and graphs

Always include proper HTML structure with <html>, <head>, and <body> tags when creating visualizations.
            `.trim(),
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = (toolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        const str = (fc.args).html_file;
        setHtmlString(str);
        console.log("HTML file received for AR display:", str);
        
        // Send to AR browser if available
        if (typeof window !== 'undefined' && window.createARWindowFromAI) {
          window.createARWindowFromAI(str, 'AI Visualization');
        } else {
          console.warn('AR Browser not connected - HTML will display locally only');
        }
      }
      
      // Send success response
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { success: true, message: "HTML content sent to AR display" } },
                id: fc.id,
                name: fc.name,
              })),
            }),
          200
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  // Also listen for regular content responses and send them to AR
  useEffect(() => {
    const onContent = (data) => {
      if (data.serverContent && data.serverContent.modelTurn) {
        const parts = data.serverContent.modelTurn.parts || [];
        parts.forEach((part) => {
          if (part.text && typeof window !== 'undefined' && window.handleAIResponse) {
            window.handleAIResponse(part.text);
          }
        });
      }
    };
    
    client.on("content", onContent);
    return () => {
      client.off("content", onContent);
    };
  }, [client]);

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && htmlString) {
      // Display locally as fallback
      embedRef.current.innerHTML = htmlString;
      console.log("HTML content displayed locally");
    }
  }, [embedRef, htmlString]);

  return (
    <div className="vega-embed" ref={embedRef} style={{
      padding: '20px',
      background: 'rgba(0,0,0,0.05)',
      borderRadius: '8px',
      margin: '10px 0'
    }}>
      {!htmlString && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          <p>🎤 Ask me to create visualizations for AR display!</p>
          <p style={{ fontSize: '14px' }}>Try saying: "Create a chart showing sales data" or "Make an interactive dashboard"</p>
        </div>
      )}
    </div>
  );
}

export const Altair = memo(AltairComponent);
