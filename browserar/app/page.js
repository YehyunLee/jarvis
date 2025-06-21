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
        
        <div style="margin-bottom: 15px;">
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
    `;

    // Add event listeners
    const demoHtmlBtn = overlayRef.current.querySelector('#demo-html');
    const demoIframeBtn = overlayRef.current.querySelector('#demo-iframe');
    const urlInput = overlayRef.current.querySelector('#url-input');
    const loadUrlBtn = overlayRef.current.querySelector('#load-url');

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

  // Expose functions globally for external use
  useEffect(() => {
    window.createARHTMLWindow = createHTMLWindow;
    window.createARIframeWindow = createIframeWindow;
    window.getARWindow = getWindowById;
    
    return () => {
      delete window.createARHTMLWindow;
      delete window.createARIframeWindow;
      delete window.getARWindow;
    };
  }, []);

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