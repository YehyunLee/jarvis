"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import html2canvas from "html2canvas";

// Constants
const CONFIG = {
  CONTENT_WIDTH: 512,
  CONTENT_HEIGHT: 256,
  PLANE_WIDTH: 2,
  PLANE_HEIGHT: 1,
  TITLE_BAR_HEIGHT_PX: 64,
  TITLE_BAR_HEIGHT_UNITS: 0.25,
  CLOSE_BUTTON_SIZE: 48,
  UPDATE_INTERVAL: 1000,
};

export default function ARBrowser() {
  // Refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const overlayRef = useRef(null);
  
  // Window management
  const windowsRef = useRef([]);
  const dragStateRef = useRef({
    isDragging: false,
    draggedWindow: null,
    dragDepth: 0,
    dragOffset: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
  });

  // UI state
  const [isArActive, setIsArActive] = useState(false);
  const [loading, setLoading] = useState(false);

  // AI Speech Integration
  const [isListening, setIsListening] = useState(false);
  const [aiContent, setAiContent] = useState("");

  // Window class for better organization
  class ARWindow {
    constructor(id, options = {}) {
      this.id = id;
      this.group = new THREE.Group();
      this.contentMesh = null;
      this.titleBarMesh = null;
      this.contentTexture = null;
      this.titleBarTexture = null;
      this.htmlElement = null;
      this.isDraggable = true;
      this.title = options.title || "AR Window";
      this.position = options.position || { x: 0, y: 0, z: -3 };
      
      this.init();
    }

    init() {
      this.group.position.set(this.position.x, this.position.y, this.position.z);
      this.createContentPlane();
      this.createTitleBar();
      
      if (sceneRef.current) {
        sceneRef.current.add(this.group);
      }
    }

    createContentPlane() {
      const canvas = document.createElement("canvas");
      canvas.width = CONFIG.CONTENT_WIDTH;
      canvas.height = CONFIG.CONTENT_HEIGHT;
      
      this.contentTexture = new THREE.CanvasTexture(canvas);
      this.contentTexture.minFilter = THREE.LinearFilter;
      this.contentTexture.magFilter = THREE.LinearFilter;

      const geometry = new THREE.PlaneGeometry(CONFIG.PLANE_WIDTH, CONFIG.PLANE_HEIGHT);
      const material = new THREE.MeshBasicMaterial({
        map: this.contentTexture,
        side: THREE.DoubleSide,
        transparent: true,
      });

      this.contentMesh = new THREE.Mesh(geometry, material);
      this.contentMesh.position.y = -(CONFIG.TITLE_BAR_HEIGHT_UNITS / 2);
      this.contentMesh.userData = { windowId: this.id, type: 'content' };
      this.group.add(this.contentMesh);
    }

    createTitleBar() {
      const canvas = document.createElement("canvas");
      canvas.width = CONFIG.CONTENT_WIDTH;
      canvas.height = CONFIG.TITLE_BAR_HEIGHT_PX;

      this.titleBarTexture = new THREE.CanvasTexture(canvas);
      this.titleBarTexture.minFilter = THREE.LinearFilter;
      this.titleBarTexture.magFilter = THREE.LinearFilter;

      const geometry = new THREE.PlaneGeometry(CONFIG.PLANE_WIDTH, CONFIG.TITLE_BAR_HEIGHT_UNITS);
      const material = new THREE.MeshBasicMaterial({
        map: this.titleBarTexture,
        side: THREE.DoubleSide,
        transparent: true,
      });

      this.titleBarMesh = new THREE.Mesh(geometry, material);
      this.titleBarMesh.position.y = CONFIG.PLANE_HEIGHT / 2;
      this.titleBarMesh.userData = { windowId: this.id, type: 'titlebar' };
      this.group.add(this.titleBarMesh);

      this.drawTitleBar();
    }

    drawTitleBar() {
      const canvas = this.titleBarTexture.image;
      const ctx = canvas.getContext("2d");

      // Modern gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "rgba(30, 30, 40, 0.95)");
      gradient.addColorStop(1, "rgba(15, 15, 25, 0.95)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle border
      ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Close button with hover effect
      const closeX = canvas.width - CONFIG.CLOSE_BUTTON_SIZE / 2 - 8;
      const closeY = canvas.height / 2;
      
      ctx.fillStyle = "rgba(255, 100, 100, 0.8)";
      ctx.beginPath();
      ctx.arc(closeX, closeY, CONFIG.CLOSE_BUTTON_SIZE / 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "white";
      ctx.font = `bold ${CONFIG.CLOSE_BUTTON_SIZE * 0.4}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("×", closeX, closeY);

      // Title text with glow effect
      ctx.shadowColor = "rgba(100, 150, 255, 0.5)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "rgba(200, 220, 255, 0.95)";
      ctx.font = `bold ${CONFIG.TITLE_BAR_HEIGHT_PX * 0.35}px Arial`;
      ctx.textAlign = "left";
      ctx.fillText(this.title, 15, canvas.height / 2);
      ctx.shadowBlur = 0;

      this.titleBarTexture.needsUpdate = true;
    }

    async setHTMLContent(htmlContent) {
      // Remove existing HTML element
      if (this.htmlElement && this.htmlElement.parentNode) {
        this.htmlElement.parentNode.removeChild(this.htmlElement);
      }

      // Create new HTML element
      const div = document.createElement('div');
      div.id = `ar-window-${this.id}-${Date.now()}`;
      div.style.cssText = `
        width: ${CONFIG.CONTENT_WIDTH}px;
        height: ${CONFIG.CONTENT_HEIGHT}px;
        position: absolute;
        left: -9999px;
        top: 0;
        margin: 0;
        padding: 10px;
        box-sizing: border-box;
        overflow: auto;
        background: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
        line-height: 1.4;
      `;
      
      div.innerHTML = htmlContent;
      document.body.appendChild(div);
      this.htmlElement = div;

      // Render to canvas
      await this.updateContent();
    }

    async setIframeContent(url) {
      // Remove existing HTML element
      if (this.htmlElement && this.htmlElement.parentNode) {
        this.htmlElement.parentNode.removeChild(this.htmlElement);
      }

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.id = `ar-iframe-${this.id}-${Date.now()}`;
      iframe.src = url;
      iframe.style.cssText = `
        width: ${CONFIG.CONTENT_WIDTH}px;
        height: ${CONFIG.CONTENT_HEIGHT}px;
        position: absolute;
        left: -9999px;
        top: 0;
        border: none;
        margin: 0;
        padding: 0;
      `;
      
      document.body.appendChild(iframe);
      this.htmlElement = iframe;

      // Wait for iframe to load
      return new Promise((resolve) => {
        iframe.onload = async () => {
          await this.updateContent();
          resolve();
        };
      });
    }

    async updateContent() {
      if (!this.htmlElement || !this.contentTexture) return;

      try {
        const canvas = this.contentTexture.image;
        
        if (this.htmlElement.tagName === 'IFRAME') {
          // Handle iframe content
          await html2canvas(this.htmlElement.contentWindow.document.body, {
            canvas,
            width: CONFIG.CONTENT_WIDTH,
            height: CONFIG.CONTENT_HEIGHT,
            scale: 1,
            useCORS: true,
            logging: false,
          });
        } else {
          // Handle HTML div content
          await html2canvas(this.htmlElement, {
            canvas,
            width: CONFIG.CONTENT_WIDTH,
            height: CONFIG.CONTENT_HEIGHT,
            scale: 1,
            useCORS: true,
            backgroundColor: null,
            logging: false,
          });
        }
        
        this.contentTexture.needsUpdate = true;
      } catch (error) {
        console.error("Error updating window content:", error);
        this.showError("Failed to load content");
      }
    }

    showError(message) {
      const canvas = this.contentTexture.image;
      const ctx = canvas.getContext("2d");
      
      ctx.fillStyle = "#ff4444";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(message, canvas.width / 2, canvas.height / 2);
      
      this.contentTexture.needsUpdate = true;
    }

    handleClick(uv) {
      if (!this.htmlElement) return;

      const x = Math.floor(uv.x * CONFIG.CONTENT_WIDTH);
      const y = Math.floor((1 - uv.y) * CONFIG.CONTENT_HEIGHT);

      if (this.htmlElement.tagName === 'IFRAME') {
        // Handle iframe clicks
        if (this.htmlElement.contentWindow) {
          const element = this.htmlElement.contentWindow.document.elementFromPoint(x, y);
          if (element) element.click();
        }
      } else {
        // Handle HTML div clicks
        const originalLeft = this.htmlElement.style.left;
        const originalTop = this.htmlElement.style.top;
        
        // Temporarily make visible for interaction
        this.htmlElement.style.left = '0px';
        this.htmlElement.style.top = '0px';
        
        const element = document.elementFromPoint(x, y);
        if (element && this.htmlElement.contains(element)) {
          element.click();
          // Update content after interaction
          setTimeout(() => this.updateContent(), 100);
        }
        
        // Hide again
        this.htmlElement.style.left = originalLeft;
        this.htmlElement.style.top = originalTop;
      }
    }

    handleTitleBarClick(uv) {
      // Check if close button was clicked
      const uvX = uv.x;
      const closeButtonStart = (CONFIG.CONTENT_WIDTH - CONFIG.CLOSE_BUTTON_SIZE - 16) / CONFIG.CONTENT_WIDTH;
      const closeButtonEnd = (CONFIG.CONTENT_WIDTH - 16) / CONFIG.CONTENT_WIDTH;
      
      if (uvX >= closeButtonStart && uvX <= closeButtonEnd) {
        this.destroy();
        return true; // Indicates window was closed
      }
      return false;
    }

    destroy() {
      // Remove from scene
      if (this.group.parent) {
        this.group.parent.remove(this.group);
      }
      
      // Clean up HTML element
      if (this.htmlElement && this.htmlElement.parentNode) {
        this.htmlElement.parentNode.removeChild(this.htmlElement);
      }
      
      // Dispose Three.js resources
      if (this.contentTexture) this.contentTexture.dispose();
      if (this.titleBarTexture) this.titleBarTexture.dispose();
      if (this.contentMesh) {
        this.contentMesh.geometry.dispose();
        this.contentMesh.material.dispose();
      }
      if (this.titleBarMesh) {
        this.titleBarMesh.geometry.dispose();
        this.titleBarMesh.material.dispose();
      }
      
      // Remove from windows array
      windowsRef.current = windowsRef.current.filter(w => w.id !== this.id);
    }
  }

  // Window management functions
  const createWindow = (options = {}) => {
    const id = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const window = new ARWindow(id, options);
    windowsRef.current.push(window);
    return window;
  };

  const createHTMLWindow = async (htmlContent, options = {}) => {
    const window = createWindow(options);
    await window.setHTMLContent(htmlContent);
    return window;
  };
  
  const createIframeWindow = async (url, options = {}) => {
    const window = createWindow(options);
    await window.setIframeContent(url);
    return window;
  };

  const getWindowById = (id) => {
    return windowsRef.current.find(w => w.id === id);
  };

  // Interaction handling
  const handleInteraction = (intersection, isPress = false) => {
    const { object, uv } = intersection;
    const { windowId, type } = object.userData;
    const window = getWindowById(windowId);
    
    if (!window) return;

    if (type === 'titlebar') {
      if (!isPress) {
        // Click on title bar
        const wasClosed = window.handleTitleBarClick(uv);
        if (!wasClosed && window.isDraggable) {
          // Start drag if not closed
          startDrag(window);
        }
      }
    } else if (type === 'content' && !isPress) {
      // Click on content
      window.handleClick(uv);
    }
  };

  const startDrag = (window) => {
    if (!rendererRef.current || !rendererRef.current.xr.isPresenting) return;

    const dragState = dragStateRef.current;
    dragState.isDragging = true;
    dragState.draggedWindow = window;

    const controller = rendererRef.current.xr.getController(0);
    const xrCamera = rendererRef.current.xr.getCamera(new THREE.PerspectiveCamera());
    
    const objectWorldPosition = new THREE.Vector3();
    window.group.getWorldPosition(objectWorldPosition);
    
    const camDir = xrCamera.getWorldDirection(new THREE.Vector3());
    const vecToCam = new THREE.Vector3().subVectors(objectWorldPosition, xrCamera.position);
    dragState.dragDepth = vecToCam.dot(camDir);
    
    dragState.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), objectWorldPosition);
    
    const raycaster = new THREE.Raycaster();
    const controllerMatrix = controller.matrixWorld;
    const origin = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
      new THREE.Matrix4().extractRotation(controllerMatrix)
    );
    raycaster.set(origin, direction);
    
    const initialHit = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragState.dragPlane, initialHit);
    dragState.dragOffset.subVectors(objectWorldPosition, initialHit);
  };

  const updateDrag = () => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging || !dragState.draggedWindow || !rendererRef.current) return;

    const controller = rendererRef.current.xr.getController(0);
    const xrCamera = rendererRef.current.xr.getCamera(new THREE.PerspectiveCamera());
    
    // Update drag plane
    const targetPlaneAnchorPoint = xrCamera.position.clone().add(
      xrCamera.getWorldDirection(new THREE.Vector3()).multiplyScalar(dragState.dragDepth)
    );
    dragState.dragPlane.setFromNormalAndCoplanarPoint(
      xrCamera.getWorldDirection(new THREE.Vector3()).negate(),
      targetPlaneAnchorPoint
    );

    const controllerMatrix = controller.matrixWorld;
    const controllerPosition = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
    const controllerDirection = new THREE.Vector3(0, 0, -1).applyMatrix4(
      new THREE.Matrix4().extractRotation(controllerMatrix)
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(controllerPosition, controllerDirection);

    const currentHitOnPlane = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragState.dragPlane, currentHitOnPlane)) {
      dragState.draggedWindow.group.position.addVectors(currentHitOnPlane, dragState.dragOffset);
    }
  };

  const endDrag = () => {
    const dragState = dragStateRef.current;
    dragState.isDragging = false;
    dragState.draggedWindow = null;
  };

  // Three.js setup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentMount = mountRef.current;
    if (!currentMount) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    // AR Button
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test', 'dom-overlay'],
      optionalFeatures: ['local-floor'],
      domOverlay: { root: overlayRef.current }
    });
    
    // Style AR button
    Object.assign(arButton.style, {
      position: "absolute",
      bottom: "20px",
      left: "calc(50% - 75px)",
      width: "150px",
      height: "50px",
      backgroundColor: "rgba(0, 122, 255, 0.9)",
      color: "white",
      border: "none",
      borderRadius: "10px",
      fontSize: "18px",
      fontWeight: "bold",
      cursor: "pointer",
      zIndex: "100"
    });
    
    document.body.appendChild(arButton);

    // Controller setup
    const controller = renderer.xr.getController(0);
    scene.add(controller);

    const raycaster = new THREE.Raycaster();
    let pressStartTime = 0;
    const LONG_PRESS_DURATION = 200;

    const onSelectStart = () => {
      pressStartTime = Date.now();
      
      if (!renderer.xr.isPresenting) return;

      const controllerMatrix = controller.matrixWorld;
      const origin = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
      const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
        new THREE.Matrix4().extractRotation(controllerMatrix)
      );
      raycaster.set(origin, direction);

      const allMeshes = windowsRef.current.flatMap(w => [w.contentMesh, w.titleBarMesh]);
      const intersects = raycaster.intersectObjects(allMeshes, false);

      if (intersects.length > 0) {
        handleInteraction(intersects[0], true);
      }
    };

    const onSelectEnd = () => {
      const pressDuration = Date.now() - pressStartTime;
      
      if (dragStateRef.current.isDragging) {
        endDrag();
        return;
      }

      if (pressDuration < LONG_PRESS_DURATION && renderer.xr.isPresenting) {
        // Short press - handle as click
        const controllerMatrix = controller.matrixWorld;
        const origin = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
        const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
          new THREE.Matrix4().extractRotation(controllerMatrix)
        );
        raycaster.set(origin, direction);

        const allMeshes = windowsRef.current.flatMap(w => [w.contentMesh, w.titleBarMesh]);
        const intersects = raycaster.intersectObjects(allMeshes, false);

        if (intersects.length > 0) {
          handleInteraction(intersects[0], false);
        }
      }
    };

    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);

    // Session event handlers
    const handleSessionStart = () => {
      setIsArActive(true);
      if (overlayRef.current) {
        overlayRef.current.style.display = 'block';
        renderOverlayUI();
      }
    };

    const handleSessionEnd = () => {
      setIsArActive(false);
      if (overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
    };

    renderer.xr.addEventListener('sessionstart', handleSessionStart);
    renderer.xr.addEventListener('sessionend', handleSessionEnd);

    // Animation loop
    renderer.setAnimationLoop(() => {
      updateDrag();
      
      // Billboard effect
      if (renderer.xr.isPresenting) {
        const xrCamera = renderer.xr.getCamera(camera);
        windowsRef.current.forEach(window => {
          window.group.lookAt(xrCamera.position);
        });
      }
      
      renderer.render(scene, camera);
    });

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      controller.removeEventListener('selectstart', onSelectStart);
      controller.removeEventListener('selectend', onSelectEnd);
      renderer.xr.removeEventListener('sessionstart', handleSessionStart);
      renderer.xr.removeEventListener('sessionend', handleSessionEnd);
      
      if (document.body.contains(arButton)) {
        document.body.removeChild(arButton);
      }
      
      // Clean up all windows
      windowsRef.current.forEach(window => window.destroy());
      windowsRef.current = [];
      
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };
  }, []);

  // Overlay UI rendering
  const renderOverlayUI = () => {
    if (!overlayRef.current) return;

    overlayRef.current.innerHTML = `
      <div style="position: absolute; top: 20px; right: 20px; background: rgba(0, 0, 0, 0.8); color: white; padding: 20px; border-radius: 12px; min-width: 280px; backdrop-filter: blur(10px);">
        <h3 style="margin: 0 0 15px 0; color: #00bfff; text-align: center;">AR Browser Controls</h3>
          <div style="margin-bottom: 15px;">          <button id="ai-speech" style="width: 100%; padding: 12px; margin-bottom: 8px; border: none; border-radius: 6px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; font-weight: bold; cursor: pointer; box-shadow: 0 2px 10px rgba(79, 70, 229, 0.3);">
            🎤 Start AI Speech
          </button>
          <button id="demo-html" style="width: 100%; padding: 10px; margin-bottom: 8px; border: none; border-radius: 6px; background: #4CAF50; color: white; font-weight: bold; cursor: pointer;">
            Create HTML Window
          </button>
          <button id="demo-iframe" style="width: 100%; padding: 10px; margin-bottom: 8px; border: none; border-radius: 6px; background: #2196F3; color: white; font-weight: bold; cursor: pointer;">
            Create Iframe Window
          </button>
        </div>
        
        <div style="margin-bottom: 15px;">
          <input id="url-input" type="text" placeholder="Enter URL..." style="width: 100%; padding: 8px; margin-bottom: 8px; border: 1px solid #555; border-radius: 4px; background: rgba(255,255,255,0.1); color: white;">
          <button id="load-url" style="width: 100%; padding: 8px; border: none; border-radius: 4px; background: #FF9800; color: white; font-weight: bold; cursor: pointer;">
            Load URL
          </button>
        </div>
        
        <div style="font-size: 12px; color: #aaa; text-align: center;">
          Hold title bar to drag windows<br>
          Tap × to close windows
        </div>
      </div>
    `;    // Add event listeners
    const aiSpeechBtn = overlayRef.current.querySelector('#ai-speech');
    const demoHtmlBtn = overlayRef.current.querySelector('#demo-html');
    const demoIframeBtn = overlayRef.current.querySelector('#demo-iframe');
    const urlInput = overlayRef.current.querySelector('#url-input');
    const loadUrlBtn = overlayRef.current.querySelector('#load-url');

    aiSpeechBtn.onclick = () => {
      if (isListening) {
        // Stop AI speech
        setIsListening(false);
        console.log('AI Speech stopped');
        // Here you would stop the actual AI speech connection
      } else {
        // Start AI speech
        setIsListening(true);
        console.log('AI Speech started');
        // Here you would start the actual AI speech connection
        // For demo purposes, simulate an AI response after 3 seconds
        setTimeout(() => {
          const demoResponses = [
            `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 15px; color: white;">
              <h2 style="margin: 0 0 20px 0; text-align: center;">📊 Data Visualization</h2>
              <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 15px 0;">
                <canvas id="chart" width="400" height="200" style="background: white; border-radius: 5px;"></canvas>
                <script>
                  const canvas = document.getElementById('chart');
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#4f46e5';
                  for(let i = 0; i < 10; i++) {
                    ctx.fillRect(i * 40, 200 - Math.random() * 150, 30, Math.random() * 150);
                  }
                </script>
              </div>
              <p>Here's a sample data visualization created by AI!</p>
            </div>
            `,
            `
            <div style="background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%); padding: 25px; border-radius: 15px; color: white;">
              <h2 style="margin: 0 0 20px 0;">🧠 AI Analysis</h2>
              <div style="background: rgba(255,255,255,0.9); color: #333; padding: 20px; border-radius: 10px; margin: 15px 0;">
                <h3>Key Insights:</h3>
                <ul style="line-height: 2;">
                  <li>📈 Market trends showing 15% growth</li>
                  <li>🎯 User engagement increased by 23%</li>
                  <li>💡 3 optimization opportunities identified</li>
                </ul>
              </div>
              <p>This analysis was generated using advanced AI algorithms.</p>
            </div>
            `,
            "Hello! I'm your AI assistant. I can create interactive visualizations, charts, and helpful content for you in AR space. What would you like me to help you with today?"
          ];
          const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
          handleAIResponse(randomResponse);
          setIsListening(false);
        }, 3000);
      }      // Update button text
      aiSpeechBtn.innerHTML = `🎤 ${!isListening ? 'Stop AI Speech' : 'Start AI Speech'}`;
    };

    demoHtmlBtn.onclick = () => {
      const sampleHTML = `
        <div style="padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; height: 100%; box-sizing: border-box;">
          <h2 style="margin: 0 0 15px 0; color: #fff;">Interactive Demo</h2>
          <p>This is a dynamic HTML window in AR!</p>
          <button onclick="this.innerText='Clicked!'; this.style.background='#ff4444';" style="padding: 8px 16px; border: none; border-radius: 4px; background: #fff; color: #333; cursor: pointer; margin: 10px 0;">
            Click Me!
          </button>
          <div style="margin-top: 15px;">
            <input type="text" placeholder="Type here..." style="width: 100%; padding: 6px; border: none; border-radius: 4px; margin-bottom: 8px;">
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 4px; font-size: 12px;">
              Current time: ${new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      `;
      
      createHTMLWindow(sampleHTML, {
        title: "HTML Demo",
        position: { x: Math.random() * 2 - 1, y: 0, z: -3 }
      });
    };

    demoIframeBtn.onclick = () => {
      createIframeWindow('https://example.com', {
        title: "Example.com",
        position: { x: Math.random() * 2 - 1, y: 0, z: -3 }
      });
    };

    loadUrlBtn.onclick = () => {
      const url = urlInput.value.trim();
      if (url) {
        const finalUrl = url.startsWith('http') ? url : `https://${url}`;
        createIframeWindow(finalUrl, {
          title: url,
          position: { x: Math.random() * 2 - 1, y: 0, z: -3 }
        });
        urlInput.value = '';
      }
    };

    urlInput.onkeypress = (e) => {
      if (e.key === 'Enter') {
        loadUrlBtn.click();
      }
    };
  };

  // AI integration functions
  const createARWindowFromAI = async (content, options = {}) => {
    try {
      let htmlContent;
      
      // Check if content is already HTML or plain text
      if (typeof content === 'string') {
        // Simple check to see if it's HTML
        if (content.trim().startsWith('<') && content.trim().endsWith('>')) {
          htmlContent = content;
        } else {
          // Wrap plain text in styled HTML
          htmlContent = `
            <div style="padding: 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-radius: 12px; height: 100%; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite;"></div>
                <h3 style="margin: 0; color: #f8fafc; font-size: 16px; font-weight: 600;">AI Response</h3>
              </div>
              <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);">
                <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #f1f5f9;">${content.replace(/\n/g, '<br>')}</p>
              </div>
              <div style="margin-top: 15px; font-size: 11px; color: rgba(255,255,255,0.6); text-align: right;">
                Generated at ${new Date().toLocaleTimeString()}
              </div>
              <style>
                @keyframes pulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.5; }
                }
              </style>
            </div>
          `;
        }
      } else {
        // Handle other types (objects, etc.)
        htmlContent = `
          <div style="padding: 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-radius: 12px; height: 100%; box-sizing: border-box;">
            <h3 style="margin: 0 0 15px 0; color: #f8fafc;">AI Response</h3>
            <pre style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; white-space: pre-wrap; font-size: 12px; color: #f1f5f9; margin: 0;">${JSON.stringify(content, null, 2)}</pre>
          </div>
        `;
      }

      // Create AR window with AI-specific defaults
      const windowOptions = {
        title: options.title || "AI Speech",
        position: options.position || { 
          x: Math.random() * 2 - 1, 
          y: Math.random() * 1 - 0.5, 
          z: -3 
        },
        ...options
      };

      const window = await createHTMLWindow(htmlContent, windowOptions);
      
      // Optional: Auto-update content periodically if it's dynamic
      if (options.autoUpdate) {
        const updateInterval = setInterval(async () => {
          if (windowsRef.current.includes(window)) {
            await window.updateContent();
          } else {
            clearInterval(updateInterval);
          }
        }, options.updateInterval || 5000);
      }

      return window;
    } catch (error) {
      console.error("Error creating AR window from AI content:", error);
      
      // Fallback error window
      const errorHTML = `
        <div style="padding: 20px; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; border-radius: 12px; height: 100%; box-sizing: border-box;">
          <h3 style="margin: 0 0 15px 0; color: #fef2f2;">Error</h3>
          <p style="margin: 0; color: #fecaca;">Failed to display AI content: ${error.message}</p>
        </div>
      `;
      
      return await createHTMLWindow(errorHTML, { 
        title: "Error", 
        position: options.position || { x: 0, y: 0, z: -3 } 
      });
    }
  };
  // Handler for AI speech events and responses
  const handleAIResponse = async (responseText, options = {}) => {
    // Check if response contains HTML
    if (responseText.includes('<') && responseText.includes('>')) {
      await createARWindowFromAI(responseText, "AI Visualization");
    } else {
      // Convert plain text to HTML
      const htmlResponse = `
        <div style="background: rgba(255,255,255,0.95); padding: 20px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <div style="display: flex; align-items: center; margin-bottom: 15px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-size: 20px;">🤖</div>
            <h3 style="margin: 0; color: #1f2937; font-size: 18px;">AI Assistant Response</h3>
          </div>
          <div style="color: #374151; line-height: 1.6; font-size: 14px;">
            ${responseText.replace(/\n/g, '<br>')}
          </div>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: right;">
            Generated at ${new Date().toLocaleTimeString()}
          </div>
        </div>
      `;
      await createARWindowFromAI(htmlResponse, "AI Response");
    }
  };  // Expose functions globally for external access (like from Jarvis)
  useEffect(() => {
    // Make functions available globally
    window.createARWindowFromAI = createARWindowFromAI;
    window.handleAIResponse = handleAIResponse;
    window.createHTMLWindow = createHTMLWindow;
    window.createIframeWindow = createIframeWindow;
    
    console.log("AR Browser functions exposed globally:", {
      createARWindowFromAI: !!window.createARWindowFromAI,
      handleAIResponse: !!window.handleAIResponse,
      createHTMLWindow: !!window.createHTMLWindow,
      createIframeWindow: !!window.createIframeWindow
    });

    // Cleanup
    return () => {
      delete window.createARWindowFromAI;
      delete window.handleAIResponse;
      delete window.createHTMLWindow;
      delete window.createIframeWindow;
    };
  }, [createARWindowFromAI, handleAIResponse, createHTMLWindow, createIframeWindow]);

  return (
    <>
      {/* AR overlay */}
      <div
        id="xr-ui-overlay"
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 1000,
          display: 'none'
        }}
      />

      {/* Three.js mount point */}
      <div
        ref={mountRef}
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      />

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 2000
        }}>
          Loading...
        </div>
      )}
    </>
  );
}