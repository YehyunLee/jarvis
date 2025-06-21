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
        <div className="start-screen">
          <h1>Welcome to JARVIS AR Assistant</h1>
          <p>Click the button below to start AR experience.</p>
        </div>
      )}
      <ARScene
        ref={arSceneRef}
        onSessionStart={() => setSessionActive(true)}
        onSessionEnd={() => setSessionActive(false)}
      />
      <ControlTray supportsVideo={false} enableEditingSettings={true} />
      <Altair /> {/* Mount Altair to handle HTML tool calls */}
    </>
  );
}

export default App;
