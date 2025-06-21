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
  RESIZE_HANDLE_SIZE: 32,       // px
  MIN_WORLD_WIDTH: 0.5,         // three.js world units
  MIN_WORLD_HEIGHT: 0.25,       // world units
  SCROLL_WHEEL_WIDTH: 0.15,     // width of scroll wheel in world units
  SCROLL_WHEEL_HEIGHT: 0.8,     // height of scroll wheel relative to window height
  MIN_DEPTH: 0.5,               // minimum distance from camera
  MAX_DEPTH: 10,                // maximum distance from camera
  SCROLL_SPEED: 0.02,           // depth change per scroll unit
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

  resizeMesh: THREE.Mesh | null = null;
  isResizing = false;
  resizeStart: {
    scale: THREE.Vector3;
    pointerPlane: THREE.Plane;
    offset: THREE.Vector3;
  } | null = null;

  // Scroll wheel properties
  scrollWheelMesh: THREE.Mesh | null = null;
  scrollIndicatorMesh: THREE.Mesh | null = null;
  isScrolling = false;
  scrollStart: {
    initialZ: number;
    initialPointerY: number;
    camera: THREE.Camera;
  } | null = null;
    // --- ADD THESE TWO LINES ---
    scrollWheelHeight: number = 0;
    scrollIndicatorHeight: number = 0;

  /** call from init() */
  /** call from init() */
  private createResizeHandle() {
    const size = (CONFIG.RESIZE_HANDLE_SIZE / CONFIG.CONTENT_WIDTH) * CONFIG.PLANE_WIDTH;
    const geo  = new THREE.PlaneGeometry(size, size);
    // Make the handle more visible for easier interaction
    const mat  = new THREE.MeshBasicMaterial({ color: 0x00FFEA, transparent: true, opacity: 0.75 });
    this.resizeMesh = new THREE.Mesh(geo, mat);
    this.resizeMesh.userData = { windowId: this.id, type: 'resize' };
    
    // Position the handle at the bottom-right corner of the window
    this.resizeMesh.position.set(
      CONFIG.PLANE_WIDTH / 2,
      -CONFIG.PLANE_HEIGHT / 2 - CONFIG.TITLE_BAR_HEIGHT_UNITS,
      -0.01 // CORRECTED: Use a negative Z to place it in FRONT of the window
    );
    this.group.add(this.resizeMesh);
  }
  /** Create scroll wheel on the right edge */
  private createScrollWheel() {
    // Create scroll track
    const trackHeight = (CONFIG.PLANE_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_UNITS) * CONFIG.SCROLL_WHEEL_HEIGHT;
    this.scrollWheelHeight = trackHeight;
    const trackGeo = new THREE.PlaneGeometry(CONFIG.SCROLL_WHEEL_WIDTH, trackHeight);
    const trackMat = new THREE.MeshBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    this.scrollWheelMesh = new THREE.Mesh(trackGeo, trackMat);
    this.scrollWheelMesh.userData = { windowId: this.id, type: 'scroll' };

    // --- FIX STARTS HERE ---
    // CORRECTED: Explicitly position the scroll wheel to the right of the window and in front.
    const yOffset = -CONFIG.TITLE_BAR_HEIGHT_UNITS / 2; // Vertically center it
    this.scrollWheelMesh.position.set(
        (CONFIG.PLANE_WIDTH / 2) + (CONFIG.SCROLL_WHEEL_WIDTH / 2) + 0.02, // X: Right of plane + gap
        yOffset,                                                          // Y: Vertically centered
        -0.01                                                             // Z: In front of the window
    );
    // ... (positioning code)
    
    // Create scroll indicator (thumb)
    const indicatorHeight = trackHeight * 0.2;
    this.scrollIndicatorHeight = indicatorHeight; // <-- STORE THE VALUE
    const indicatorGeo = new THREE.PlaneGeometry(CONFIG.SCROLL_WHEEL_WIDTH * 0.8, indicatorHeight);
    const indicatorMat = new THREE.MeshBasicMaterial({ 
      color: 0x00FFEA,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    this.scrollIndicatorMesh = new THREE.Mesh(indicatorGeo, indicatorMat);
    this.scrollIndicatorMesh.position.set(0, 0, 0.01);
    
    this.scrollWheelMesh.add(this.scrollIndicatorMesh);
    this.group.add(this.scrollWheelMesh);
  }

  /** Start scrolling when scroll wheel is grabbed */
  startScroll(controller: THREE.Object3D, xrCamera: THREE.Camera) {
    if (!this.scrollWheelMesh) return;
    this.isScrolling = true;
    
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    
    this.scrollStart = {
      initialZ: this.group.position.z,
      initialPointerY: origin.y,
      camera: xrCamera
    };
  }

  /** Update scroll position based on controller movement */
  updateScroll(controller: THREE.Object3D) {
  if (!this.isScrolling || !this.scrollStart || !this.scrollIndicatorMesh || !this.scrollWheelMesh) return;

    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const deltaY = origin.y - this.scrollStart.initialPointerY;

    // A more direct mapping for depth change:
    // Let's use a clear scroll speed.
    const depthChange = -deltaY * CONFIG.SCROLL_SPEED; // Negate so moving hand up "pulls" window closer

    const cameraPos = new THREE.Vector3();
    this.scrollStart.camera.getWorldPosition(cameraPos);

    // Get the vector pointing from the camera to the window
    const direction = new THREE.Vector3().subVectors(this.group.position, cameraPos).normalize();

    // Calculate the new position by moving along that vector
    const currentDistance = this.group.position.distanceTo(cameraPos);
    let newDistance = currentDistance + depthChange;

    // Clamp the distance to min/max depths
    newDistance = THREE.MathUtils.clamp(newDistance, CONFIG.MIN_DEPTH, CONFIG.MAX_DEPTH);

    const newPosition = cameraPos.clone().add(direction.multiplyScalar(newDistance));
    this.group.position.copy(newPosition);

    // *** Reset the start point for the next frame to prevent acceleration ***
    this.scrollStart.initialPointerY = origin.y;

    
    // Update the visual indicator
    const normalizedDepth = (newDistance - CONFIG.MIN_DEPTH) / (CONFIG.MAX_DEPTH - CONFIG.MIN_DEPTH);

    const indicatorRange = this.scrollWheelHeight - this.scrollIndicatorHeight; // Full range of movement

    this.scrollIndicatorMesh.position.y = (normalizedDepth - 0.5) * indicatorRange;

  }

  endScroll() {
      this.isScrolling = false;
      // No need to nullify scrollStart immediately if you want to reuse it, but for clean state, it's good.
      this.scrollStart = null;
  }

  /** when you tap the handle */
  startResize(controller: THREE.Object3D, xrCamera: THREE.Camera) {
    if (!this.resizeMesh) return;
    this.isResizing = true;
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);

    // record starting scale
    const baseScale = this.group.scale.clone();
    // plane to project pointer onto
    const plane = new THREE.Plane();
    const normal = xrCamera.getWorldDirection(new THREE.Vector3()).negate();
    plane.setFromNormalAndCoplanarPoint(normal, worldPos);

    // find initial hit
    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dir    = new THREE.Vector3(0,0,-1)
                      .applyMatrix4(controller.matrixWorld)
                      .normalize();
    ray.set(origin, dir);

    const hitPoint = new THREE.Vector3();
    ray.ray.intersectPlane(plane, hitPoint);

    this.resizeStart = {
      scale: baseScale,
      pointerPlane: plane,
      offset: new THREE.Vector3().subVectors(worldPos, hitPoint)
    };
  }

  /** call every frame if isResizing */
  updateResize(controller: THREE.Object3D) {
    if (!this.isResizing || !this.resizeStart) return;
    const { scale: baseScale, pointerPlane, offset } = this.resizeStart;

    const ray = new THREE.Raycaster();
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dir = new THREE.Vector3(0,0,-1)
                   .applyMatrix4(controller.matrixWorld)
                   .normalize();
    ray.set(origin, dir);

    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(pointerPlane, hit)) return;

    // compute new local coords
    const worldPos = hit.clone().add(offset);
    const local   = this.group.worldToLocal(worldPos.clone());

    // derive width/height
    const newW = THREE.MathUtils.clamp(
      (local.x + CONFIG.PLANE_WIDTH/2) * baseScale.x,
      CONFIG.MIN_WORLD_WIDTH,
      Infinity
    );
    const newH = THREE.MathUtils.clamp(
      (CONFIG.PLANE_HEIGHT/2 - local.y) * baseScale.y,
      CONFIG.MIN_WORLD_HEIGHT,
      Infinity
    );

    // apply uniform scale
    this.group.scale.set(newW/CONFIG.PLANE_WIDTH, newH/CONFIG.PLANE_HEIGHT, 1);

    // update CSS3D pixel dims:
    if (this.cssObject && this.htmlElement) {
      const pixelW = newW  / (CONFIG.PLANE_WIDTH/CONFIG.CONTENT_WIDTH);
      const pixelH = newH  / ((CONFIG.PLANE_HEIGHT+CONFIG.TITLE_BAR_HEIGHT_UNITS)/(CONFIG.CONTENT_HEIGHT+CONFIG.TITLE_BAR_HEIGHT_PX));
      this.htmlElement.style.width  = `${pixelW}px`;
      this.htmlElement.style.height = `${pixelH + CONFIG.TITLE_BAR_HEIGHT_PX}px`;
    }
  }

  endResize() {
    this.isResizing = false;
    this.resizeStart = null;
  }

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
    this.createResizeHandle();
    this.createScrollWheel();
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
    titleDiv.style.padding = '0 20px';
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
    closeBtn.style.top = '50%';
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
    contentDiv.style.whiteSpace = 'pre';
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
    cssObj.position.z += 0.002;

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
    container.style.height = `${CONFIG.CONTENT_HEIGHT + CONFIG.TITLE_BAR_HEIGHT_PX}px`;
    container.style.overflow = 'visible'; // allow content overflow
    container.style.background = 'white';
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
    titleDiv.style.padding = '0 20px';
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
    if (this.scrollWheelMesh) {
      this.scrollWheelMesh.geometry.dispose();
      (this.scrollWheelMesh.material as THREE.Material).dispose();
    }
    if (this.scrollIndicatorMesh) {
      this.scrollIndicatorMesh.geometry.dispose();
      (this.scrollIndicatorMesh.material as THREE.Material).dispose();
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
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcam = useWebcam();
  const overlayRef = useRef<HTMLDivElement>(null);

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
    return win;
  };

  const createIframeWindow = async (url: string, options = {}) => {
    if (!sceneRef.current) return;
    const win = createWindow(sceneRef.current, options);
    await win.setIframeContent(url);
    return win;
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

  const startDrag = (windowObj: InstanceType<typeof ARWindow>) => {
    if (!rendererRef.current || !rendererRef.current.xr.isPresenting) return;
    const dragState = dragStateRef.current;
    dragState.isDragging = true;
    dragState.draggedWindow = windowObj;
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
    dragState.isDragging = false;
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
    cssRenderer.domElement.style.pointerEvents = 'none';
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
      // Check for scroll wheel interaction first
      const allScrollWheels = windowsRef.current
        .map(w => w.scrollWheelMesh)
        .filter((m): m is THREE.Mesh => !!m);
      const scrollHits = raycaster.intersectObjects(allScrollWheels, false);
      if (scrollHits.length) {
        const win = windowsRef.current.find(w => w.id === scrollHits[0].object.userData.windowId)!;
        win.startScroll(controller, renderer.xr.getCamera());
        return;
      }

      // Check for resize handle interaction
      const allHandles = windowsRef.current
        .map(w => w.resizeMesh)
        .filter((m): m is THREE.Mesh => !!m);
      const resizeHits = raycaster.intersectObjects(allHandles, false);
      if (resizeHits.length) {
        const win = windowsRef.current.find(w => w.id === resizeHits[0].object.userData.windowId)!;
        win.startResize(controller, renderer.xr.getCamera());
        return;
      }
      
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
      // Check for scrolling windows
      const scrollingWin = windowsRef.current.find(w => w.isScrolling);
      if (scrollingWin) {
        scrollingWin.endScroll();
        return;
      }

      // Check for resizing windows
      const resizingWin = windowsRef.current.find(w => w.isResizing);
      if (resizingWin) {
        resizingWin.endResize();
        return;
      }
      
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

    renderer.setAnimationLoop(() => {
      // first handle any scrolling
      windowsRef.current.forEach(w => {
        if (w.isScrolling) {
          w.updateScroll(renderer.xr.getController(0));
        }
      });
      
      // then handle any resize
      windowsRef.current.forEach(w => {
        if (w.isResizing) {
          w.updateResize(renderer.xr.getController(0));
        }
      });
      
      updateDrag();
      if (renderer.xr.isPresenting) {
        const cam = renderer.xr.getCamera();
        windowsRef.current.forEach(w => w.group.lookAt(cam.position));
      }
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    });

    return () => {
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
    </div>
    );
});

export default ARScene;
