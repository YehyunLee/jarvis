import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import html2canvas from 'html2canvas';
import './ar-scene.scss';
import { useWebcam } from '../../hooks/use-webcam';

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
      left: 0;
      top: 0;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: auto;
    `;
    document.body.appendChild(iframe);
    this.htmlElement = iframe;

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
}

interface ARSceneProps {
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}
const ARScene = React.forwardRef<ARSceneHandles, ARSceneProps>((props, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const windowsRef = useRef<ARWindow[]>([]);
  const dragStateRef = useRef({
    isDragging: false,
    draggedWindow: null as ARWindow | null,
    dragDepth: 0,
    dragOffset: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcam = useWebcam();

  const createWindow = (scene: THREE.Scene, options = {}) => {
    const id = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const window = new ARWindow(id, scene, options);
    windowsRef.current.push(window);
    return window;
  };

  const createHTMLWindow = async (htmlContent: string, options = {}) => {
    if (!sceneRef.current) return;
    const window = createWindow(sceneRef.current, options);
    await window.setHTMLContent(htmlContent);
    return window;
  };

  const createIframeWindow = async (url: string, options = {}) => {
    if (!sceneRef.current) return;
    const windowObj = createWindow(sceneRef.current, options);
    await windowObj.setIframeContent(url);
    return windowObj;
  };

  React.useImperativeHandle(ref, () => ({
    createHTMLWindow: async (htmlContent: string, options?: any) => {
      await createHTMLWindow(htmlContent, options);
    },
  }));
  // Expose createHTMLWindow globally for external calls
  useEffect(() => {
    (window as any).createARHTMLWindow = async (html: string) => {
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
    return () => {
      delete (window as any).createARHTMLWindow;
    };
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
  }, []);

  useEffect(() => {
    if (!rendererRef.current) return;
    const renderer = rendererRef.current;
    const onStart = () => {
      props.onSessionStart?.();
    };
    const onEnd = () => {
      props.onSessionEnd?.();
    };
    renderer.xr.addEventListener('sessionstart', onStart);
    renderer.xr.addEventListener('sessionend', onEnd);
    return () => {
      renderer.xr.removeEventListener('sessionstart', onStart);
      renderer.xr.removeEventListener('sessionend', onEnd);
    };
  }, [props.onSessionStart, props.onSessionEnd]);

  return (
    <div className="ar-scene-wrapper">
      {/* Video background streams only during AR session */}
      <video ref={videoRef} className="ar-video-bg" autoPlay muted playsInline />
      <div ref={mountRef} className="ar-scene-container" />
    </div>
    );
});

export default ARScene;
