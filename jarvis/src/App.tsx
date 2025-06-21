/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import { LiveClientOptions } from "./types";
import ARScene, { ARSceneHandles } from "./components/ar-scene/ARScene";
import "./App.scss";
import { useRef, useEffect, useState } from "react";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";
import ControlTray from "./components/control-tray/ControlTray";
import { Altair } from "./components/altair/Altair";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY as string;
if (typeof API_KEY !== "string") {
  throw new Error("set REACT_APP_GEMINI_API_KEY in .env");
}

const apiOptions: LiveClientOptions = {
  apiKey: API_KEY,
};

function App() {
  return (
    <div className="App">
      <LiveAPIProvider options={apiOptions}>
        <ARComponent />
      </LiveAPIProvider>
    </div>
  );
}

function ARComponent() {
  const arSceneRef = useRef<ARSceneHandles>(null);
  const { client } = useLiveAPIContext();
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    const handleContent = (data: any) => {
      if (data.content) {
        arSceneRef.current?.createHTMLWindow(data.content);
      }
    };

    client.on("content", handleContent);

    return () => {
      client.off("content", handleContent);
    };
  }, [client]);

  return (
    <>
      {!sessionActive && (
        <div
          className="start-screen"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(ellipse at 50% 30%, #1a0033 0%, #0f0020 70%, #000 100%)",
            boxShadow: "0 0 120px 40px #00fff7, 0 0 200px 80px #ff00ea",
            overflow: "hidden",
          }}
        >
          <h1
            style={{
              fontFamily: 'Orbitron, "Space Mono", monospace',
              fontWeight: 900,
              fontSize: "2.8rem",
              color: "#00fff7",
              textShadow:
                "0 0 16px #00fff7, 0 0 32px #ff00ea, 0 0 2px #fff, 0 0 1px #fff",
              letterSpacing: "0.08em",
              marginBottom: 24,
              textAlign: "center",
              filter: "drop-shadow(0 0 8px #ff00ea)",
            }}
          >
            WELCOME TO{" "}
            <span style={{ color: "#ff00ea" }}>JARVIS AR ASSISTANT</span>
          </h1>
          <p
            style={{
              color: "#fff",
              fontSize: "1.3rem",
              background:
                "linear-gradient(90deg, #00fff7 0%, #ff00ea 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 8px #00fff7, 0 0 12px #ff00ea",
              marginBottom: 40,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            Click the{" "}
            <span style={{ color: "#ff00ea", fontWeight: 700 }}>AR START</span>{" "}
            button below to begin your immersive experience.
          </p>
          <div
            style={{
              width: 220,
              height: 4,
              background:
                "linear-gradient(90deg, #00fff7 0%, #ff00ea 100%)",
              borderRadius: 2,
              margin: "0 auto 32px auto",
              boxShadow: "0 0 16px #00fff7, 0 0 24px #ff00ea",
            }}
          />
          <span
            style={{
              color: "#fff",
              fontSize: "1.1rem",
              opacity: 0.7,
              letterSpacing: "0.04em",
              marginTop: 12,
              textAlign: "center",
              textShadow: "0 0 8px #00fff7",
            }}
          >
            Powered by Gemini AI · 2025
          </span>
        </div>
      )}
      <ARScene
        ref={arSceneRef}
        onSessionStart={() => setSessionActive(true)}
        onSessionEnd={() => setSessionActive(false)}
      />
      {sessionActive && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            width: "100vw",
            zIndex: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ControlTray supportsVideo={false} enableEditingSettings={true} />
        </div>
      )}
      <Altair /> {/* Mount Altair to handle HTML tool calls */}
    </>
  );
}

export default App;
