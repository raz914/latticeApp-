import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MDF_TEXTURE_PATH = '/texture/mdf.jpg';
const FRAME_THICKNESS = 0.15;
const FRAME_DEPTH = 0.12;

function createArchShape(halfW, halfH) {
    const archRadius = halfW;
    const archCenterY = halfH - archRadius;
    const shape = new THREE.Shape();
    shape.moveTo(-halfW, -halfH);
    shape.lineTo(halfW, -halfH);
    shape.lineTo(halfW, archCenterY);
    shape.absarc(0, archCenterY, archRadius, 0, Math.PI, false);
    shape.lineTo(-halfW, -halfH);
    shape.closePath();
    return { shape, archRadius, archCenterY };
}

function createArchHolePath(halfW, halfH) {
    const archRadius = halfW;
    const archCenterY = halfH - archRadius;
    const hole = new THREE.Path();
    hole.moveTo(-halfW, -halfH);
    hole.lineTo(halfW, -halfH);
    hole.lineTo(halfW, archCenterY);
    hole.absarc(0, archCenterY, archRadius, 0, Math.PI, false);
    hole.lineTo(-halfW, -halfH);
    hole.closePath();
    return hole;
}

function createCircleShape(radius) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    shape.closePath();
    return shape;
}

function createCircleHolePath(radius) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius, 0, Math.PI * 2, true);
    hole.closePath();
    return hole;
}

