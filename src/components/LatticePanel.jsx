import React, { useMemo, useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const LatticePanel = ({ width, height, styleModel, materialColor }) => {
    const groupRef = useRef();

    // Load the selected style model
    const { scene } = useGLTF(styleModel);

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

        // Target dimensions in scene units
        const targetWidth = width / 10;
        const targetHeight = height / 10;

        // Calculate tiles needed
        const tilesX = Math.max(1, Math.ceil(targetWidth / unitWidth));
        const tilesY = Math.max(1, Math.ceil(targetHeight / unitHeight));

        // Calculate scale to fit exactly
        const actualWidth = tilesX * unitWidth;
        const actualHeight = tilesY * unitHeight;
        const scaleX = targetWidth / actualWidth;
        const scaleY = targetHeight / actualHeight;

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

        // Apply scale to fit target dimensions
        group.scale.set(scaleX, scaleY, 1);

        return group;
    }, [scene, width, height]);

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
                        envMapIntensity: 1.0
                    });
                }
            });
        }
    }, [materialColor, tiledGroup]);

    return (
        <group ref={groupRef}>
            <primitive object={tiledGroup} />
        </group>
    );
};


export default LatticePanel;

