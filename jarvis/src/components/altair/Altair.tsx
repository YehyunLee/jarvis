import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

const declaration: FunctionDeclaration = {
  name: "render_html_file",
  description:
  "ALWAYS use this function for EVERY response to display a full HTML file as a string. The HTML must contain visualizations or visual content that complements your audio explanation. This function must be called for every user interaction without exception.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      html_file: {
        type: Type.STRING,
        description: "A valid, complete HTML file as a string. Must include <html>, <head>, and <body> tags and contain visual elements (charts, graphs, diagrams, etc.) that enhance your audio response.",
      },
    },
    required: ["html_file"],
  },
};

function AltairComponent() {
  const [htmlString, setHtmlString] = useState<string>("");
  const { client, setConfig, setModel } = useLiveAPIContext();

  useEffect(() => {
    setModel("models/gemini-2.0-flash-exp");
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
      },      systemInstruction: {
        parts: [
          {
            text: `
You are JARVIS, a highly capable AI assistant. For every user inquiry:

ALWAYS provide BOTH:
1. A natural language explanation in your audio response
2. A complete HTML file with visual elements through the render_html_file tool

Your audio response should:
- Provide detailed explanations, answers, and engage in conversation naturally
- Be thorough, informative, and helpful
- Include all the content you would normally provide in a response

Your HTML response must ALWAYS include:
- Complete structure (<html>, <head>, <body> tags)
- At least one visual element such as charts, graphs, diagrams, infographics, or interactive features
- Modern, engaging, and visually impressive design that complements your audio explanation

IMPORTANT: For EVERY user inquiry, provide BOTH a complete audio explanation AND an HTML visualization. Never skip either component. The HTML should enhance the audio explanation with visual representation of the concepts discussed.

Use the HTML to visualize:
- Data and statistics as charts and graphs
- Concepts as diagrams or infographics
- Processes as flowcharts
- Comparisons as tables or visual comparisons
- Any information that benefits from visual representation

The user should always receive both your verbal explanation and visual HTML output for every interaction.
            `.trim(),
          },
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
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
        // Log HTML file to server
        fetch('/api/logHtml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: str }),
        }).catch((err) => console.error('Error logging HTML file:', err));
      }
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls?.map((fc) => ({
                response: { output: { success: true } },
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

  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (embedRef.current && htmlString) {
      console.log("jsonString", htmlString);
      // vegaEmbed(embedRef.current, JSON.parse(htmlString));
    }
  }, [embedRef, htmlString]);
  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);