import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const LatticePanel = ({ width, height, styleModel, materialColor, patternScale = 1 }) => {
    const groupRef = useRef();

    // Load the selected style model
    const { scene } = useGLTF(styleModel);

    // Target dimensions in scene units.
    const targetWidth = width / 10;
    const targetHeight = height / 10;

    // Clip to the requested panel rectangle after cover scaling.
    const clippingPlanes = useMemo(() => {
        const halfW = targetWidth / 2;
        const halfH = targetHeight / 2;

        return [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW),
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), halfH),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), halfH)
        ];
    }, [targetWidth, targetHeight]);

    // Calculate bounding box and create tiled grid
    const tiledGroup = useMemo(() => {
        const group = new THREE.Group();

        // Clone the original scene
        const originalClone = scene.clone(true);

        // Rotate the model to face the camera (XY plane) - adjust based on model orientation
        // Most 3D models are designed laying flat on XZ, so rotate -90 degrees on X
        originalClone.rotation.x = -Math.PI / 2;

        // Update the world matrix after rotation
        originalClone.updateMatrixWorld(true);

        // Calculate the bounding box AFTER rotation
        const bbox = new THREE.Box3().setFromObject(originalClone);
        const modelSize = new THREE.Vector3();
        bbox.getSize(modelSize);

        // Get the center offset
        const modelCenter = new THREE.Vector3();
        bbox.getCenter(modelCenter);

        // Unit dimensions (after rotation, X is width, Y is height)
        const unitWidth = modelSize.x || 1;
        const unitHeight = modelSize.y || 1;

        // Calculate tiles needed with scale adjustment
        // Larger patternScale -> Larger tiles -> Fewer tiles needed
        const tilesX = Math.max(1, Math.ceil(targetWidth / (unitWidth * patternScale)));
        const tilesY = Math.max(1, Math.ceil(targetHeight / (unitHeight * patternScale)));

        // Use cover fit with a single scalar so XY proportions are always preserved.
        const actualWidth = tilesX * unitWidth; // Note: actualWidth of the GRID (unscaled)
        const actualHeight = tilesY * unitHeight;

        // We want the grid (which is tilesX * unitWidth) to be scaled up/down to cover targetWidth.
        // But we ALSO want to respect the user's requested scale relative to the target.
        // Wait, the previous logic: scaleX = targetWidth / actualWidth.
        // If we decrease tilesX (due to higher patternScale), actualWidth decreases.
        // Then scaleX increases. So the whole group gets scaled up.
        // This naturally achieves the "bigger pattern" effect.

        const scaleX = targetWidth / actualWidth;
        const scaleY = targetHeight / actualHeight;
        // In the original code, uniformScale was Math.max(scaleX, scaleY) to cover completely.
        // If we reduced tilesX based on patternScale, scaleX will be roughly `patternScale`.
        const uniformScale = Math.max(scaleX, scaleY);

        // Create the tiled grid
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const tileClone = scene.clone(true);

                // Apply rotation to each tile
                tileClone.rotation.x = -Math.PI / 2;

                // Position each tile in a grid
                const posX = (x - (tilesX - 1) / 2) * unitWidth;
                const posY = (y - (tilesY - 1) / 2) * unitHeight;

                tileClone.position.set(posX, posY, 0);

                group.add(tileClone);
            }
        }

        // Center the group
        group.position.set(0, 0, 0);

        // Apply a uniform scale to avoid stretching.
        group.scale.set(uniformScale, uniformScale, 1);

        return group;
    }, [scene, targetWidth, targetHeight, patternScale]);

    // Apply material color to all meshes using PBR material
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.traverse((child) => {
                if (child.isMesh) {
                    // Use MeshStandardMaterial for realistic PBR rendering
                    child.material = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(materialColor),
                        metalness: 0,
                        roughness: 0.8,
                        side: THREE.DoubleSide,
                        envMapIntensity: 1.0,
                        clippingPlanes,
                        clipShadows: true
                    });
                }
            });
        }
    }, [materialColor, tiledGroup, clippingPlanes]);

    return (
        <group ref={groupRef}>
            <primitive object={tiledGroup} />
        </group>
    );
};


export default LatticePanel;
