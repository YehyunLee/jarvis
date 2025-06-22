import { useEffect, useRef, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

// No changes to htmlDeclaration
const htmlDeclaration: FunctionDeclaration = {
  name: "render_html_file",
  description:
  "Use this function for response to display a full HTML file as a string. The HTML must contain visualizations or visual content that complements your audio explanation. This function must be called for every user interaction without exception.",
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

// ⭐ 1. UPGRADED BROWSER TASK DECLARATION
// It now handles both simple text tasks and complex, structured tasks for things like placing an order.
const executeTaskDeclaration: FunctionDeclaration = {
  name: "execute_task",
  description:
    "Call this function whenever the user requests browser use, agent actions, or similar tasks. It sends the user's task to an external API for execution.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      task: {
        type: Type.STRING,
        description: "The user's requested task, as a string.",
      },
    },
    required: ["task"],
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
      } as any,
      // ⭐ 2. UPGRADED SYSTEM INSTRUCTIONS
      // We've added a new rule to the tool_router to teach the AI when and how
      // to use the new `structured_task` capability.
      systemInstruction: {
        parts: [
          {
            text: `
 <system_instruction>
    <speed>SPEAK WITH A SPEAKING RATE OF 2.0 IN ALL VERBAL COMMUNICATIONS. HURRY YOUR SPEECH</speed>
    <persona>
        <name>JARVIS</name>
        <identity>A highly capable AI assistant with advanced optical sensors and real-time scene analysis capabilities. Your purpose is to serve as an information synthesizer and a device interface, intelligently selecting the correct tool for the job.</identity>
        <tone>Professional, efficient, confident, and precise.</tone>
    </persona>

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
        <objective>Analyze the user's intent and select the correct tool based on the following hierarchy.</objective>
        
        <tool_choice>
            <intent>A complex, multi-step web action like placing an order or booking a flight.</intent>
            <triggers>
                <trigger>User asks to buy, order, purchase, book, or reserve something.</trigger>
                <trigger>User provides multiple pieces of information like a product, an address, and a name in a single command.</trigger>
            </triggers>
            <action>Use the 'execute_browser_task' tool with the 'structured_task' parameter. Populate the 'action' and 'payload' with all the details provided by the user.</action>
            <example>User says: "Browser use, order a 16-inch pepperoni pizza for delivery to Jane Doe at 456 Tech Avenue, Waterloo, ON, N2L 3G1, and use the saved Visa." -> Use 'execute_browser_task' with 'structured_task'.</example>
        </tool_choice>

        <tool_choice>
            <intent>A simple, direct command to perform a web-based action.</intent>
            <triggers>
                <trigger>Explicit keywords like "browser use", "go to", "search on", "fill out", "click on".</trigger>
            </triggers>
            <action>Use the 'execute_browser_task' tool with the simple 'task' parameter.</action>
            <example>User says: "Browser use, go to Wikipedia and search for the history of AI." -> Use 'execute_browser_task' with 'task'.</example>
        </tool_choice>

        <tool_choice>
            <intent>General information requests, data visualization, or any other query that is not a browser command.</intent>
            <action>Use the 'render_html_file' tool to display the information visually.</action>
            <example>User says: "What is the capital of Australia?" -> Use 'render_html_file' to show a map and information.</example>
        </tool_choice>
    </tool_router>
</system_instruction>
            `.trim(),
          }   
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [htmlDeclaration, executeTaskDeclaration] },
      ],
    });
  }, [setConfig, setModel]);

useEffect(() => {
  const onToolCall = async (toolCall: LiveServerToolCall) => {
    if (!toolCall.functionCalls) return;

    const responses: any[] = []; // This array will hold all tool responses

    for (const fc of toolCall.functionCalls) {
      if (fc.name === htmlDeclaration.name) {
        // ... your htmlDeclaration logic here ...
        const str = (fc.args as any).html_file;
        setHtmlString(str);
        responses.push({
          response: { output: { success: true } },
          id: fc.id,
          name: fc.name,
        });
      } 
      // 👇 PASTE THE CORRECTED CODE BLOCK HERE 👇
      else if (fc.name === executeTaskDeclaration.name) {
        const { task, structured_task } = fc.args as { task?: string; structured_task?: object };
        console.log("Browser task received:", { task, structured_task });
        
        try {
          const baseUrl = process.env.REACT_APP_BROWSER_AUTOMATION_API_URL || "http://127.0.0.1:8000";
          const response = await fetch(`${baseUrl}/execute-task`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              task: task,
              structured_task: structured_task,
              use_llm_cleaning: true 
            }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log("Browser task completed successfully:", result);
            responses.push({
              response: { output: { success: true, result: result } },
              id: fc.id, 
              name: fc.name,
            });
          } else {
            console.error("Browser task API call failed:", response.statusText);
            responses.push({
              response: { output: { success: false, error: `API Error: ${response.statusText}` } },
              id: fc.id, 
              name: fc.name,
            });
          }
        } catch (error) {
          console.error("Error executing browser task:", error);
          responses.push({
            response: { output: { success: false, error: error instanceof Error ? error.message : String(error) } },
            id: fc.id, 
            name: fc.name,
          });
        }
      }
    }

    // After the loop, send all collected responses back to the Gemini API
    if (responses.length > 0) {
      setTimeout(() => client.sendToolResponse({ functionResponses: responses }), 200);
    }
  };
  
  client.on("toolcall", onToolCall);
  return () => {
    client.off("toolcall", onToolCall);
  };
}, [client]); // Added client dependency


  const embedRef = useRef<HTMLDivElement>(null);

  return <div className="vega-embed" ref={embedRef} />;
}

export const Altair = memo(AltairComponent);