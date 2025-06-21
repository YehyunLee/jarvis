import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import './ar-scene.scss';

const ARScene = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mountRef.current || !overlayRef.current) return;

    const currentMount = mountRef.current;
    const currentOverlay = overlayRef.current;

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
    currentMount.appendChild(renderer.domElement);

    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ['hit-test', 'dom-overlay'],
      optionalFeatures: ['local-floor'],
      domOverlay: { root: currentOverlay }
    });
    arButton.id = "ar-button";
    document.body.appendChild(arButton);

    const handleSessionStart = () => {
      if(overlayRef.current) {
        overlayRef.current.style.display = 'block';
      }
    };
    const handleSessionEnd = () => {
      if(overlayRef.current) {
        overlayRef.current.style.display = 'none';
      }
    };

    renderer.xr.addEventListener('sessionstart', handleSessionStart);
    renderer.xr.addEventListener('sessionend', handleSessionEnd);

    const animate = () => {
      renderer.setAnimationLoop(animate);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
        if (document.body.contains(arButton)) {
            document.body.removeChild(arButton);
        }
      renderer.dispose();
      if (currentMount && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div>
        <div ref={mountRef} className="ar-scene-container" />
        <div ref={overlayRef} id="ar-overlay">
            <div className="ar-ui">
                {/* UI elements will go here */}
            </div>
        </div>
    </div>
    );
};

export default ARScene;
