import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

export default function Play() {
    const mountRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSolved, setIsSolved] = useState(false);
    const size = location.state?.size || 3;
    useEffect(() => {
        let frameId;
        let isDisposed = false;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050505, 0.06);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Adjust camera distance based on size
        const initialCamZ = size === 2 ? 5 : size === 3 ? 6.5 : 8.5;
        // Place camera showing Front (Z) prominent, and Right (X) / Top (Y) slightly
        const dist = initialCamZ * 1.3;
        const initialPosDir = new THREE.Vector3(0.35, 0.35, 1.0).normalize();
        camera.position.copy(initialPosDir.multiplyScalar(dist));

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        if (mountRef.current) {
            mountRef.current.appendChild(renderer.domElement);
        }

        const controls = new TrackballControls(camera, renderer.domElement);
        controls.rotateSpeed = 3.5;
        controls.noPan = true;
        controls.noZoom = false;
        controls.dynamicDampingFactor = 0.1;
        controls.minDistance = 3;
        controls.maxDistance = 20;

        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 1000;
        const posArray = new Float32Array(starsCount * 3);
        for (let i = 0; i < starsCount * 3; i++) { posArray[i] = (Math.random() - 0.5) * 35; }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const starsMaterial = new THREE.PointsMaterial({ size: 0.04, color: 0xffffff, transparent: true, opacity: 0.7 });
        const starMesh = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starMesh);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const spotLight = new THREE.SpotLight(0xffffff, 1.5);
        spotLight.position.set(10, 15, 10);
        spotLight.angle = Math.PI / 3;
        spotLight.penumbra = 0.5;
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        scene.add(spotLight);

        const cubeGroup = new THREE.Group();
        scene.add(cubeGroup);

        const floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
        floorPlane.rotation.x = -Math.PI / 2;
        floorPlane.position.y = -size * 1.5;
        floorPlane.receiveShadow = true;
        scene.add(floorPlane);

        const basicColors = [0xff4d4d, 0xffa500, 0xffffff, 0xffff00, 0x00ff00, 0x0000ff]; // Right, Left, Top, Bottom, Front, Back

        const initCube = () => {
            if (isDisposed) return;
            setIsLoading(false);

            const pieceSize = 0.96;
            const geometry = new THREE.BoxGeometry(pieceSize, pieceSize, pieceSize);

            // Calculate positions based on size
            let offset = (size - 1) / 2;
            let positions = [];
            for (let i = 0; i < size; i++) {
                positions.push(i - offset);
            }

            const boundMax = positions[positions.length - 1];
            const boundMin = positions[0];

            positions.forEach(x => {
                positions.forEach(y => {
                    positions.forEach(z => {
                        const pieceMaterials = [];
                        for (let i = 0; i < 6; i++) {
                            let isExterior = false;
                            if (i === 0 && x === boundMax) isExterior = true;
                            if (i === 1 && x === boundMin) isExterior = true;
                            if (i === 2 && y === boundMax) isExterior = true;
                            if (i === 3 && y === boundMin) isExterior = true;
                            if (i === 4 && z === boundMax) isExterior = true;
                            if (i === 5 && z === boundMin) isExterior = true;

                            if (isExterior) {
                                pieceMaterials.push(new THREE.MeshStandardMaterial({ color: basicColors[i], roughness: 0.2, metalness: 0.05 }));
                            } else {
                                pieceMaterials.push(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
                            }
                        }
                        const piece = new THREE.Mesh(geometry, pieceMaterials);
                        piece.position.set(x, y, z);
                        piece.userData.initialPosition = new THREE.Vector3(x, y, z);
                        piece.userData.initialQuaternion = piece.quaternion.clone();

                        piece.castShadow = true; piece.receiveShadow = true;
                        cubeGroup.add(piece);
                    });
                });
            });
            camera.lookAt(cubeGroup.position);
            scrambleCube(size * 10);
            scrambleCube(1); // Temporary 1 move scramble for testing
        };
        initCube();

        // --- 3. LOGIC RUBIK ---
        let isAnimating = false;

        function checkSolved() {
            if (cubeGroup.children.length === 0) return false;
            const baseQ = cubeGroup.children[0].quaternion;
            for (let i = 1; i < cubeGroup.children.length; i++) {
                const q = cubeGroup.children[i].quaternion;
                if (Math.abs(baseQ.dot(q)) < 0.99) return false;
            }
            return true;
        }

        function scrambleCube(moves = 20) {
            const axes = ['x', 'y', 'z'];
            let offset = (size - 1) / 2;
            let layers = [];
            for (let i = 0; i < size; i++) layers.push(i - offset);
            const angles = [Math.PI / 2, -Math.PI / 2];

            for (let i = 0; i < moves; i++) {
                const axis = axes[Math.floor(Math.random() * axes.length)];
                const layerValue = layers[Math.floor(Math.random() * layers.length)];
                const angle = angles[Math.floor(Math.random() * angles.length)];
                const activePieces = cubeGroup.children.filter(piece => Math.abs(piece.position[axis] - layerValue) < 0.1);

                const pivot = new THREE.Group();
                cubeGroup.add(pivot);
                activePieces.forEach(piece => pivot.attach(piece));
                pivot.rotation[axis] = angle;
                pivot.updateMatrixWorld();
                activePieces.forEach(piece => cubeGroup.attach(piece));
                cubeGroup.remove(pivot);
            }
            finalizePositions();
        }

        window.rotateLayer = function (axis, layerValue, angle) {
            if (isAnimating || isDisposed) return;
            isAnimating = true;
            const activePieces = cubeGroup.children.filter(piece => Math.abs(piece.position[axis] - layerValue) < 0.1);
            const pivot = new THREE.Group();
            cubeGroup.add(pivot);
            activePieces.forEach(piece => pivot.attach(piece));

            let currentAngle = 0;
            const speed = 0.15;
            const targetAngle = angle;

            function animateRotation() {
                if (isDisposed) return;
                const step = Math.sign(targetAngle) * speed;
                currentAngle += step;
                pivot.rotation[axis] = currentAngle;
                if (Math.abs(currentAngle) < Math.abs(targetAngle)) {
                    requestAnimationFrame(animateRotation);
                } else {
                    pivot.rotation[axis] = targetAngle;
                    pivot.updateMatrixWorld();
                    activePieces.forEach(piece => cubeGroup.attach(piece));
                    cubeGroup.remove(pivot);
                    finalizePositions();
                    isAnimating = false;
                    if (checkSolved()) {
                        setIsSolved(true);
                    }
                }
            }
            animateRotation();
        }

        // Export rotation trigger to window so React UI can call it
        window.triggerRotation = function (moveType, isPrimeMove) {
            if (isAnimating || isDisposed) return;
            const baseAngle = Math.PI / 2;
            const isPrime = isPrimeMove ? -1 : 1;
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

            let viewVector = null;
            let targetAxisGlobal = '';
            switch (moveType) {
                case 'r': viewVector = camRight; break;
                case 'l': viewVector = camRight.clone().negate(); break;
                case 'u': viewVector = camUp; break;
                case 'd': viewVector = camUp.clone().negate(); break;
                default: return;
            }

            if (viewVector) {
                const axes = [
                    { axis: 'x', dir: 1, vec: new THREE.Vector3(1, 0, 0) }, { axis: 'x', dir: -1, vec: new THREE.Vector3(-1, 0, 0) },
                    { axis: 'y', dir: 1, vec: new THREE.Vector3(0, 1, 0) }, { axis: 'y', dir: -1, vec: new THREE.Vector3(0, -1, 0) },
                    { axis: 'z', dir: 1, vec: new THREE.Vector3(0, 0, 1) }, { axis: 'z', dir: -1, vec: new THREE.Vector3(0, 0, -1) }
                ];
                let maxDot = -Infinity, bestMatch = null;
                axes.forEach(a => {
                    const dot = viewVector.dot(a.vec);
                    if (dot > maxDot) { maxDot = dot; bestMatch = a; }
                });

                // calculate bounds
                let offset = (size - 1) / 2;
                const layerValue = bestMatch.dir * offset; // Get outermost layer
                const rotationAngle = -baseAngle * bestMatch.dir * isPrime;
                window.rotateLayer(bestMatch.axis, layerValue, rotationAngle);
            }
        }

        function finalizePositions() {
            cubeGroup.children.forEach(piece => {
                // Round to nearest 0.5 or integer depending on size offset
                if (size % 2 === 0) {
                    piece.position.x = Math.round(piece.position.x - 0.5) + 0.5;
                    piece.position.y = Math.round(piece.position.y - 0.5) + 0.5;
                    piece.position.z = Math.round(piece.position.z - 0.5) + 0.5;
                } else {
                    piece.position.x = Math.round(piece.position.x);
                    piece.position.y = Math.round(piece.position.y);
                    piece.position.z = Math.round(piece.position.z);
                }
                piece.quaternion.normalize();
            });
        }

        // --- 4. RENDER LOOP ---
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            controls.handleResize();
        };
        window.addEventListener('resize', handleResize);

        const handleKeyDown = (e) => {
            if (['r', 'l', 'u', 'd'].includes(e.key.toLowerCase())) {
                window.triggerRotation(e.key.toLowerCase(), e.shiftKey);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        let isDraggingCamera = false;
        const ptrDown = () => { isDraggingCamera = true; };
        const ptrUp = () => { isDraggingCamera = false; };
        renderer.domElement.addEventListener('pointerdown', ptrDown);
        window.addEventListener('pointerup', ptrUp);

        const clock = new THREE.Clock();
        function animate() {
            if (isDisposed) return;
            frameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();
            starMesh.rotation.y = elapsedTime * 0.02;

            if (!isDraggingCamera) {
                const axes = [
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
                    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
                ];

                // Snap camera up vector to keep vertical alignment
                let closestUp = axes[0], maxDotUp = -Infinity;
                axes.forEach(axis => {
                    const dot = camera.up.dot(axis);
                    if (dot > maxDotUp) { maxDotUp = dot; closestUp = axis; }
                });
                camera.up.lerp(closestUp, 0.08).normalize();

                // Snap camera position vector to isometric corners (showing 3 faces)
                const currentPos = camera.position.clone();
                const dist = currentPos.length();
                if (dist > 0) {
                    const posDir = currentPos.clone().normalize();
                    // Create 24 'snapping points' (8 corners, each biased towards one of the 3 faces)
                    // We want the main face to be prominent (e.g. 1.0) and other two faces slight (e.g. 0.3)
                    const m = 1.0;   // Main face
                    const s = 0.35;  // Side/top faces

                    const cornerAxes = [];
                    // For each of the 6 flat faces, create 4 tilted corners
                    const signs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

                    // Main face is X (Right/Left)
                    signs.forEach(([y, z]) => {
                        cornerAxes.push(new THREE.Vector3(m, y * s, z * s).normalize());
                        cornerAxes.push(new THREE.Vector3(-m, y * s, z * s).normalize());
                    });
                    // Main face is Y (Top/Bottom)
                    signs.forEach(([x, z]) => {
                        cornerAxes.push(new THREE.Vector3(x * s, m, z * s).normalize());
                        cornerAxes.push(new THREE.Vector3(x * s, -m, z * s).normalize());
                    });
                    // Main face is Z (Front/Back)
                    signs.forEach(([x, y]) => {
                        cornerAxes.push(new THREE.Vector3(x * s, y * s, m).normalize());
                        cornerAxes.push(new THREE.Vector3(x * s, y * s, -m).normalize());
                    });
                    let closestPos = cornerAxes[0], maxDotPos = -Infinity;
                    cornerAxes.forEach(axis => {
                        const dot = posDir.dot(axis);
                        if (dot > maxDotPos) { maxDotPos = dot; closestPos = axis; }
                    });
                    posDir.lerp(closestPos, 0.08).normalize();
                    camera.position.copy(posDir.multiplyScalar(dist));
                }
            }

            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        return () => {
            isDisposed = true;
            cancelAnimationFrame(frameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointerup', ptrUp);
            if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
            // Clean up ThreeJS resources
            scene.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
            });
            renderer.dispose();
        };
    }, [size]);

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%', display: 'block' }} />

            <button className="back-btn" onClick={() => navigate('/')}>&larr; Back</button>

            {isLoading && <div id="loading">Loading...</div>}

            {!isLoading && !isSolved && (
                <div id="ui-container">
                    <div className="instruction">Drag to rotate the cube. Use buttons or R,L,U,D keys.</div>
                    <div id="controls">
                        <button className="btn" onClick={() => window.triggerRotation('u', false)}>U</button>
                        <button className="btn" onClick={() => window.triggerRotation('u', true)}>U'</button>
                        <button className="btn" onClick={() => window.triggerRotation('d', false)}>D</button>
                        <button className="btn" onClick={() => window.triggerRotation('d', true)}>D'</button>
                        <button className="btn" onClick={() => window.triggerRotation('l', false)}>L</button>
                        <button className="btn" onClick={() => window.triggerRotation('l', true)}>L'</button>
                        <button className="btn" onClick={() => window.triggerRotation('r', false)}>R</button>
                        <button className="btn" onClick={() => window.triggerRotation('r', true)}>R'</button>
                    </div>
                </div>
            )}

            {isSolved && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)', padding: '40px', borderRadius: '20px',
                    textAlign: 'center', color: 'white', zIndex: 10,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '10px' }}>Congratulations!</h2>
                    <p style={{ fontSize: '1.2rem', marginBottom: '30px', opacity: 0.8 }}>You have solved the cube!</p>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button
                            style={{
                                padding: '12px 24px', cursor: 'pointer', borderRadius: '8px',
                                border: 'none', backgroundColor: '#4CAF50', color: 'white',
                                fontSize: '1rem', fontWeight: 'bold'
                            }}
                            onClick={() => window.location.reload()}
                        >
                            Play Again
                        </button>
                        <button
                            style={{
                                padding: '12px 24px', cursor: 'pointer', borderRadius: '8px',
                                border: 'none', backgroundColor: '#555', color: 'white',
                                fontSize: '1rem', fontWeight: 'bold'
                            }}
                            onClick={() => navigate('/')}
                        >
                            Back
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
