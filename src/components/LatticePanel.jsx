import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MDF_TEXTURE_PATH = '/texture/mdf.jpg';
// Constants removed in favor of dynamic props
// const FRAME_THICKNESS = 0.15;
// const FRAME_DEPTH = 0.12;

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

const LatticePanel = ({
    width,
    height,
    styleModel,
    materialColor,
    patternScale = 1,
    panelShape = 'Rectangle',
    thickness = 0.25, // Default thickness in inches
    borderSize = 0.5, // Default border size in inches
}) => {
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

        // 1. Determine optimal orientation using the raw scene
        const rawBox = new THREE.Box3().setFromObject(scene);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);

        // If Y dimension is significantly smaller than Z, it's likely a "flat" model (laying on XZ).
        // We want the pattern to face the camera (XY plane).
        let rotX = 0;
        if (rawSize.y < rawSize.z * 0.5) {
            rotX = -Math.PI / 2;
        } else if (rawSize.z < rawSize.y * 0.1) {
            rotX = 0;
        } else {
            // Fallback: compare raw Y and Z.
            rotX = rawSize.y < rawSize.z ? -Math.PI / 2 : 0;
        }

        // Clone for measurement with correction
        const originalClone = scene.clone(true);
        originalClone.rotation.x = rotX;
        originalClone.updateMatrixWorld(true);

        // 2. Measure corrected dimensions and center
        const bbox = new THREE.Box3().setFromObject(originalClone);
        const modelSize = new THREE.Vector3();
        bbox.getSize(modelSize);
        const modelCenter = new THREE.Vector3();
        bbox.getCenter(modelCenter);

        // Target depth in scene units
        const targetDepth = thickness / 10;

        // Z is depth (after rotation).
        const rawDepth = modelSize.z || 0;
        const isFlat = rawDepth < 0.001;
        const unitDepth = isFlat ? targetDepth : rawDepth;

        // Unit dimensions (after rotation)
        const EPSILON = 1e-6;
        const unitWidth = Math.max(modelSize.x || 1, EPSILON);
        const unitHeight = Math.max(modelSize.y || 1, EPSILON);
        const safePatternScale = Number.isFinite(patternScale)
            ? Math.max(patternScale, EPSILON)
            : 1;

        // Calculate tiles needed from pattern-scaled unit size so larger pattern scales
        // produce fewer/larger motifs while still covering the panel bounds.
        const scaledUnitWidth = unitWidth * safePatternScale;
        const scaledUnitHeight = unitHeight * safePatternScale;
        const tilesX = Math.max(1, Math.ceil(targetWidth / Math.max(scaledUnitWidth, EPSILON)));
        const tilesY = Math.max(1, Math.ceil(targetHeight / Math.max(scaledUnitHeight, EPSILON)));

        const actualWidth = Math.max(tilesX * scaledUnitWidth, EPSILON);
        const actualHeight = Math.max(tilesY * scaledUnitHeight, EPSILON);

        // Keep cover+clip behavior: choose the larger axis ratio so the tiled pattern
        // always covers the panel, then apply the requested pattern scale.
        const coverScaleX = targetWidth / actualWidth;
        const coverScaleY = targetHeight / actualHeight;
        const coverScale = Math.max(coverScaleX, coverScaleY);
        const uniformScale = coverScale * safePatternScale;

        // Create the tiled grid
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const tileClone = scene.clone(true);
                tileClone.rotation.x = rotX;

                // Position each tile in a grid
                const gridX = (x - (tilesX - 1) / 2) * unitWidth;
                const gridY = (y - (tilesY - 1) / 2) * unitHeight;

                // Apply centering correction
                tileClone.position.set(
                    gridX - modelCenter.x,
                    gridY - modelCenter.y,
                    -modelCenter.z
                );

                group.add(tileClone);
            }
        }

        // Center the group
        group.position.set(0, 0, 0);

        // Calculate Z scale to match target thickness
        const scaleZ = targetDepth / unitDepth;

        group.scale.set(uniformScale, uniformScale, scaleZ);

        return group;
    }, [scene, targetWidth, targetHeight, patternScale, thickness]);

    // Build border frame matching the panel shape
    const frameGroup = useMemo(() => {
        const group = new THREE.Group();
        const halfW = targetWidth / 2;
        const halfH = targetHeight / 2;

        // Convert props to scene units (1 unit = 10 inches)
        const t = borderSize / 10;
        const d = thickness / 10;

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
    }, [panelShape, targetWidth, targetHeight, borderSize, thickness]);

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
                        // Ensure normals are computed for proper tri-planar projection
                        if (!geom.attributes.normal) {
                            geom.computeVertexNormals();
                        }

                        const pos = geom.attributes.position;
                        const nor = geom.attributes.normal;
                        const count = pos.count;
                        const uvs = new Float32Array(count * 2);

                        if (isFrame && nor) {
                            // Use a uniform UV scale for all frame pieces so texture looks
                            // identical on every bar regardless of its dimensions.
                            const uvScale = 2.0; // UV repeats per scene unit
                            for (let i = 0; i < count; i++) {
                                const x = pos.getX(i);
                                const y = pos.getY(i);
                                const z = pos.getZ(i);

                                // Tri-planar projection: pick UV axes based on dominant normal
                                const nx = Math.abs(nor.getX(i));
                                const ny = Math.abs(nor.getY(i));
                                const nz = Math.abs(nor.getZ(i));

                                if (nz >= nx && nz >= ny) {
                                    // Front/back face → project on XY
                                    uvs[i * 2] = x * uvScale;
                                    uvs[i * 2 + 1] = y * uvScale;
                                } else if (nx >= ny) {
                                    // Left/right side face → project on YZ
                                    uvs[i * 2] = z * uvScale;
                                    uvs[i * 2 + 1] = y * uvScale;
                                } else {
                                    // Top/bottom face → project on XZ
                                    uvs[i * 2] = x * uvScale;
                                    uvs[i * 2 + 1] = z * uvScale;
                                }
                            }
                        } else {
                            // Non-frame meshes: simple XY projection normalised to mesh bounds
                            const box = new THREE.Box3().setFromBufferAttribute(pos);
                            const size = new THREE.Vector3();
                            box.getSize(size);
                            for (let i = 0; i < count; i++) {
                                const x = pos.getX(i);
                                const y = pos.getY(i);
                                uvs[i * 2] = (x - box.min.x) / (size.x || 1);
                                uvs[i * 2 + 1] = (y - box.min.y) / (size.y || 1);
                            }
                        }
                        geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                    }

                    const baseColor = new THREE.Color(materialColor);

                    const baseProps = {
                        color: baseColor,
                        normalMap: mdfTexture || null,
                        normalScale: new THREE.Vector2(1, 1),
                        metalness: 0.2,
                        roughness: 1,
                        side: THREE.DoubleSide,
                        envMapIntensity: 0.7,
                    };

                    if (isFrame) {
                        child.renderOrder = 2;
                        // Make frame slightly lighter to match the panel/model appearance
                        const frameColor = baseColor
                            .clone()
                            .lerp(new THREE.Color('#000000'), 0.05); // 6% toward white
                        child.material = new THREE.MeshStandardMaterial({
                            ...baseProps,
                            color: frameColor
                        });
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
