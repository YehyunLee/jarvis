import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
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
const ARWindow = class {
  id: string;
  group: THREE.Group;
  contentMesh: THREE.Mesh | null;
  titleBarMesh: THREE.Mesh | null;
  titleBarTexture: THREE.CanvasTexture | null;
  htmlElement: HTMLElement | null;
  isDraggable: boolean;
  title: string;
  position: { x: number; y: number; z: number };
  cssObject: CSS3DObject | null = null;

  constructor(id: string, scene: THREE.Scene, options: any = {}) {
    this.id = id;
    this.group = new THREE.Group();
    this.contentMesh = null;
    this.titleBarMesh = null;
    this.titleBarTexture = null;
    this.htmlElement = null;
    this.isDraggable = true;
    this.title = options.title || "Double Tab & Drag";
    this.position = options.position || { x: 0, y: 0, z: -3 };

    this.init(scene);
  }

  init(scene: THREE.Scene) {
    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.createContentPlane();
    scene.add(this.group);
  }

  createContentPlane() {
    // Invisible plane for raycast interactions covering title + content
    const totalHeight = CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS;
    const geometry = new THREE.PlaneGeometry(CONFIG.PLANE_WIDTH, totalHeight);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });

    this.contentMesh = new THREE.Mesh(geometry, material);
    // Offset so top of plane aligns with title bar top
    this.contentMesh.position.y = -CONFIG.TITLE_BAR_HEIGHT_UNITS / 2;
    this.contentMesh.userData = { windowId: this.id, type: 'window' };
    this.group.add(this.contentMesh);
  }

  async setHTMLContent(htmlContent: string) {
    if (this.cssObject) {
      this.group.remove(this.cssObject);
      this.cssObject = null;
    }
    // Create combined container with title bar and content
    const container = document.createElement('div');
    container.style.width = `${CONFIG.CONTENT_WIDTH}px`;
    container.style.height = `${CONFIG.CONTENT_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_PX}px`;
    container.style.overflow = 'visible'; // allow content overflow
    container.style.background = 'white';
    // Title bar
    const titleDiv = document.createElement('div');
    titleDiv.style.height = `${CONFIG.TITLE_BAR_HEIGHT_PX}px`;
    // Jarvis-style neon header
    titleDiv.style.background = 'rgba(10, 10, 20, 0.8)';
    titleDiv.style.borderBottom = '2px solid #00FFEA';
    titleDiv.style.boxShadow = '0 0 12px #00FFEA, inset 0 -1px 4px rgba(0,255,234,0.7)';
    titleDiv.style.color = '#00FFEA';
    titleDiv.style.fontFamily = '"Space Mono", monospace';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.fontSize = `${CONFIG.TITLE_BAR_HEIGHT_PX * 0.4}px`;
    // titleDiv.style.padding = '0 20px';
    titleDiv.style.display = 'flex';
    titleDiv.style.alignItems = 'center';
    titleDiv.style.justifyContent = 'space-between';
    titleDiv.style.borderTopLeftRadius = '8px';
    titleDiv.style.borderTopRightRadius = '8px';
    titleDiv.textContent = this.title;
    // Add close button UI
    titleDiv.style.position = 'relative';
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.right = '8px';
    // closeBtn.style.top = '50%';
    closeBtn.style.transform = 'translateY(-50%)';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = `${CONFIG.CLOSE_BUTTON_SIZE * 0.6}px`;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });
    titleDiv.appendChild(closeBtn);
    container.appendChild(titleDiv);
    // Content area
    const contentDiv = document.createElement('div');
    contentDiv.style.height = `${CONFIG.CONTENT_HEIGHT}px`;
    // Allow both vertical and horizontal scrolling
    contentDiv.style.overflow = 'auto';
    contentDiv.style.overflowX = 'auto';
    contentDiv.style.overflowY = 'auto';
    // Ensure content can extend horizontally if needed
    // contentDiv.style.whiteSpace = 'pre';
    contentDiv.innerHTML = htmlContent;
    container.appendChild(contentDiv);
    const cssObj = new CSS3DObject(container);
    // Position to align with content plane
    cssObj.position.copy(this.contentMesh!.position);
    // Scale container px to world units
    cssObj.scale.set(
      CONFIG.PLANE_WIDTH / CONFIG.CONTENT_WIDTH,
      (CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS) / (CONFIG.CONTENT_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_PX),
      1
    );
    // Nudge forward slightly so it renders on top
    cssObj.position.z += 0.001;

    this.group.add(cssObj);
    this.cssObject = cssObj;
    this.htmlElement = container;
    container.style.pointerEvents = 'auto'; // re-enable pointer events for window content
  }

  async setIframeContent(url: string) {
    // Similar to HTML content, wrap in container
    if (this.cssObject) {
      this.group.remove(this.cssObject);
      this.cssObject = null;
    }
    const container = document.createElement('div');
    container.style.width = `${CONFIG.CONTENT_WIDTH}px`;
    // container.style.height = `${CONFIG.CONTENT_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_PX}px`;
    container.style.overflow = 'visible'; // allow content overflow
    container.style.background = 'white';
    const titleDiv = document.createElement('div');
    // titleDiv.style.height = `${CONFIG.TITLE_BAR_HEIGHT_PX}`;
    // Jarvis-style neon header
    titleDiv.style.background = 'rgba(10, 10, 20, 0.8)';
    titleDiv.style.borderBottom = '2px solid #00FFEA';
    titleDiv.style.boxShadow = '0 0 12px #00FFEA, inset 0 -1px 4px rgba(0,255,234,0.7)';
    titleDiv.style.color = '#00FFEA';
    titleDiv.style.fontFamily = '"Space Mono", monospace';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.fontSize = `${CONFIG.TITLE_BAR_HEIGHT_PX * 0.4}px`;
    // titleDiv.style.padding = '0 20px';
    titleDiv.style.display = 'flex';
    titleDiv.style.alignItems = 'center';
    titleDiv.style.justifyContent = 'space-between';
    titleDiv.style.borderTopLeftRadius = '8px';
    titleDiv.style.borderTopRightRadius = '8px';
    titleDiv.textContent = this.title;
    // Add close button UI
    titleDiv.style.position = 'relative';
    const closeBtn2 = document.createElement('span');
    closeBtn2.textContent = '×';
    closeBtn2.style.position = 'absolute';
    closeBtn2.style.right = '8px';
    closeBtn2.style.top = '50%';
    closeBtn2.style.transform = 'translateY(-50%)';
    closeBtn2.style.cursor = 'pointer';
    closeBtn2.style.fontSize = `${CONFIG.CLOSE_BUTTON_SIZE * 0.6}px`;
    closeBtn2.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });
    titleDiv.appendChild(closeBtn2);
    container.appendChild(titleDiv);
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = `${CONFIG.CONTENT_WIDTH}px`;
    iframe.style.height = `${CONFIG.CONTENT_HEIGHT}px`;
    iframe.style.border = 'none';
    const contentWrapper = document.createElement('div');
    contentWrapper.appendChild(iframe);
    container.appendChild(contentWrapper);
    const cssObj = new CSS3DObject(container);
    cssObj.position.copy(this.contentMesh!.position);
    cssObj.scale.set(
      CONFIG.PLANE_WIDTH / CONFIG.CONTENT_WIDTH,
      (CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS) / (CONFIG.CONTENT_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_PX),
      1
    );
    cssObj.position.z += 0.001;

    this.group.add(cssObj);
    this.cssObject = cssObj;
    this.htmlElement = container;
    container.style.pointerEvents = 'auto'; // re-enable pointer events for iframe content
  }

  // No-op updateContent for interactive CSS3D mode (exists for compatibility)
  updateContent(): void {
    // no screenshot update needed for CSS3D
  }

  // Handle clicks on the content plane or iframe
  handleClick(uv: THREE.Vector2) {
    if (!this.htmlElement) return;
    const x = Math.floor(uv.x * CONFIG.CONTENT_WIDTH);
    const y = Math.floor((1 - uv.y) * CONFIG.CONTENT_HEIGHT);
    if (this.htmlElement.tagName === 'IFRAME') {
      const iframe = this.htmlElement as HTMLIFrameElement;
      const element = iframe.contentWindow?.document.elementFromPoint(x, y);
      if (element) (element as HTMLElement).click();
    } else {
      const origLeft = this.htmlElement.style.left;
      const origTop = this.htmlElement.style.top;
      this.htmlElement.style.left = '0px';
      this.htmlElement.style.top = '0px';
      const element = document.elementFromPoint(x, y);
      if (element && this.htmlElement.contains(element)) {
        (element as HTMLElement).click();
      }
      this.htmlElement.style.left = origLeft;
      this.htmlElement.style.top = origTop;
    }
  }

  // Handle click on title bar for closing or dragging
  handleTitleBarClick(uv: THREE.Vector2): boolean {
    const uvX = uv.x;
    const start = (CONFIG.CONTENT_WIDTH - CONFIG.CLOSE_BUTTON_SIZE - 16) / CONFIG.CONTENT_WIDTH;
    const end = (CONFIG.CONTENT_WIDTH - 16) / CONFIG.CONTENT_WIDTH;
    if (uvX >= start && uvX <= end) {
      this.destroy();
      return true;
    }
    return false;
  }

  destroy() {
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
    if (this.htmlElement && this.htmlElement.parentNode) {
      this.htmlElement.parentNode.removeChild(this.htmlElement);
    }
    if (this.titleBarTexture) this.titleBarTexture.dispose();
    if (this.contentMesh) {
      this.contentMesh.geometry.dispose();
      (this.contentMesh.material as THREE.Material).dispose();
    }
    if (this.titleBarMesh) {
      this.titleBarMesh.geometry.dispose();
      (this.titleBarMesh.material as THREE.Material).dispose();
    }
    if (this.cssObject) {
      this.group.remove(this.cssObject);
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
  const cssRendererRef = useRef<CSS3DRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const windowsRef = useRef<InstanceType<typeof ARWindow>[]>([]);
  const dragStateRef = useRef({
    isDragging: false,
    draggedWindow: null as InstanceType<typeof ARWindow> | null,
    dragDepth: 0,
    dragOffset: new THREE.Vector3(),
    dragPlane: new THREE.Plane(),
    initialMousePos: new THREE.Vector2(),
    currentMousePos: new THREE.Vector2(),
    isDraggingWithMouse: false,
    smoothingFactor: 0.15, // For smooth interpolation
    targetPosition: new THREE.Vector3(),
    lastFrameTime: 0,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcam = useWebcam();
  const overlayRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  // Function to create a zoom scrollbar for a window
  const setupScrollbar = (windowObj: InstanceType<typeof ARWindow>) => {
    if (!overlayRef.current || !cameraRef.current) return;
    const idx = windowsRef.current.indexOf(windowObj);
    const scrollbar = document.createElement('div');
    // Style scrollbar
    scrollbar.style.position = 'absolute';
    scrollbar.style.top = '50%';
    scrollbar.style.transform = 'translateY(-50%)';
    scrollbar.style.right = `${20 + idx * 36}px`; // gap between scrollbars
    scrollbar.style.width = '16px';
    scrollbar.style.height = '200px'; // adjust as needed
    scrollbar.style.overflowY = 'scroll';
    scrollbar.style.background = 'rgba(255,255,255,0.2)';
    // Add an inner spacer to enable scrolling
    const spacer = document.createElement('div');
    spacer.style.height = '400px';
    scrollbar.appendChild(spacer);
    overlayRef.current.appendChild(scrollbar);
    // Center scrollbar
    const center = scrollbar.scrollHeight / 2 - scrollbar.clientHeight / 2;
    scrollbar.scrollTop = center;
    let lastScrollTop = center;
    scrollbar.addEventListener('scroll', () => {
      const newScrollTop = scrollbar.scrollTop;
      const delta = newScrollTop - lastScrollTop;
      lastScrollTop = newScrollTop;
      const dir = new THREE.Vector3();
      cameraRef.current!.getWorldDirection(dir);
      dir.normalize();
      // Move this window along gaze direction
      windowObj.group.position.add(dir.multiplyScalar(delta * 0.02));
      // reset to center for continuous scroll
      scrollbar.scrollTop = center;
      lastScrollTop = center;
    });
  };

  // Compute a fresh spawn position in front of the user, offsetting by angle to avoid overlap
  const createWindow = (scene: THREE.Scene, options: any = {}) => {
    // Determine base camera for positioning
    let cam: THREE.Camera | null = null;
    if (rendererRef.current) {
      try {
        cam = rendererRef.current.xr.getCamera();
      } catch {
        cam = cameraRef.current;
      }
    } else {
      cam = cameraRef.current;
    }
    // Default position fallback
    let pos = options.position || new THREE.Vector3(0, 0, -3);
    if (cam) {
      const camPos = new THREE.Vector3();
      cam.getWorldPosition(camPos);
      // Use horizontal gaze direction
      const gaze = new THREE.Vector3();
      cam.getWorldDirection(gaze);
      gaze.y = 0;
      gaze.normalize();
      // Compute angle offsets: first window straight ahead, then alternate left/right
      const idx = windowsRef.current.length;
      const step = Math.PI / 8; // 22.5°
      let angleOffset = 0;
      if (idx > 0) {
        const tier = Math.min(Math.ceil(idx / 2), 2); // max 2 tiers => ±45°
        const sign = idx % 2 === 1 ? 1 : -1;
        angleOffset = sign * tier * step;
      }
      gaze.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset);
      // Place a fixed distance in front
      const distance = 2;
      pos = camPos.clone().add(gaze.multiplyScalar(distance));
      // Slightly below eye height
      pos.y = camPos.y - 0.2;
    }
    const id = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const win = new ARWindow(id, scene, { ...options, position: pos });
    windowsRef.current.push(win as InstanceType<typeof ARWindow>);
    return win;
  };

  const createHTMLWindow = async (htmlContent: string, options = {}) => {
    if (!sceneRef.current) return;
    const win = createWindow(sceneRef.current, options);
    await win.setHTMLContent(htmlContent);
    setupScrollbar(win);
    return win;
  };

  const createIframeWindow = async (url: string, options = {}) => {
    if (!sceneRef.current) return;
    const win = createWindow(sceneRef.current, options);
    await win.setIframeContent(url);
    setupScrollbar(win);
    return win;
  };

  React.useImperativeHandle(ref, () => ({
    createHTMLWindow: async (htmlContent: string, options?: any) => {
      await createHTMLWindow(htmlContent, options);
      // Show interaction hint for first window
      if (windowsRef.current.length === 1 && hintRef.current) {
        hintRef.current.classList.add('visible');
        setTimeout(() => {
          if (hintRef.current) {
            hintRef.current.classList.remove('visible');
          }
        }, 3000);
      }
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

  // Interaction handling
  const handleInteraction = (intersection: THREE.Intersection, isPress: boolean) => {
    const { object, uv } = intersection;
    const { windowId, type } = object.userData as { windowId: string; type: string };
    const windowObj = windowsRef.current.find(w => w.id === windowId);
    if (!windowObj) return;
    if (type === 'titlebar') {
      if (!isPress) {
        const wasClosed = windowObj.handleTitleBarClick(uv!);
        if (!wasClosed && windowObj.isDraggable) {
          startDrag(windowObj as InstanceType<typeof ARWindow>);
        }
      }
    } else if (type === 'content' && !isPress) {
      windowObj.handleClick(uv!);
    }
  };

  const startDrag = (windowObj: InstanceType<typeof ARWindow>, isMouseDrag = false, mousePos?: THREE.Vector2) => {
    const dragState = dragStateRef.current;
    dragState.isDragging = true;
    dragState.draggedWindow = windowObj;
    
    // Add visual feedback - slightly scale up the window being dragged
    windowObj.group.scale.setScalar(1.05);
    
    if (isMouseDrag && mousePos) {
      // Mouse/touch dragging for non-AR mode
      dragState.isDraggingWithMouse = true;
      dragState.initialMousePos.copy(mousePos);
      dragState.currentMousePos.copy(mousePos);
      
      // Store initial window position
      dragState.targetPosition.copy(windowObj.group.position);
      dragState.lastFrameTime = performance.now();
      return;
    }
    
    // XR controller dragging
    if (!rendererRef.current || !rendererRef.current.xr.isPresenting) return;
    dragState.isDraggingWithMouse = false;
    
    const controller = rendererRef.current.xr.getController(0);
    const xrCamera = rendererRef.current.xr.getCamera();
    const objectWorldPosition = new THREE.Vector3();
    windowObj.group.getWorldPosition(objectWorldPosition);
    const camDir = xrCamera.getWorldDirection(new THREE.Vector3());
    const vecToCam = new THREE.Vector3().subVectors(objectWorldPosition, xrCamera.position);
    dragState.dragDepth = vecToCam.dot(camDir);
    dragState.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), objectWorldPosition);
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(controller.matrixWorld));
    raycaster.set(origin, direction);
    const initialHit = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragState.dragPlane, initialHit);
    dragState.dragOffset.subVectors(objectWorldPosition, initialHit);
  };

  const updateDrag = () => {
    const dragState = dragStateRef.current;
    if (!dragState.isDragging || !dragState.draggedWindow || !rendererRef.current) return;

    if (dragState.isDraggingWithMouse) {
      // Mouse/touch dragging - smooth interpolation to target position with frame rate independence
      const currentTime = performance.now();
      const deltaTime = currentTime - dragState.lastFrameTime;
      dragState.lastFrameTime = currentTime;
      
      // Adaptive smoothing based on frame rate (target 60fps)
      const frameRateAdjustment = Math.min(deltaTime / 16.67, 2.0); // Clamp to prevent jumps
      const adjustedSmoothing = Math.min(dragState.smoothingFactor * frameRateAdjustment, 0.8);
      
      const currentPos = dragState.draggedWindow.group.position;
      currentPos.lerp(dragState.targetPosition, adjustedSmoothing);
      return;
    }

    // XR controller dragging
    const controller = rendererRef.current.xr.getController(0);
    const xrCamera = rendererRef.current.xr.getCamera();
    
    // Check if pointer still over title-bar region; otherwise cancel drag
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
      new THREE.Matrix4().extractRotation(controller.matrixWorld)
    );
    const raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);
    
    // Raycast against the window to see if we've "let go"
    const intersects = raycaster.intersectObject(dragState.draggedWindow.contentMesh!, false);
    if (intersects.length === 0) {
      endDrag();
      return;
    }

    // Continue updating drag plane
    const targetPlaneAnchorPoint = xrCamera.position.clone().add(
      xrCamera.getWorldDirection(new THREE.Vector3()).multiplyScalar(dragState.dragDepth)
    );
    dragState.dragPlane.setFromNormalAndCoplanarPoint(
      xrCamera.getWorldDirection(new THREE.Vector3()).negate(),
      targetPlaneAnchorPoint
    );
    const origin2 = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction2 = new THREE.Vector3(0, 0, -1).applyMatrix4(
      new THREE.Matrix4().extractRotation(controller.matrixWorld)
    );
    const raycaster2 = new THREE.Raycaster();
    raycaster2.set(origin2, direction2);
    const currentHitOnPlane = new THREE.Vector3();
    if (raycaster2.ray.intersectPlane(dragState.dragPlane, currentHitOnPlane)) {
      dragState.draggedWindow.group.position.copy(
        currentHitOnPlane.add(dragState.dragOffset)
      );
    }
  };

  const endDrag = () => {
    const dragState = dragStateRef.current;
    
    // Remove visual feedback - restore normal scale
    if (dragState.draggedWindow) {
      dragState.draggedWindow.group.scale.setScalar(1.0);
    }
    
    dragState.isDragging = false;
    dragState.isDraggingWithMouse = false;
    dragState.draggedWindow = null;
  };

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
    cameraRef.current = camera;
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);
    // CSS3D renderer for interactive HTML
    const cssRenderer = new CSS3DRenderer();
    // Make CSS3DRenderer full-screen and update on resize
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.width = '100%';
    cssRenderer.domElement.style.height = '100%';
    cssRenderer.domElement.style.pointerEvents = 'auto';
    cssRenderer.domElement.style.overflow = 'visible'; // allow overflow of menus
    cssRenderer.domElement.style.zIndex = '1';
    // Attach CSS3DRenderer on top of WebGL canvas
    currentMount.appendChild(cssRenderer.domElement);
    cssRendererRef.current = cssRenderer;
    // Update renderer and camera on window resize
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      cssRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['local', 'anchors', 'dom-overlay', 'hit-test'],
      optionalFeatures: ['local-floor'],
      domOverlay: { root: document.body }
    });
    arButton.id = "ar-button";
    document.body.appendChild(arButton);

    // Controller setup for interaction
    const controller = renderer.xr.getController(0);
    scene.add(controller);

    const raycaster = new THREE.Raycaster();
    let pressStartTime = 0;
    const LONG_PRESS_DURATION = 200;

    const onSelectStart = () => {
      pressStartTime = Date.now();
      if (!renderer.xr.isPresenting) return;
      // Raycast against all window planes
      const controllerMatrix = controller.matrixWorld;
      const origin = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
      const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
        new THREE.Matrix4().extractRotation(controllerMatrix)
      );
      raycaster.set(origin, direction);
      const allPlanes = windowsRef.current.map(w => w.contentMesh!).filter(Boolean) as THREE.Mesh[];
      const hits = raycaster.intersectObjects(allPlanes, false);
      if (!hits.length) return;
      const hit = hits[0];
      const windowId = hit.object.userData.windowId as string;
      const uv = hit.uv;
      if (!uv) return;
      const windowObj = windowsRef.current.find(w => w.id === windowId);
      if (!windowObj) return;
      // Start drag on any window hit
      startDrag(windowObj);
    };

    const onSelectEnd = () => {
      if (dragStateRef.current.isDragging) {
        endDrag();
        return;
      }
      const pressDuration = Date.now() - pressStartTime;
      if (pressDuration < LONG_PRESS_DURATION && renderer.xr.isPresenting) {
        // Raycast to detect short tap for close
        const controllerMatrix = controller.matrixWorld;
        const origin = new THREE.Vector3().setFromMatrixPosition(controllerMatrix);
        const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(
          new THREE.Matrix4().extractRotation(controllerMatrix)
        );
        raycaster.set(origin, direction);
        const allPlanes = windowsRef.current.map(w => w.contentMesh!).filter(Boolean) as THREE.Mesh[];
        const hits = raycaster.intersectObjects(allPlanes, false);
        if (!hits.length) return;
        const hit = hits[0];
        const uv = hit.uv;
        const object = hit.object;
        if (!uv) return;
        const windowId = object.userData.windowId as string;
        const windowObj = windowsRef.current.find(w => w.id === windowId);
        if (!windowObj) return;
        const totalUnits = CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS;
        const titleUVThreshold = CONFIG.TITLE_BAR_HEIGHT_UNITS / totalUnits;
        // If tap in close region within title bar
        if (uv.y >= 1 - titleUVThreshold) {
          const startPx = CONFIG.CONTENT_WIDTH - CONFIG.CLOSE_BUTTON_SIZE - 16;
          const endPx = CONFIG.CONTENT_WIDTH - 16;
          const uvX = uv.x;
          const startUV = startPx / CONFIG.CONTENT_WIDTH;
          const endUV = endPx / CONFIG.CONTENT_WIDTH;
          if (uvX >= startUV && uvX <= endUV) {
            windowObj.destroy();
            windowsRef.current = windowsRef.current.filter(w => w !== windowObj);
          }
        }
      }
    };

    controller.addEventListener('selectstart', onSelectStart);
    controller.addEventListener('selectend', onSelectEnd);

    // Mouse and touch interactions for non-AR mode
    const mouse = new THREE.Vector2();
    const raycasterMouse = new THREE.Raycaster();
    let isMouseDown = false;
    let mouseDownTimer: NodeJS.Timeout | null = null;
    let mouseDownPosition = new THREE.Vector2();
    let potentialDragWindow: InstanceType<typeof ARWindow> | null = null;
    const DRAG_THRESHOLD = 0.01; // Movement threshold to start dragging

    const updateMousePosition = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getIntersectedWindow = () => {
      raycasterMouse.setFromCamera(mouse, camera);
      const allPlanes = windowsRef.current.map(w => w.contentMesh!).filter(Boolean) as THREE.Mesh[];
      const hits = raycasterMouse.intersectObjects(allPlanes, false);
      if (hits.length === 0) return null;
      
      const hit = hits[0];
      const windowId = hit.object.userData.windowId as string;
      const windowObj = windowsRef.current.find(w => w.id === windowId);
      return { windowObj, hit };
    };

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      if (renderer.xr.isPresenting) return; // Don't handle mouse in AR mode
      
      updateMousePosition(event.clientX, event.clientY);
      mouseDownPosition.copy(mouse);
      const result = getIntersectedWindow();
      if (!result) return;
      
      const { windowObj, hit } = result;
      const uv = hit.uv;
      if (!uv || !windowObj) return;

      isMouseDown = true;
      potentialDragWindow = null;
      
      // Check if clicking in title bar area for dragging
      const totalUnits = CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS;
      const titleUVThreshold = CONFIG.TITLE_BAR_HEIGHT_UNITS / totalUnits;
      
      if (uv.y >= 1 - titleUVThreshold) {
        // Clicking in title bar area - check for close button
        const startPx = CONFIG.CONTENT_WIDTH - CONFIG.CLOSE_BUTTON_SIZE - 16;
        const endPx = CONFIG.CONTENT_WIDTH - 16;
        const uvX = uv.x;
        const startUV = startPx / CONFIG.CONTENT_WIDTH;
        const endUV = endPx / CONFIG.CONTENT_WIDTH;
        
        if (uvX >= startUV && uvX <= endUV) {
          // Close button clicked - immediate action, no dragging
          windowObj.destroy();
          windowsRef.current = windowsRef.current.filter(w => w !== windowObj);
          return;
        }
        
        // Store potential drag window - will start dragging on mouse move
        potentialDragWindow = windowObj;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (renderer.xr.isPresenting) return;
      
      updateMousePosition(event.clientX, event.clientY);
      const dragState = dragStateRef.current;
      
      // Check if we should start dragging based on movement threshold
      if (isMouseDown && potentialDragWindow && !dragState.isDragging) {
        const movementDistance = mouse.distanceTo(mouseDownPosition);
        if (movementDistance > DRAG_THRESHOLD) {
          // Clear any existing timer and start dragging immediately
          if (mouseDownTimer) {
            clearTimeout(mouseDownTimer);
            mouseDownTimer = null;
          }
          startDrag(potentialDragWindow, true, mouseDownPosition.clone());
          potentialDragWindow = null;
        }
      }
      
      if (dragState.isDragging && dragState.isDraggingWithMouse && dragState.draggedWindow) {
        // Update current mouse position
        const prevMousePos = dragState.currentMousePos.clone();
        dragState.currentMousePos.copy(mouse);
        
        // Calculate movement delta
        const deltaX = mouse.x - dragState.initialMousePos.x;
        const deltaY = mouse.y - dragState.initialMousePos.y;
        
        // Calculate movement speed for adaptive sensitivity
        const movementSpeed = prevMousePos.distanceTo(mouse);
        const baseSensitivity = 3.5;
        const maxSensitivity = 8.0;
        const sensitivity = Math.min(baseSensitivity + movementSpeed * 20, maxSensitivity);
        
        // Update target position based on camera orientation
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        
        // Create movement vectors perpendicular to camera direction
        const right = new THREE.Vector3();
        right.crossVectors(camera.up, cameraDirection).normalize();
        const up = new THREE.Vector3();
        up.crossVectors(cameraDirection, right).normalize();
        
        // Calculate new target position
        const startPos = dragState.draggedWindow.group.position.clone();
        dragState.targetPosition.copy(startPos);
        dragState.targetPosition.add(right.multiplyScalar(deltaX * sensitivity));
        dragState.targetPosition.add(up.multiplyScalar(deltaY * sensitivity));
        
        // Update initial position for next frame
        dragState.initialMousePos.copy(mouse);
      } else {
        // Change cursor on hover over windows
        const result = getIntersectedWindow();
        if (result) {
          const { hit } = result;
          const uv = hit.uv;
          if (uv) {
            const totalUnits = CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS;
            const titleUVThreshold = CONFIG.TITLE_BAR_HEIGHT_UNITS / totalUnits;
            
            if (uv.y >= 1 - titleUVThreshold) {
              // In title bar area
              const startPx = CONFIG.CONTENT_WIDTH - CONFIG.CLOSE_BUTTON_SIZE - 16;
              const endPx = CONFIG.CONTENT_WIDTH - 16;
              const uvX = uv.x;
              const startUV = startPx / CONFIG.CONTENT_WIDTH;
              const endUV = endPx / CONFIG.CONTENT_WIDTH;
              
              if (uvX >= startUV && uvX <= endUV) {
                renderer.domElement.style.cursor = 'pointer'; // Close button
              } else {
                renderer.domElement.style.cursor = 'move'; // Draggable area
              }
            } else {
              renderer.domElement.style.cursor = 'default'; // Content area
            }
          }
        } else {
          renderer.domElement.style.cursor = 'default';
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (renderer.xr.isPresenting) return;
      
      isMouseDown = false;
      potentialDragWindow = null; // Clear potential drag window
      
      if (mouseDownTimer) {
        clearTimeout(mouseDownTimer);
        mouseDownTimer = null;
      }
      
      if (dragStateRef.current.isDragging) {
        endDrag();
      }
    };

    // Touch event handlers for mobile
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseDown(mouseEvent);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      event.preventDefault(); // Prevent scrolling
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseMove(mouseEvent);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const mouseEvent = new MouseEvent('mouseup', {});
      handleMouseUp(mouseEvent);
    };

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mouseleave', handleMouseUp); // End drag when leaving canvas
    
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd);
    renderer.domElement.addEventListener('touchcancel', handleTouchEnd);

    // Keyboard shortcuts for window management
    const handleKeyDown = (event: KeyboardEvent) => {
      if (renderer.xr.isPresenting) return;
      
      // ESC to close focused/hovered window
      if (event.key === 'Escape' && windowsRef.current.length > 0) {
        const lastWindow = windowsRef.current[windowsRef.current.length - 1];
        lastWindow.destroy();
        windowsRef.current = windowsRef.current.filter(w => w !== lastWindow);
      }
      
      // Ctrl/Cmd + W to close all windows
      if ((event.ctrlKey || event.metaKey) && event.key === 'w') {
        event.preventDefault();
        windowsRef.current.forEach(w => w.destroy());
        windowsRef.current = [];
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    renderer.setAnimationLoop(() => {
      updateDrag();
      if (renderer.xr.isPresenting) {
        const xrCamera = renderer.xr.getCamera();
        windowsRef.current.forEach(w => w.group.lookAt(xrCamera.position));
      } else {
        // In non-AR mode, don't make windows look at camera during drag for better UX
        windowsRef.current.forEach(w => {
          if (!dragStateRef.current.isDragging || dragStateRef.current.draggedWindow !== w) {
            w.group.lookAt(camera.position);
          }
        });
      }
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    });

    return () => {
      // Clean up event listeners
      if (mouseDownTimer) clearTimeout(mouseDownTimer);
      isMouseDown = false;
      potentialDragWindow = null;
      document.removeEventListener('keydown', handleKeyDown);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('mouseleave', handleMouseUp);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      renderer.domElement.removeEventListener('touchcancel', handleTouchEnd);
      
      // Clean up CSS3D renderer
      if (cssRendererRef.current && mountRef.current?.contains(cssRendererRef.current.domElement)) {
        mountRef.current.removeChild(cssRendererRef.current.domElement);
      }
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
    <div className="ar-scene-wrapper" style={{ position: 'relative', overflow: 'visible' }}>
      {/* Video background streams only during AR session */}
      <video ref={videoRef} className="ar-video-bg" autoPlay muted playsInline />
      <div ref={mountRef} className="ar-scene-container" />
      <div ref={overlayRef} style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'auto', overflow:'visible', zIndex: 10 }} />
      
      {/* Interaction hint for non-AR mode */}
      <div 
        ref={hintRef} 
        className="ar-interaction-hint"
        style={{ 
          position: 'absolute', 
          bottom: '80px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 50 
        }}
      >
        Drag title bar to move • Click × to close • ESC to close last window
      </div>
    </div>
    );
});

export default ARScene;