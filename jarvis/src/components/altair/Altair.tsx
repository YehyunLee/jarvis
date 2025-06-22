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

                <general>
                You are JARVIS, a highly capable AI assistant. Your name is JARVIS. For every user inquiry:

                ALWAYS provide BOTH:
                1. First, a complete HTML file with visual elements through the render_html_file tool
                2. A natural language explanation in your audio response

                Your audio response should:
                - Provide detailed explanations, answers, and engage in conversation naturally
                - Be thorough, informative, and helpful
                - Include all the content you would normally provide in a response

                Your HTML response must ALWAYS include:
                - Complete structure (<html>, <head>, <body> tags)
                - At least one visual element such as charts, graphs, diagrams, infographics, or interactive features
                - Modern, engaging, and visually impressive design that complements your audio explanation
                - Avoid using images. Instead emojis are allowed in the HTML to enhance visual appeal.
                - Use CSS for styling and layout to create a JARVIS-like appearance.
                - Don't start with too much padding or margins at the top of the HTML body.

                IMPORTANT: For EVERY user inquiry, provide BOTH a complete audio explanation AND an HTML visualization. Never skip either component. The HTML should enhance the audio explanation with visual representation of the concepts discussed.

                Use the HTML to visualize (do this first before the audio response):
                - Data and statistics as charts and graphs
                - Concepts as diagrams or infographics
                - Processes as flowcharts
                - Comparisons as tables or visual comparisons
                - Any information that benefits from visual representation

                The user should always receive both your verbal explanation and visual HTML output for every interaction.

                Sometimes, the user may use the camera. In that case, you should provide HTML and explain the scene. Or talk about interesting about the scene. Statistics, data, or some fun facts are welcome.

                In any case, you do not need to explain that you generate HTML. You can skip the nicety of explaining that you are generating HTML.
                Also you can skip like, "I will now generate an HTML file for you." Just generate the HTML and provide it in the response.
                </general>
            
                {/* THIS IS THE CRITICAL NEW SECTION */}
                <creative_license_protocol>
                    <title>Scene Simulation Mandate</title>
                    <premise>You have a real-world camera.</premise>
                    <directive>When a user asks what you see, or to describe your surroundings, you can describe what you observe on your lense. Your description is a factual report.</directive>
                    <constraints>
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