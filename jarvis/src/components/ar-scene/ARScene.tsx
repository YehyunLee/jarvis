/**
 * AR Scene Component with Interactive Window Support
 * 
 * Features:
 * - Click detection and interaction with AR windows
 * - Support for HTML content windows
 * - Support for iframe windows with full web pages
 * - Raycasting for 3D to 2D coordinate mapping
 * - Interactive overlay for iframe content
 * 
 * Usage:
 * - Use createHTMLWindow() for HTML content
 * - Use createIframeWindow() for web pages
 * - Use createWindowFromURL() for user-prompted URL input
 * - Click on AR windows to interact with content
 * - Click close button (X) on title bar to close windows
 * 
 * Global functions exposed:
 * - window.createARHTMLWindow(html)
 * - window.createARIframeWindow(url)
 * - window.createARWindowFromURL()
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import html2canvas from 'html2canvas';
import './ar-scene.scss';

// Constants from ar.js
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

// ARWindow class from ar.js, converted to TypeScript
class ARWindow {
  id: string;
  group: THREE.Group;
  contentMesh: THREE.Mesh | null;
  titleBarMesh: THREE.Mesh | null;
  contentTexture: THREE.CanvasTexture | null;
  titleBarTexture: THREE.CanvasTexture | null;
  htmlElement: HTMLElement | null;
  isDraggable: boolean;
  title: string;
  position: { x: number; y: number; z: number };
  isIframe: boolean;

  constructor(id: string, scene: THREE.Scene, options: any = {}) {
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
    this.isIframe = false;

    this.init(scene);
  }

  init(scene: THREE.Scene) {
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.createContentPlane();
    this.createTitleBar();
    scene.add(this.group);
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
    if (!this.titleBarTexture) return;
    const canvas = this.titleBarTexture.image;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(30, 30, 40, 0.95)");
    gradient.addColorStop(1, "rgba(15, 15, 25, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(100, 150, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

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

    ctx.shadowColor = "rgba(100, 150, 255, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(200, 220, 255, 0.95)";
    ctx.font = `bold ${CONFIG.TITLE_BAR_HEIGHT_PX * 0.35}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText(this.title, 15, canvas.height / 2);
    ctx.shadowBlur = 0;

    this.titleBarTexture.needsUpdate = true;
  }

  async setHTMLContent(htmlContent: string) {
    if (this.htmlElement && this.htmlElement.parentNode) {
      this.htmlElement.parentNode.removeChild(this.htmlElement);
    }

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

    await this.updateContent();
  }

  async updateContent() {
    if (!this.htmlElement || !this.contentTexture) return;

    try {
      const canvas = this.contentTexture.image;
      await html2canvas(this.htmlElement, {
        canvas,
        width: CONFIG.CONTENT_WIDTH,
        height: CONFIG.CONTENT_HEIGHT,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      this.contentTexture.needsUpdate = true;
    } catch (error) {
      console.error("Error updating window content:", error);
    }
  }
  handleClick(uv: THREE.Vector2): boolean {
    if (!this.htmlElement) return false;

    // Convert UV coordinates to pixel coordinates
    const x = uv.x * CONFIG.CONTENT_WIDTH;
    const y = (1 - uv.y) * CONFIG.CONTENT_HEIGHT; // Flip Y coordinate

    if (this.isIframe && this.htmlElement instanceof HTMLIFrameElement) {
      // For iframes, show the interactive overlay
      this.showInteractiveIframe();
      return true;
    } else {
      // For regular HTML content, we need to temporarily position the element
      // to use elementFromPoint, then restore its position
      const originalLeft = this.htmlElement.style.left;
      const originalTop = this.htmlElement.style.top;
      const originalZIndex = this.htmlElement.style.zIndex;
      
      // Temporarily position the element for interaction
      this.htmlElement.style.left = '0px';
      this.htmlElement.style.top = '0px';
      this.htmlElement.style.zIndex = '9999';
      
      try {
        const elementAtPoint = document.elementFromPoint(x, y);
        
        if (elementAtPoint && this.htmlElement.contains(elementAtPoint)) {
          // Create and dispatch a click event
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y
          });
          elementAtPoint.dispatchEvent(clickEvent);
          
          // Restore original position
          this.htmlElement.style.left = originalLeft;
          this.htmlElement.style.top = originalTop;
          this.htmlElement.style.zIndex = originalZIndex;
          
          // Update the content after interaction
          setTimeout(() => this.updateContent(), 100);
          return true;
        }
      } catch (error) {
        console.error('Error handling click:', error);
      } finally {
        // Ensure we restore the original position
        this.htmlElement.style.left = originalLeft;
        this.htmlElement.style.top = originalTop;
        this.htmlElement.style.zIndex = originalZIndex;
      }
    }
    return false;
  }
  showInteractiveIframe() {
    if (!this.isIframe || !(this.htmlElement instanceof HTMLIFrameElement)) return;

    // Create a modal overlay for iframe interaction
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const iframeContainer = document.createElement('div');
    iframeContainer.style.cssText = `
      width: 90vw;
      height: 90vh;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      position: absolute;
      top: 5px;
      right: 5px;
      background: rgba(255, 0, 0, 0.9);
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      cursor: pointer;
      z-index: 10001;
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: manipulation;
    `;

    const interactiveIframe = document.createElement('iframe');
    interactiveIframe.src = (this.htmlElement as HTMLIFrameElement).src;
    interactiveIframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Multiple event handlers for better mobile compatibility
    const closeModal = () => {
      console.log('Modal close button clicked');
      try {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        // Update the AR window content after closing
        setTimeout(() => this.updateContent(), 100);
      } catch (error) {
        console.error('Error closing modal:', error);
      }
    };

    closeButton.addEventListener('click', closeModal);
    closeButton.addEventListener('touchstart', closeModal);
    closeButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      closeModal();
    });

    // Also close when clicking the overlay background
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    iframeContainer.appendChild(interactiveIframe);
    iframeContainer.appendChild(closeButton);
    overlay.appendChild(iframeContainer);
    document.body.appendChild(overlay);

    console.log('Interactive iframe modal created');
  }

  async setIframeContent(url: string) {
    if (this.htmlElement && this.htmlElement.parentNode) {
      this.htmlElement.parentNode.removeChild(this.htmlElement);
    }

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = `
      width: ${CONFIG.CONTENT_WIDTH}px;
      height: ${CONFIG.CONTENT_HEIGHT}px;
      border: none;
      position: absolute;
      left: -9999px;
      top: 0;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: auto;
    `;
    document.body.appendChild(iframe);
    this.htmlElement = iframe;
    this.isIframe = true;

    // Update the content texture once the iframe is loaded
    iframe.onload = () => {
      this.updateContent();
    };
  }

  destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    if (this.htmlElement && this.htmlElement.parentNode) {
      this.htmlElement.parentNode.removeChild(this.htmlElement);
    }
    if (this.contentTexture) this.contentTexture.dispose();
    if (this.titleBarTexture) this.titleBarTexture.dispose();
    if (this.contentMesh) {
      this.contentMesh.geometry.dispose();
      (this.contentMesh.material as THREE.Material).dispose();
    }
    if (this.titleBarMesh) {
      this.titleBarMesh.geometry.dispose();
      (this.titleBarMesh.material as THREE.Material).dispose();
    }
  }
}

export interface ARSceneHandles {
  createHTMLWindow: (htmlContent: string, options?: any) => Promise<void>;
  createIframeWindow: (url: string, options?: any) => Promise<void>;
  createWindowFromURL: () => Promise<void>;
}

interface ARSceneProps {
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}
const ARScene = React.forwardRef<ARSceneHandles, ARSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const windowsRef = useRef<ARWindow[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragStateRef = useRef({
    isDragging: false,
    draggedWindow: null as ARWindow | null,
    dragDepth: 0,
    dragOffset: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
  });

  const createWindow = (scene: THREE.Scene, options = {}) => {
    const id = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const window = new ARWindow(id, scene, options);
    windowsRef.current.push(window);
    return window;
  };
  const createHTMLWindow = useCallback(async (htmlContent: string, options = {}) => {
    if (!sceneRef.current) return;
    const window = createWindow(sceneRef.current, options);
    await window.setHTMLContent(htmlContent);
    return window;
  }, []);

  const createIframeWindow = useCallback(async (url: string, options = {}) => {
    if (!sceneRef.current) return;
    const windowObj = createWindow(sceneRef.current, options);
    await windowObj.setIframeContent(url);
    return windowObj;
  }, []);
  
  const createWindowFromURL = useCallback(async () => {
    const url = prompt("Enter the URL for the AR window:");
    if (url) {
      await createIframeWindow(url, { title: `Web: ${url}` });
    }
  }, [createIframeWindow]);

  React.useImperativeHandle(ref, () => ({
    createHTMLWindow: async (htmlContent: string, options?: any) => {
      await createHTMLWindow(htmlContent, options);
    },
    createIframeWindow: async (url: string, options?: any) => {
      await createIframeWindow(url, options);
    },
    createWindowFromURL: async () => {
      await createWindowFromURL();
    },
  }));  // Create a test window on start for demonstration
  useEffect(() => {
    const createTestWindow = async () => {
      const msg = 'Creating test window...';
      console.log(msg);
      (window as any).addDebugMessage?.(msg);
      
      if (sceneRef.current) {
        // Use a simple iframe with our test page
        setTimeout(async () => {
          const timeoutMsg = 'Timeout reached, creating iframe test window...';
          console.log(timeoutMsg);
          (window as any).addDebugMessage?.(timeoutMsg);
            const testUrl = window.location.origin + '/click-test.html';
          await createIframeWindow(testUrl, { 
            title: "Click Test Window",
            position: { x: 0, y: 0, z: -3 }
          });
          
          const successMsg = `Test iframe created! Windows: ${windowsRef.current.length}`;
          console.log(successMsg);
          (window as any).addDebugMessage?.(successMsg);
        }, 3000); // Wait 3 seconds for everything to be ready
      } else {
        const errorMsg = 'Scene ref not available';
        console.log(errorMsg);
        (window as any).addDebugMessage?.(errorMsg);
      }
    };
    
    createTestWindow();
  }, [createIframeWindow]);
  // Expose createHTMLWindow globally for external calls
  useEffect(() => {
    const createHTMLWindowLocal = async (html: string) => {
      // If full HTML document, render via iframe
      if (/^\s*<\s*html/i.test(html)) {
        // create blob URL for HTML document
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        await createIframeWindow(url);
        URL.revokeObjectURL(url);
      } else {
        await createHTMLWindow(html);
      }
    };

    (window as any).createARHTMLWindow = createHTMLWindowLocal;
    (window as any).createARIframeWindow = createIframeWindow;
    (window as any).createARWindowFromURL = createWindowFromURL;
    
    return () => {
      delete (window as any).createARHTMLWindow;
      delete (window as any).createARIframeWindow;
      delete (window as any).createARWindowFromURL;
    };
  }, [createHTMLWindow, createIframeWindow, createWindowFromURL]);  // Add click handling with raycasting and drag support
  useEffect(() => {
    // Wait for all refs to be ready
    const checkAndSetupEvents = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        console.log('Refs not ready, retrying...');
        setTimeout(checkAndSetupEvents, 100);
        return;
      }

      console.log('Setting up event handlers');
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let mouseDownTime = 0;
      let mouseDownPos = { x: 0, y: 0 };      const handleMouseDown = (event: MouseEvent) => {
      const debugMsg = 'Mouse down detected';
      console.log(debugMsg);
      (window as any).addDebugMessage?.(debugMsg);
      
      mouseDownTime = Date.now();
      mouseDownPos = { x: event.clientX, y: event.clientY };
      
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        const errorMsg = `Missing refs: renderer=${!!rendererRef.current}, scene=${!!sceneRef.current}, camera=${!!cameraRef.current}`;
        console.log(errorMsg);
        (window as any).addDebugMessage?.(errorMsg);
        return;
      }

      // Calculate normalized device coordinates
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      const coordsMsg = `Mouse coords: ${mouse.x.toFixed(2)}, ${mouse.y.toFixed(2)}`;
      console.log(coordsMsg);
      (window as any).addDebugMessage?.(coordsMsg);

      raycaster.setFromCamera(mouse, cameraRef.current);      const meshes: THREE.Mesh[] = [];
      windowsRef.current.forEach(window => {
        if (window.titleBarMesh) meshes.push(window.titleBarMesh);
      });
      
      const meshMsg = `Checking ${meshes.length} title bar meshes, ${windowsRef.current.length} windows total`;
      console.log(meshMsg);
      (window as any).addDebugMessage?.(meshMsg);

      const intersects = raycaster.intersectObjects(meshes);
      const intersectMsg = `Found ${intersects.length} intersections`;
      console.log(intersectMsg);
      (window as any).addDebugMessage?.(intersectMsg);
      
      if (intersects.length > 0) {
        const intersection = intersects[0];
        const windowId = intersection.object.userData.windowId;
        const window = windowsRef.current.find(w => w.id === windowId);
        
        if (window && intersection.uv && intersection.uv.x <= 0.85) { // Not on close button
          // Start dragging
          dragStateRef.current.isDragging = true;
          dragStateRef.current.draggedWindow = window;
          dragStateRef.current.dragDepth = intersection.distance;
          
          // Calculate drag offset
          const worldPos = new THREE.Vector3();
          window.group.getWorldPosition(worldPos);
          dragStateRef.current.dragOffset.copy(worldPos).sub(intersection.point);
          
          // Set up drag plane
          dragStateRef.current.dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 0, 1),
            intersection.point
          );
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.isDragging || !dragStateRef.current.draggedWindow) return;
      if (!rendererRef.current || !cameraRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersection = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragStateRef.current.dragPlane, intersection)) {
        intersection.add(dragStateRef.current.dragOffset);
        dragStateRef.current.draggedWindow.group.position.copy(intersection);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      const clickDuration = Date.now() - mouseDownTime;
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );

      // If it was a short click with minimal movement, treat as click
      if (clickDuration < 300 && moveDistance < 5) {
        handleClick(event);
      }

      // Reset drag state
      dragStateRef.current.isDragging = false;
      dragStateRef.current.draggedWindow = null;
    };    const handleClick = (event: MouseEvent) => {
      console.log('Handle click called');
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        console.log('Missing refs in click handler');
        return;
      }

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      console.log('Click mouse coords:', mouse.x, mouse.y);

      raycaster.setFromCamera(mouse, cameraRef.current);

      const meshes: THREE.Mesh[] = [];
      windowsRef.current.forEach(window => {
        if (window.contentMesh) meshes.push(window.contentMesh);
        if (window.titleBarMesh) meshes.push(window.titleBarMesh);
      });
      console.log('Click checking', meshes.length, 'meshes');

      const intersects = raycaster.intersectObjects(meshes);
      console.log('Click intersections:', intersects.length);
      
      if (intersects.length > 0) {
        const intersection = intersects[0];
        const windowId = intersection.object.userData.windowId;
        const type = intersection.object.userData.type;
        
        const window = windowsRef.current.find(w => w.id === windowId);
        if (window && type === 'content' && intersection.uv) {
          console.log('Content clicked at UV:', intersection.uv);
          window.handleClick(intersection.uv);        } else if (window && type === 'titlebar' && intersection.uv) {
          console.log('Title bar clicked at UV:', intersection.uv);
          if (intersection.uv.x > 0.85) {
            console.log('Close button clicked');
            window.destroy();
            windowsRef.current = windowsRef.current.filter(w => w.id !== windowId);
          }
          // Title bar click handling removed - no more dialog boxes
        }
      }    };

    const canvas = rendererRef.current.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  };

  checkAndSetupEvents();
}, []);
  useEffect(() => {
    // Three.js setup
    if (typeof window === "undefined" || !mountRef.current) return;

    const currentMount = mountRef.current;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test', 'dom-overlay'],
      optionalFeatures: ['local-floor'],
      domOverlay: { root: document.body }
    });
    arButton.id = "ar-button";
    document.body.appendChild(arButton);

    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    return () => {
      if (document.body.contains(arButton)) {
        document.body.removeChild(arButton);
      }
      renderer.dispose();
      if (currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);  // Add simple click test for debugging
  useEffect(() => {
    const simpleClickTest = (event: MouseEvent) => {
      const logData = {
        message: 'SIMPLE CLICK TEST - ANY CLICK DETECTED',
        target: event.target?.constructor.name || 'unknown',
        windowsAvailable: windowsRef.current.length,
        timestamp: new Date().toISOString()
      };
      
      console.log('SIMPLE CLICK TEST - ANY CLICK DETECTED');
      console.log('Event target:', event.target);
      console.log('Windows available:', windowsRef.current.length);
      
      // Send to server for logging
      fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      }).catch(() => {}); // Ignore errors if no server endpoint
      
      // Test direct raycasting
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        
        // Get ALL objects in the scene for testing
        const allObjects: THREE.Object3D[] = [];
        sceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            allObjects.push(child);
          }
        });
        
        const intersects = raycaster.intersectObjects(allObjects);
        const raycastData = {
          message: 'RAYCAST RESULTS',
          totalMeshes: allObjects.length,
          intersections: intersects.length,
          mouseCoords: { x: mouse.x, y: mouse.y },
          firstIntersection: intersects.length > 0 ? {
            distance: intersects[0].distance,
            userData: intersects[0].object.userData
          } : null
        };
        
        console.log('Total meshes in scene:', allObjects.length);
        console.log('DIRECT RAYCAST INTERSECTIONS:', intersects.length);
        
        // Send raycast data to server
        fetch('/api/debug-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(raycastData)
        }).catch(() => {});
        
        if (intersects.length > 0) {
          console.log('First intersection:', intersects[0]);
          console.log('Object userData:', intersects[0].object.userData);
        }
      }
    };

    // Add to document body for global click detection
    document.addEventListener('click', simpleClickTest);
    
    return () => {
      document.removeEventListener('click', simpleClickTest);
    };
  }, []);  // Add keyboard shortcut for testing
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 't' || event.key === 'T') {
        const msg = 'T key pressed - creating test window';
        console.log(msg);
        (window as any).addDebugMessage?.(msg);
        
        const simpleHTML = `
          <div style="padding: 20px; background: red; color: white; font-size: 24px; text-align: center;">
            <h1>CLICK TEST</h1>
            <button onclick="console.log('BUTTON CLICKED!'); this.style.background='green'; this.textContent='SUCCESS!'" 
                    style="padding: 20px; font-size: 20px; background: blue; color: white; border: none; cursor: pointer;">
              BIG CLICK TARGET
            </button>
          </div>
        `;
        createHTMLWindow(simpleHTML, { 
          title: "Keyboard Test",
          position: { x: 1, y: 0, z: -2 }
        });
      }
      
      if (event.key === 'i' || event.key === 'I') {
        const msg = 'I key pressed - creating iframe test';
        console.log(msg);
        (window as any).addDebugMessage?.(msg);
        
        createIframeWindow('/click-test.html', { 
          title: "Iframe Test",
          position: { x: -1, y: 0, z: -2 }
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [createHTMLWindow, createIframeWindow]);
  // Add visual debugging overlay for mobile
  useEffect(() => {
    const debugOverlay = document.createElement('div');
    debugOverlay.id = 'debug-overlay';
    debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      width: 300px;
      max-height: 200px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
      overflow-y: auto;
      pointer-events: none;
      display: none;
    `;
    document.body.appendChild(debugOverlay);

    // Show debug overlay when 'd' key is pressed
    const handleDebugToggle = (event: KeyboardEvent) => {
      if (event.key === 'd' || event.key === 'D') {
        const overlay = document.getElementById('debug-overlay');
        if (overlay) {
          overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        }
      }
    };

    window.addEventListener('keydown', handleDebugToggle);

    // Function to add debug message to overlay
    (window as any).addDebugMessage = (message: string) => {
      const overlay = document.getElementById('debug-overlay');
      if (overlay) {
        const timestamp = new Date().toLocaleTimeString();
        overlay.innerHTML += `<div>[${timestamp}] ${message}</div>`;
        overlay.scrollTop = overlay.scrollHeight;
        
        // Keep only last 20 messages
        const messages = overlay.children;
        while (messages.length > 20) {
          overlay.removeChild(messages[0]);
        }
      }
    };

    return () => {
      window.removeEventListener('keydown', handleDebugToggle);
      const overlay = document.getElementById('debug-overlay');
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      delete (window as any).addDebugMessage;
    };
  }, []);
  // Add touch-based debug toggle (triple tap in top-left corner)
  useEffect(() => {
    let tapCount = 0;
    let tapTimer: NodeJS.Timeout;

    const handleTouch = (event: TouchEvent) => {
      const touch = event.touches[0] || event.changedTouches[0];
      if (touch && touch.clientX < 100 && touch.clientY < 100) {
        tapCount++;
        clearTimeout(tapTimer);
        
        if (tapCount === 3) {
          const overlay = document.getElementById('debug-overlay');
          if (overlay) {
            overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
            (window as any).addDebugMessage?.('Debug overlay toggled');
          }
          tapCount = 0;
        } else {
          tapTimer = setTimeout(() => {
            tapCount = 0;
          }, 1000);
        }
      }
    };

    document.addEventListener('touchstart', handleTouch);
    
    return () => {
      document.removeEventListener('touchstart', handleTouch);
      clearTimeout(tapTimer);
    };
  }, []);
  // Add permanent debug button for mobile
  useEffect(() => {
    const debugButton = document.createElement('button');
    debugButton.textContent = '🐛';
    debugButton.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      font-size: 18px;
      z-index: 9998;
      cursor: pointer;
      touch-action: manipulation;
    `;

    debugButton.addEventListener('click', () => {
      const overlay = document.getElementById('debug-overlay');
      if (overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        (window as any).addDebugMessage?.('Debug overlay toggled via button');
      }
    });

    debugButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      const overlay = document.getElementById('debug-overlay');
      if (overlay) {
        overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
        (window as any).addDebugMessage?.('Debug overlay toggled via touch');
      }
    });

    document.body.appendChild(debugButton);

    return () => {
      if (debugButton.parentNode) {
        debugButton.parentNode.removeChild(debugButton);
      }
    };
  }, []);

  return (
    <div className="ar-scene-wrapper">
      {/* Video background streams only during AR session */}
      <video ref={videoRef} className="ar-video-bg" autoPlay muted playsInline />
      <div ref={mountRef} className="ar-scene-container" />
    </div>
    );
});

export default ARScene;
