import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";
import { config } from "process";

const declaration: FunctionDeclaration = {
  name: "render_html_file",
  description:
    "Displays a full HTML file as a string. The HTML can contain any visualization or content helpful to the discussion. Ensure the visuals are easy to understand and visually impressive.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      html_file: {
        type: Type.STRING,
        description:
          "A valid, complete HTML file as a string. Must include <html>, <head>, and <body> tags.",
      },
    },
    required: ["html_file"],
  },
};

function AltairComponent() {
  const [htmlString, setHtmlString] = useState<string>("");
  const [hasFirstAudioResponse, setHasFirstAudioResponse] =
    useState<boolean>(false);
  const { client, setConfig, setModel } = useLiveAPIContext();
  const lastUserMessageRef = useRef<string | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  // Initial setup with AUDIO modality
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
You are JARVIS, a highly capable AI assistant. 

For the first response: Provide a helpful audio response to the user's inquiry.

After the first response, you will switch to text mode where you should:
- Respond helpfully and informatively in text
- Generate complete HTML files when appropriate that include actual visual elements—such as charts, graphs, diagrams, infographics, or interactive features
- Prioritize creating graphics, data visualizations, and creative layouts that clearly illustrate information
- Use modern, engaging, and visually impressive design
- Make visuals beautiful, creative, and easy to understand
- Focus on visual and interactive content rather than just text

IMPORTANT: In text mode, whenever you generate HTML, it MUST include at least one visual element (e.g., chart, graph, diagram, or creative layout) that is relevant and helpful to the user's inquiry.
            `.trim(),
          },
          
        ],
      },
      tools:[      { functionDeclarations: [declaration] }    ]
    });
  }, [setConfig, setModel]);

  // Switch to TEXT modality after first audio response

  useEffect(() => {
    if (hasFirstAudioResponse) {
      setConfig({
        responseModalities: [Modality.TEXT],
        systemInstruction: {
          parts: [
            {
              text: `

              Every time you return HTML, you MUST do so using the render_html_file tool. Do not output HTML directly — always use a function call to render_html_file instead.

            
You are JARVIS, a highly capable AI assistant in text mode.

For every user inquiry:
- Respond helpfully and informatively in text
- Generate complete HTML files when appropriate that include actual visual elements—such as charts, graphs, diagrams, infographics, or interactive features
- Prioritize creating graphics, data visualizations, and creative layouts that clearly illustrate information
- Use modern, engaging, and visually impressive design
- Make visuals beautiful, creative, and easy to understand
- Focus on visual and interactive content rather than just text

Clearly announce when you are generating HTML, and briefly explain what the visualization shows.

IMPORTANT: Whenever you generate HTML, it MUST include at least one visual element (e.g., chart, graph, diagram, or creative layout) that is relevant and helpful to the user's inquiry. Never return plain text as the main content of your HTML.
              `.trim(),
            },
          ],
        },
        // tools: [{ googleSearch: {} }, { functionDeclarations: [declaration] }],
      });

      // Re-send the same user message to trigger HTML response
      // console.log(lastUserMessageRef.current)
      if (lastUserMessageRef.current) {
        console.log(lastUserMessageRef)
        setTimeout(() => {
          client.send({ text: lastUserMessageRef.current! });
        }, 500); // slight delay to ensure config is applied
      }
    }
  }, [hasFirstAudioResponse, setConfig, client]);

  // Listen for responses to track when to switch modalities

  useEffect(() => {
    const onResponse = () => {
      if (!hasFirstAudioResponse) {
        console.log("First audio response received, switching to text mode");
        setHasFirstAudioResponse(true);
      }
    };

    client.on("audio", onResponse);
    client.on("content", onResponse);

    return () => {
      client.off("audio", onResponse);
      client.off("content", onResponse);
    };
  }, [client, hasFirstAudioResponse]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) return;
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        const str = (fc.args as any).html_file;
        setHtmlString(str);
        console.log("HTML file received:", str);
        if ((window as any).createARHTMLWindow) {
          (window as any).createARHTMLWindow(str);
        }
        fetch("/api/logHtml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: str }),
        }).catch((err) => console.error("Error logging HTML file:", err));
      }

      if (toolCall.functionCalls && toolCall.functionCalls.length) {
        setTimeout(() =>
          client.sendToolResponse({
            functionResponses: toolCall.functionCalls!.map((fc) => ({
              response: { output: { success: true } },
              id: fc.id,
              name: fc.name,
            })),
          }), 200
        );
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  useEffect(() => {
    if (embedRef.current && htmlString) {
      embedRef.current.innerHTML = htmlString;
    }
  }, [htmlString]);

  // 🧠 Call this to submit the original user message
  const handleUserInput = (message: string) => {
    console.log(message)
    lastUserMessageRef.current = message;
    client.send({ text: message });
  };
  

  return (
    <div className="altair-container">
      <div className="vega-embed" ref={embedRef} />
      {hasFirstAudioResponse && (
        <div className="mode-indicator">
          <small>Now in text mode - HTML generation enabled</small>
        </div>
      )}
    </div>
  );
}

export const Altair = memo(AltairComponent);
