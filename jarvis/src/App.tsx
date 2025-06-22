import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import { LiveClientOptions } from "./types";
import ARScene, { ARSceneHandles } from "./components/ar-scene/ARScene";
import "./App.scss";
import React, { useRef, useEffect, useState } from "react";
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: any) {
    // You can log error here
    // console.error(error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: "red", padding: 40 }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [arKey, setArKey] = useState(0);
  return (
    <div className="App">
      <LiveAPIProvider options={apiOptions}>
        <ErrorBoundary>
          <ARComponent key={arKey} onSessionReset={() => setArKey((k) => k + 1)} />
        </ErrorBoundary>
      </LiveAPIProvider>
    </div>
  );
}

function ARComponent({ onSessionReset }: { onSessionReset?: () => void }) {
  const arSceneRef = useRef<ARSceneHandles>(null);
  const { client, disconnect } = useLiveAPIContext();
  const [sessionActive, setSessionActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

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
          {/* Neon cyan grid overlay */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 0,
              opacity: 0.18,
              pointerEvents: "none",
            }}
            width="100vw"
            height="100vh"
          >
            <defs>
              <linearGradient id="cyangrid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00fff7" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#00fff7" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            {Array.from({ length: 20 }).map((_, i) => (
              <line
                key={i}
                x1={(i * window.innerWidth) / 20}
                y1={0}
                x2={(i * window.innerWidth) / 20}
                y2={window.innerHeight}
                stroke="url(#cyangrid)"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 16 }).map((_, i) => (
              <line
                key={100 + i}
                x1={0}
                y1={(i * window.innerHeight) / 16}
                x2={window.innerWidth}
                y2={(i * window.innerHeight) / 16}
                stroke="url(#cyangrid)"
                strokeWidth="1"
              />
            ))}
          </svg>
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
              position: "relative",
              zIndex: 2,
            }}
          >
            WELCOME TO{" "}
            <span
              style={{
                color: "#ff00ea",
                textShadow: "0 0 16px #00fff7, 0 0 32px #ff00ea",
              }}
            >
              JARVIS AR ASSISTANT
            </span>
          </h1>
          {/* Cyan accent bar with glow */}
          <div
            style={{
              width: 240,
              height: 6,
              background:
                "linear-gradient(90deg, #00fff7 0%, #ff00ea 100%)",
              borderRadius: 3,
              margin: "0 auto 32px auto",
              boxShadow:
                "0 0 32px #00fff7, 0 0 48px #ff00ea, 0 0 8px #00fff7",
              position: "relative",
              zIndex: 2,
            }}
          />
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
              position: "relative",
              zIndex: 2,
            }}
          >
            Click the{" "}
            <span
              style={{
                color: "#00fff7",
                fontWeight: 700,
                textShadow: "0 0 8px #00fff7",
              }}
            >
              AR START
            </span>{" "}
            button below to begin your immersive experience.
          </p>
          <span
            style={{
              color: "#fff",
              fontSize: "1.1rem",
              opacity: 0.7,
              letterSpacing: "0.04em",
              marginTop: 12,
              textAlign: "center",
              textShadow: "0 0 8px #00fff7",
              position: "relative",
              zIndex: 2,
            }}
          >
            Powered by Gemini AI · 2025
          </span>
          {/* Animated long down arrow for AR start button */}
          <div
            style={{
              position: "absolute",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: "4.5rem",
                color: "#00fff7",
                textShadow:
                  "0 0 24px #00fff7, 0 0 32px #ff00ea, 0 0 8px #00fff7",
                fontWeight: 900,
                letterSpacing: "0.08em",
                animation: "arrow-bounce 1.2s infinite cubic-bezier(.6,0,.4,1)",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              ↓
            </span>
          </div>
          <style>{`
            @keyframes arrow-bounce {
              0% { transform: translateY(0); }
              50% { transform: translateY(18px); }
              100% { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
      <div
        className="main-app-area"
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          zIndex: 1,
          width: "320px",
          height: "240px",
          display: videoStream ? "block" : "none",
          border: "2px solid #00FFEA",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 0 12px #00FFEA",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="stream"
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "14px",
          }}
        />
      </div>
      <ARScene
        ref={arSceneRef}
        onSessionStart={() => setSessionActive(true)}
        onSessionEnd={() => {
          setSessionActive(false);
          setVideoStream(null);
          disconnect();
          setTimeout(() => {
            window.location.reload(); // Force full reload to return to title page
          }, 100);
        }}
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
          <ControlTray
            videoRef={videoRef}
            onVideoStreamChange={setVideoStream}
            supportsVideo={true}
            enableEditingSettings={true}
          />
        </div>
      )}
      <Altair /> {/* Mount Altair to handle HTML tool calls */}
    </>
  );
}

export default App;