const LatticePanel = ({ width, height, styleModel, materialColor, patternScale = 1, panelShape = 'Rectangle' }) => {
    const groupRef = useRef();
    const [mdfTexture, setMdfTexture] = useState(null);

    // Load the selected style model
    const { scene } = useGLTF(styleModel);

    // Load MDF texture for all panel meshes
    const textureRef = useRef(null);
    useEffect(() => {
        const loader = new THREE.TextureLoader();
        loader.load(
            MDF_TEXTURE_PATH,
            (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(2, 2);
                tex.colorSpace = THREE.LinearSRGBColorSpace;
                textureRef.current = tex;
                setMdfTexture(tex);
            },
            undefined,
            (err) => {
                console.warn('[LatticePanel] Failed to load MDF texture from', MDF_TEXTURE_PATH, err);
                setMdfTexture(null);
            }
        );
        return () => {
            if (textureRef.current) {
                textureRef.current.dispose();
                textureRef.current = null;
            }
        };
    }, []);

    // Target dimensions in scene units.
    const targetWidth = width / 10;
    const targetHeight = height / 10;

    // Clip to the requested panel rectangle (Rectangle mode only)
    const clippingPlanes = useMemo(() => {
        if (panelShape !== 'Rectangle') return [];
        const halfW = targetWidth / 2;
        const halfH = targetHeight / 2;
        return [
            new THREE.Plane(new THREE.Vector3(1, 0, 0), halfW),
            new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfW),
            new THREE.Plane(new THREE.Vector3(0, 1, 0), halfH),
            new THREE.Plane(new THREE.Vector3(0, -1, 0), halfH)
        ];
    }, [targetWidth, targetHeight, panelShape]);

    // Stencil clip mask for Circle / Arch shapes
    const clipMask = useMemo(() => {
        if (panelShape === 'Rectangle') return null;
        let geometry;
        if (panelShape === 'Circle') {
            const radius = Math.min(targetWidth, targetHeight) / 2;
            geometry = new THREE.ShapeGeometry(createCircleShape(radius), 64);
        } else if (panelShape === 'Arch') {
            const { shape } = createArchShape(targetWidth / 2, targetHeight / 2);
            geometry = new THREE.ShapeGeometry(shape);
        }
        if (!geometry) return null;
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            colorWrite: false,
            depthWrite: false,
            depthTest: false,
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
            stencilFail: THREE.KeepStencilOp,
            stencilZFail: THREE.KeepStencilOp,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = -10;
        mesh.frustumCulled = false;
        mesh.userData.isClipMask = true;
        return mesh;
    }, [panelShape, targetWidth, targetHeight]);

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

    // Build border frame matching the panel shape
    const frameGroup = useMemo(() => {
        const group = new THREE.Group();
        const halfW = targetWidth / 2;
        const halfH = targetHeight / 2;
        const t = FRAME_THICKNESS;
        const d = FRAME_DEPTH;

        if (panelShape === 'Rectangle') {
            const bars = [
                { w: targetWidth + 2 * t, h: t, x: 0, y: halfH + t / 2 },
                { w: targetWidth + 2 * t, h: t, x: 0, y: -(halfH + t / 2) },
                { w: t, h: targetHeight, x: -(halfW + t / 2), y: 0 },
                { w: t, h: targetHeight, x: halfW + t / 2, y: 0 },
            ];
            bars.forEach(({ w, h, x, y }) => {
                const geo = new THREE.BoxGeometry(w, h, d);
                const mesh = new THREE.Mesh(geo);
                mesh.position.set(x, y, 0);
                mesh.renderOrder = 2;
                mesh.userData.isFrame = true;
                group.add(mesh);
            });
        } else if (panelShape === 'Circle') {
            const radius = Math.min(targetWidth, targetHeight) / 2;
            const ringShape = createCircleShape(radius + t);
            ringShape.holes.push(createCircleHolePath(radius));
            const geo = new THREE.ExtrudeGeometry(ringShape, { depth: d, bevelEnabled: false });
            geo.translate(0, 0, -d / 2);
            const mesh = new THREE.Mesh(geo);
            mesh.renderOrder = 2;
            mesh.userData.isFrame = true;
            group.add(mesh);
        } else if (panelShape === 'Arch') {
            const { archRadius, archCenterY } = createArchShape(halfW, halfH);
            const outerHalfW = halfW + t;
            const outerArchRadius = archRadius + t;
            const outerShape = new THREE.Shape();
            outerShape.moveTo(-outerHalfW, -(halfH + t));
            outerShape.lineTo(outerHalfW, -(halfH + t));
            outerShape.lineTo(outerHalfW, archCenterY);
            outerShape.absarc(0, archCenterY, outerArchRadius, 0, Math.PI, false);
            outerShape.lineTo(-outerHalfW, -(halfH + t));
            outerShape.holes.push(createArchHolePath(halfW, halfH));
            const geo = new THREE.ExtrudeGeometry(outerShape, { depth: d, bevelEnabled: false });
            geo.translate(0, 0, -d / 2);
            const mesh = new THREE.Mesh(geo);
            mesh.renderOrder = 2;
            mesh.userData.isFrame = true;
            group.add(mesh);
        }

        return group;
    }, [panelShape, targetWidth, targetHeight]);

    // Apply material (MDF texture + color) to all meshes using PBR material
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.traverse((child) => {
                if (child.isMesh) {
                    if (child.userData.isClipMask) return;

                    const geom = child.geometry;
                    const isFrame = child.userData.isFrame === true;

                    // Generate box-projected UVs (always for frame meshes, otherwise only when missing)
                    if (geom && (!geom.attributes.uv || isFrame)) {
                        const pos = geom.attributes.position;
                        const count = pos.count;
                        const uvs = new Float32Array(count * 2);
                        const box = new THREE.Box3().setFromBufferAttribute(pos);
                        const size = new THREE.Vector3();
                        box.getSize(size);

                        for (let i = 0; i < count; i++) {
                            const x = pos.getX(i);
                            const y = pos.getY(i);
                            uvs[i * 2] = (x - box.min.x) / (size.x || 1);
                            uvs[i * 2 + 1] = (y - box.min.y) / (size.y || 1);
                        }
                        geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                    }

                    const baseProps = {
                        color: new THREE.Color(materialColor),
                        normalMap: mdfTexture || null,
                        normalScale: new THREE.Vector2(1, 1),
                        metalness: 0.01,
                        roughness: 0.9,
                        side: THREE.DoubleSide,
                        envMapIntensity: 0.7,
                    };

                    if (isFrame) {
                        child.renderOrder = 2;
                        child.material = new THREE.MeshStandardMaterial(baseProps);
                    } else if (panelShape === 'Rectangle') {
                        child.renderOrder = 0;
                        child.material = new THREE.MeshStandardMaterial({
                            ...baseProps,
                            clippingPlanes,
                            clipShadows: true,
                        });
                    } else {
                        child.renderOrder = 1;
                        child.material = new THREE.MeshStandardMaterial({
                            ...baseProps,
                            stencilWrite: true,
                            stencilRef: 1,
                            stencilFunc: THREE.EqualStencilFunc,
                            stencilFail: THREE.KeepStencilOp,
                            stencilZFail: THREE.KeepStencilOp,
                            stencilZPass: THREE.KeepStencilOp,
                        });
                    }
                }
            });
        }
    }, [materialColor, mdfTexture, tiledGroup, frameGroup, clippingPlanes, panelShape, clipMask]);

    return (
        <group ref={groupRef}>
            {clipMask && <primitive object={clipMask} />}
            <primitive object={tiledGroup} />
            <primitive object={frameGroup} />
        </group>
    );
};


export default LatticePanel;
