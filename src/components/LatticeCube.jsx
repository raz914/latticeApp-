import React, { useState, useRef, useMemo } from 'react';
import * as THREE from 'three';

const LatticeCube = ({ width, height, materialColor }) => {
    // Normalize scale for visualization
    const scaleX = width / 100;
    const scaleY = height / 100;
    const scaleZ = 1; // Depth of the cube

    const groupRef = useRef();
    const [hovered, setHover] = useState(false);

    // Number of lattice divisions
    const divisionsX = 8;
    const divisionsY = 10;
    const divisionsZ = 8;

    // Create lattice geometry
    const latticeGeometry = useMemo(() => {
        const points = [];

        const halfX = scaleX / 2;
        const halfY = scaleY / 2;
        const halfZ = scaleZ / 2;

        const stepX = scaleX / divisionsX;
        const stepY = scaleY / divisionsY;
        const stepZ = scaleZ / divisionsZ;

        // Front face lattice (z = halfZ)
        for (let i = 0; i <= divisionsX; i++) {
            const x = -halfX + i * stepX;
            points.push(new THREE.Vector3(x, -halfY, halfZ));
            points.push(new THREE.Vector3(x, halfY, halfZ));
        }
        for (let j = 0; j <= divisionsY; j++) {
            const y = -halfY + j * stepY;
            points.push(new THREE.Vector3(-halfX, y, halfZ));
            points.push(new THREE.Vector3(halfX, y, halfZ));
        }

        // Back face lattice (z = -halfZ)
        for (let i = 0; i <= divisionsX; i++) {
            const x = -halfX + i * stepX;
            points.push(new THREE.Vector3(x, -halfY, -halfZ));
            points.push(new THREE.Vector3(x, halfY, -halfZ));
        }
        for (let j = 0; j <= divisionsY; j++) {
            const y = -halfY + j * stepY;
            points.push(new THREE.Vector3(-halfX, y, -halfZ));
            points.push(new THREE.Vector3(halfX, y, -halfZ));
        }

        // Left face lattice (x = -halfX)
        for (let k = 0; k <= divisionsZ; k++) {
            const z = -halfZ + k * stepZ;
            points.push(new THREE.Vector3(-halfX, -halfY, z));
            points.push(new THREE.Vector3(-halfX, halfY, z));
        }
        for (let j = 0; j <= divisionsY; j++) {
            const y = -halfY + j * stepY;
            points.push(new THREE.Vector3(-halfX, y, -halfZ));
            points.push(new THREE.Vector3(-halfX, y, halfZ));
        }

        // Right face lattice (x = halfX)
        for (let k = 0; k <= divisionsZ; k++) {
            const z = -halfZ + k * stepZ;
            points.push(new THREE.Vector3(halfX, -halfY, z));
            points.push(new THREE.Vector3(halfX, halfY, z));
        }
        for (let j = 0; j <= divisionsY; j++) {
            const y = -halfY + j * stepY;
            points.push(new THREE.Vector3(halfX, y, -halfZ));
            points.push(new THREE.Vector3(halfX, y, halfZ));
        }

        // Top face lattice (y = halfY)
        for (let i = 0; i <= divisionsX; i++) {
            const x = -halfX + i * stepX;
            points.push(new THREE.Vector3(x, halfY, -halfZ));
            points.push(new THREE.Vector3(x, halfY, halfZ));
        }
        for (let k = 0; k <= divisionsZ; k++) {
            const z = -halfZ + k * stepZ;
            points.push(new THREE.Vector3(-halfX, halfY, z));
            points.push(new THREE.Vector3(halfX, halfY, z));
        }

        // Bottom face lattice (y = -halfY)
        for (let i = 0; i <= divisionsX; i++) {
            const x = -halfX + i * stepX;
            points.push(new THREE.Vector3(x, -halfY, -halfZ));
            points.push(new THREE.Vector3(x, -halfY, halfZ));
        }
        for (let k = 0; k <= divisionsZ; k++) {
            const z = -halfZ + k * stepZ;
            points.push(new THREE.Vector3(-halfX, -halfY, z));
            points.push(new THREE.Vector3(halfX, -halfY, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return geometry;
    }, [scaleX, scaleY, scaleZ, divisionsX, divisionsY, divisionsZ]);

    return (
        <group
            ref={groupRef}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
        >
            <lineSegments geometry={latticeGeometry}>
                <lineBasicMaterial
                    color={hovered ? '#60a5fa' : materialColor}
                    linewidth={2}
                />
            </lineSegments>
        </group>
    );
};

export default LatticeCube;
