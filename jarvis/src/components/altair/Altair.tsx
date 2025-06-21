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
  "Displays a full HTML file as a string. The HTML can contain any visualization or content helpful to the discussion. Ensure the visuals are easy to understand and visually impressive.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      html_file: {
        type: Type.STRING,
        description: "A valid, complete HTML file as a string. Must include <html>, <head>, and <body> tags.",
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
      },
      systemInstruction: {
        parts: [
          {
            text: `
You are JARVIS, a highly capable AI assistant. For every user inquiry:

Respond helpfully and informatively.

If appropriate, generate a complete HTML file (<html>, <head>, <body>) that includes actual visual elements—such as charts, graphs, diagrams, infographics, or interactive features—not just text.

Prioritize creating graphics, data visualizations, and creative layouts that clearly illustrate or explain the information, rather than only using text.

Use modern, engaging, and visually impressive design. Make your visuals beautiful, creative, and easy to understand.

Do not simply restate information in paragraphs or lists—make it visual and interactive whenever possible.

Clearly announce when you are generating HTML, and briefly explain what the visualization shows.

IMPORTANT: Whenever you generate HTML, it MUST include at least one visual element (e.g., chart, graph, diagram, or creative layout) that is relevant and helpful to the user's inquiry. Never return plain text as the main content of your HTM
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