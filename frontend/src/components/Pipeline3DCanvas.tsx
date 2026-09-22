import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PipelineStageNode, PIPELINE_NODES } from './pipeline-3d-types';

export type { PipelineStageNode } from './pipeline-3d-types';

interface Pipeline3DCanvasProps {
  activeStageId: string;
  onSelectStage: (stageId: string) => void;
}

export const Pipeline3DCanvas: React.FC<Pipeline3DCanvasProps> = ({
  activeStageId,
  onSelectStage,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<PipelineStageNode | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const meshesRef = useRef<{ node: PipelineStageNode; mesh: THREE.Mesh; ring: THREE.Mesh }[]>([]);
  const targetCameraX = useRef<number>(0);

  // Sync camera position when active stage changes
  useEffect(() => {
    const matched = PIPELINE_NODES.find((n) => n.id === activeStageId);
    if (matched) {
      targetCameraX.current = matched.position[0];
    }
  }, [activeStageId]);

  const initThree = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = Math.max(340, containerRef.current.clientHeight || 340);

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070709);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 16);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and fallback
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // Graceful fallback to 2D mode in environments without WebGL
      setTimeout(() => setViewMode('2d'), 0);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x8b7ef8, 2, 40);
    pointLight.position.set(0, 5, 10);
    scene.add(pointLight);

    // 5. Build Pipeline Nodes & Visual Geometry
    const nodeMeshes: { node: PipelineStageNode; mesh: THREE.Mesh; ring: THREE.Mesh }[] = [];

    PIPELINE_NODES.forEach((node) => {
      // Core Octahedron or Sphere node
      const geometry = new THREE.SphereGeometry(0.55, 24, 24);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(node.color),
        roughness: 0.25,
        metalness: 0.8,
        emissive: new THREE.Color(node.color),
        emissiveIntensity: 0.2,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...node.position);
      scene.add(mesh);

      // Outer targeting ring
      const ringGeom = new THREE.RingGeometry(0.75, 0.85, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(node.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(...node.position);
      scene.add(ring);

      nodeMeshes.push({ node, mesh, ring });
    });

    meshesRef.current = nodeMeshes;

    // 6. Connecting Spline Tubes / Conduits
    const createConduit = (start: [number, number, number], end: [number, number, number], color: string) => {
      const midX = (start[0] + end[0]) / 2;
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(...start),
        new THREE.Vector3(midX, start[1], start[2]),
        new THREE.Vector3(midX, end[1], end[2]),
        new THREE.Vector3(...end)
      );

      const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.04, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.35,
      });
      const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
      scene.add(tubeMesh);
    };

    // Standard sequential conduits
    createConduit([-10, 0, 0], [-7.5, 0, 0], '#8B7EF8');
    createConduit([-7.5, 0, 0], [-5, 0, 0], '#8B7EF8');
    // Split into Dense & Sparse branches
    createConduit([-5, 0, 0], [-2.5, 1.2, 0], '#8B7EF8');
    createConduit([-5, 0, 0], [-2.5, -1.2, 0], '#F59E0B');
    // Merge into RRF
    createConduit([-2.5, 1.2, 0], [0, 0, 0], '#8B7EF8');
    createConduit([-2.5, -1.2, 0], [0, 0, 0], '#F59E0B');
    // Subsequent stages
    createConduit([0, 0, 0], [2.5, 0, 0], '#10B981');
    createConduit([2.5, 0, 0], [5, 0, 0], '#EF4444');
    createConduit([5, 0, 0], [7.5, 0, 0], '#8B7EF8');
    createConduit([7.5, 0, 0], [10, 0, 0], '#10B981');

    // 7. Particle Stream Conduits (100 glowing flow particles)
    const particleCount = 120;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 22;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }

    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x8b7ef8,
      size: 0.1,
      transparent: true,
      opacity: 0.7,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // 8. Animation Loop
    let time = 0;
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);

      time += 0.02;

      // Smooth camera lerping toward target X position
      camera.position.x += (targetCameraX.current - camera.position.x) * 0.05;

      // Pulse rings and spin node geometry slightly
      nodeMeshes.forEach(({ node, mesh, ring }) => {
        const isSelected = node.id === activeStageId;
        const scale = isSelected ? 1.25 + Math.sin(time * 3) * 0.06 : 1.0;
        mesh.scale.set(scale, scale, scale);

        ring.rotation.z += 0.015;
        (ring.material as THREE.MeshBasicMaterial).opacity = isSelected ? 0.9 : 0.25;
      });

      // Flow particles from left to right along pipeline
      const posAttr = particleGeom.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        array[i * 3] += 0.05;
        if (array[i * 3] > 11) {
          array[i * 3] = -11;
        }
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Listener
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.max(340, containerRef.current.clientHeight || 340);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      renderer.dispose();
    };
  }, [activeStageId]);

  useEffect(() => {
    if (viewMode === '3d') {
      const cleanup = initThree();
      return cleanup;
    }
  }, [initThree, viewMode]);

  // Click & Hover raycasting
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const meshes = meshesRef.current.map((m) => m.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const matched = meshesRef.current.find((m) => m.mesh === hitMesh);
      if (matched) {
        setHoveredNode(matched.node);
        containerRef.current.style.cursor = 'pointer';
        return;
      }
    }

    setHoveredNode(null);
    containerRef.current.style.cursor = 'default';
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const meshes = meshesRef.current.map((m) => m.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const matched = meshesRef.current.find((m) => m.mesh === hitMesh);
      if (matched) {
        onSelectStage(matched.node.id);
      }
    }
  };

  return (
    <div className="relative border border-border bg-[#070709] rounded-sm overflow-hidden shadow-card-elevated">
      {/* 3D / 2D Switch & Controls Header */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
          <span className="font-mono text-[10px] text-ink-muted uppercase tracking-wider bg-surface-2/80 px-2 py-0.5 rounded-sm border border-border backdrop-blur-sm">
            Interactive WebGL 3D Pipeline
          </span>
          {hoveredNode && (
            <span className="font-mono text-[11px] text-attack bg-surface-2/90 px-2 py-0.5 rounded-sm border border-attack-border backdrop-blur-sm animate-pulse">
              Target: {hoveredNode.name}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm border transition-colors cursor-pointer ${
              viewMode === '3d'
                ? 'bg-attack-surface text-attack-ink border-attack-border font-bold'
                : 'bg-surface-2/80 text-ink-faint border-border'
            }`}
          >
            3D Spatial
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-sm border transition-colors cursor-pointer ${
              viewMode === '2d'
                ? 'bg-attack-surface text-attack-ink border-attack-border font-bold'
                : 'bg-surface-2/80 text-ink-faint border-border'
            }`}
          >
            2D Flat
          </button>
        </div>
      </div>

      {/* 3D Canvas Mount Point */}
      {viewMode === '3d' ? (
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onClick={handleClick}
          className="w-full h-80 sm:h-96 relative focus:outline-none select-none"
        />
      ) : (
        /* Accessible 2D Fallback Map */
        <div className="p-6 grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-[#070709]">
          {PIPELINE_NODES.map((node) => {
            const isSelected = node.id === activeStageId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectStage(node.id)}
                className={`p-3 text-left border rounded-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'border-attack bg-surface-2 text-ink-primary shadow-glow-sm'
                    : 'border-border bg-surface-1 text-ink-muted hover:border-border-strong'
                }`}
              >
                <div className="font-mono text-[10px] text-ink-faint uppercase">
                  Step 0{node.stepNumber}
                </div>
                <div className="font-semibold text-xs text-ink-primary truncate mt-1">
                  {node.shortName}
                </div>
                <div className="text-[10px] font-mono text-ink-muted mt-1 truncate">
                  {node.tierA.slice(0, 32)}...
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Spatial Navigation Ribbon */}
      <div className="border-t border-border bg-[#0D0D11] px-4 py-2 flex items-center justify-between overflow-x-auto no-scrollbar text-xs font-mono">
        <div className="flex items-center space-x-2">
          <span className="text-ink-faint text-[10px] uppercase">Focus:</span>
          {PIPELINE_NODES.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectStage(node.id)}
              className={`px-2 py-0.5 rounded-sm whitespace-nowrap text-[11px] transition-colors cursor-pointer ${
                node.id === activeStageId
                  ? 'bg-surface-3 text-ink-primary font-bold border border-border-strong'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              {node.shortName}
            </button>
          ))}
        </div>
        <div className="text-ink-faint text-[10px] hidden lg:block">
          Click node to focus camera
        </div>
      </div>
    </div>
  );
};
