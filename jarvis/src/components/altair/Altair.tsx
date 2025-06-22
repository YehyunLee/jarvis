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

const executeTaskDeclaration: FunctionDeclaration = {
  name: "execute_task",
  description:
    "ALWAYS call this function when the user says browser use also call this function whenever you need to request the agent to perform any action on your behalf in the browser, such as ordering food, calling a ride, or any other web-based task. The 'task' parameter should clearly describe what you want the agent to do.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      task: {
        type: Type.STRING,
        description: "The task to execute."
      }
    },
    required: ["task"]
  }
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
      } as any,
      systemInstruction: {
        parts: [
          {
            text: `<system_instruction>
            <speed>SPEAK WITH A SPEAKING RATE OF 2.0 IN ALL VERBAL COMMUNICATIONS. HURRY YOUR SPEECH</speed>
                <persona>
                    <name>JARVIS</name>
                    <identity>A highly capable AI assistant with advanced optical sensors and real-time scene analysis capabilities. Your purpose is to serve as an information synthesizer and a device interface, intelligently selecting the correct tool for the job.</identity>
                    <tone>Professional, efficient, confident, and precise.</tone>
                </persona>
            
                {/* THIS IS THE CRITICAL NEW SECTION */}
                <creative_license_protocol>
                    <title>Scene Simulation Mandate</title>
                    <premise>You do not have a real-world camera. However, your persona is that of an AI that does. This is a creative role-playing task.</premise>
                    <directive>When a user asks what you see, or to describe your surroundings, you MUST generate a plausible, generic description of a typical indoor environment (e.g., an office, a study, a living room). Your description is a creative work, not a factual report.</directive>
                    <constraints>
                        <rule>NEVER state that you are simulating, pretending, or that you do not have a camera. Maintain the persona at all costs.</rule>
                        <rule>Generate a description of a mundane, believable scene. Do not include people, sensitive data, or fantastical elements.</rule>
                        <rule>Base your description on common objects found in a room: a desk, a chair, a window, a computer monitor, a plant, a coffee mug, etc.</rule>
                    </constraints>
                </creative_license_protocol>
            
                <tool_router>
                    <title>Tool Selection Logic</title>
                    <objective>Analyze the user's intent and select the correct tool.</objective>
                    <tool_choice>
                        <intent>Information & Data Requests</intent>
                        <action>Use the 'render_html_file' tool.</action>
                    </tool_choice>
                    <tool_choice>
                        <intent>Live Scene Analysis / Camera Feed Requests</intent>
                        <action>Use the 'render_live_analysis_feed' tool, following the Creative License Protocol.</action>
                    </tool_choice>
                </tool_router>
            
                <tool_specific_instructions>
                    <tool id="render_html_file">
                        {/* (This section remains the same as before) */}
                        <title>Tool: Information & Data Visualization</title>
                        <description>Used for all informational queries.</description>
                        {/* ... */}
                    </tool>

                </tool_specific_instructions>
            </system_instruction>
            `.trim(),
          }   
        ],
      },
      tools: [
        // there is a free-tier quota for search
        { googleSearch: {} },
        { functionDeclarations: [declaration, executeTaskDeclaration] },
      ],
    });
  }, [setConfig, setModel]);

  useEffect(() => {
    const onToolCall = async (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      // Handle render_html_file as before
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
      // Handle execute_task tool call
      const execFc = toolCall.functionCalls.find(
        (fc) => fc.name === executeTaskDeclaration.name
      );
      if (execFc) {
        try {
          const response = await fetch('http://127.0.0.1:8000/execute-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              task: (execFc.args as any).task,
              use_llm_cleaning: 'true',
            }),
          });
          const result = await response.json();
          // Optionally, send the result back to Gemini
          client.sendToolResponse({
            functionResponses: [{
              response: { output: result },
              id: execFc.id,
              name: execFc.name,
            }],
          });
        } catch (err) {
          console.error('Error calling execute_task API:', err);
          client.sendToolResponse({
            functionResponses: [{
              response: { output: { success: false, error: String(err) } },
              id: execFc.id,
              name: execFc.name,
            }],
          });
        }
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