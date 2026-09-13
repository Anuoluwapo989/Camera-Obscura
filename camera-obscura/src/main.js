// Import Statements

import * as THREE from 'three'
// import GUI from 'lil-gui'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { depth, roughness } from 'three/src/nodes/TSL.js'

// Scene and Camera
const scene = new THREE.Scene()
scene.background = new THREE.Color('#0f0f0f')
scene.fog = new THREE.Fog('#0f0f0f', 25, 70)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

// --- HDRI Environment (Global Reflections) ---
const exrLoader = new EXRLoader()

exrLoader.load('/studio.exr', (environmentMap) => {
  // Wraps the flat image into a 360 degree sphere
  environmentMap.mapping = THREE.EquirectangularReflectionMapping

  // Makes all current and future models reflect it
  scene.environment = environmentMap

  // Global Multiplier for reflection brightness
  scene.environmentIntensity = 0.2
})
// Setting up the camera position
camera.position.set(0, 0, 5)

const lightColors = {
  key: '#ffffff',
  fill: '#ffffff',
  rim: '#ffffff'
}


// --- GUI Controls ---
// Initialize new GUI
// const gui = new GUI()

// const cameraGui = new GUI({ title: 'Camera Module' })
// cameraGui.hide() // Hide the camera GUI by default, but keep it accessible for future use

// Canvas and Renderer
const canvas = document.querySelector('#myCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, preserveDrawingBuffer: true, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(window.devicePixelRatio)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

// --- SENSOR OPTICS ---
// Processes raw 3D light using the ACES Filmic color science standard
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0 // Base exposure, which we will dynamically control

// --- GPU CONTEXT LOSS RECOVERY ---
canvas.addEventListener('webglcontextlost', (event) => {
  // Prevent the browser from permanently disabling the canvas
  event.preventDefault()
  console.error('CRITICAL! WebGL Context Lost. GPU disconnected ot crashed.')

  // Fallback
  window.location.reload()
}, false)

canvas.addEventListener('webglcontextrestored', () => {
  console.log('WebGL Context Restored. Rebuilding graohics pipeline...')
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
}, false)

// Post-processing (Lens Optics)
const rendertarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  { samples: 4 })
const composer = new EffectComposer(renderer, rendertarget)

composer.setPixelRatio(window.devicePixelRatio)

// Draw the base 3D Scene
const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

// Apply a bokeh effect to simulate depth of field
const bokehPass = new BokehPass(scene, camera, {
  focus: 4.5,
  aperture: 0.000,
  maxblur: 0.00,
  width: window.innerWidth,
  height: window.innerHeight
})
composer.addPass(bokehPass)

// Output the final rendered image to the screen
const outputPass = new OutputPass()
composer.addPass(outputPass)

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.screenSpacePanning = false
controls.enablePan = false

// VERTICAL LOCKS (Y-Axis)
// Prevents camera from dipping below the floor (with a 0.05 buffer to prevent clipping)
controls.maxPolarAngle = Math.PI / 2 - 0.05
// Prevents camera from going perfectly top-down and flipping the axis
controls.minPolarAngle = 0.1

// HORIZONTAL LOCKS (X/Z-Axis)
// Clamps the left/right orbit so you can never swing outside the 3 walls
controls.minAzimuthAngle = -Math.PI / 2.5 // Left wall limit
controls.maxAzimuthAngle = Math.PI / 2.5  // Right wall limit

// ZOOM LOCKS
controls.maxDistance = 14; // Prevents zooming backwards out of the studio walls
controls.minDistance = 2;  // Prevents zooming directly through the 3D model

// --- Lighting ---

// Main Light
const color = 0xFFFFFF
const intensity = 230
const light = new THREE.SpotLight(color, intensity)
light.position.set(3, 4, 3)
light.angle = Math.PI / 6
light.penumbra = 0.5
light.decay = 2
light.castShadow = true;

// --- SHADOW ACNE FIX ---
// Upgrade from the default 512x512 shadow map to a crisp 2K map
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;

// Nudge the shadow math slightly beneath the surface to stop the parallel lines
light.shadow.bias = -0.0001;

// Smooth the shadow map calculations specifically along curved surfaces (like car fenders)
light.shadow.normalBias = 0.02;

scene.add(light)

// Fill Light
const fillLight = new THREE.SpotLight(0xFFFFFF, 226)
fillLight.position.set(-3, 3, -3)
fillLight.angle = Math.PI / 4
fillLight.penumbra = 0.8
fillLight.decay = 2
scene.add(fillLight)

// Light Helper for main light
const lightHelper = new THREE.SpotLightHelper(light)
scene.add(lightHelper)

// Light Helper for fill light
const fillLightHelper = new THREE.SpotLightHelper(fillLight)

// Shadow Acne & Resolution Fix
fillLight.shadow.mapSize.width = 2048;
fillLight.shadow.mapSize.height = 2048;
fillLight.shadow.bias = -0.0001;
fillLight.shadow.normalBias = 0.02;

scene.add(fillLightHelper)



// --- Rim Light (Kicker / Hair Light) ---
const rimLight = new THREE.SpotLight(0xFFFFFF, 350)
rimLight.position.set(0, 5, -6)
rimLight.angle = Math.PI / 5
rimLight.penumbra = 0.5
rimLight.decay = 2
rimLight.castShadow = true

// Shadow Acne & Resolution Fix
rimLight.shadow.mapSize.width = 2048;
rimLight.shadow.mapSize.height = 2048;
rimLight.shadow.bias = -0.0001;
rimLight.shadow.normalBias = 0.02;
scene.add(rimLight)

const rimLightHelper = new THREE.SpotLightHelper(rimLight)

scene.add(rimLightHelper)


// ---PRACTICAL SOFTBOXES---

// Creating a reusable shape for the softboxes
const softboxGeometry = new THREE.BoxGeometry(1, 1, 0.1)
const keysoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.key })
const fillsoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.fill })

// Key Light Softbox
const keySoftbox = new THREE.Mesh(softboxGeometry, keysoftboxMaterial)
scene.add(keySoftbox)

// Fill Light Softbox
const fillSoftbox = new THREE.Mesh(softboxGeometry, fillsoftboxMaterial)
scene.add(fillSoftbox)

// Rim Light Softbox
const rimSoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.rim })
const rimSoftbox = new THREE.Mesh(softboxGeometry, rimSoftboxMaterial)
scene.add(rimSoftbox)

// --- 3D Objects ---

// Initialize the GLTFLoader to load 3D models
const loader = new GLTFLoader()

// Global variable to hold the loaded subject
let subject

// --- 3D Uploader & Memory Manager ---

// Create a hidden file input locked to modern 3D web formats
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.accept = '.glb, .gltf'
fileInput.style.display = 'none'
document.body.appendChild(fileInput)

// Memory Cleanup Function
function disposeCurrentSubject() {
  if (!subject) return

  scene.remove(subject)

  // Traverse the old model and delete data from GPU
  subject.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose()

      // Delete Materials and Textures
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose()
        }
      }
    }
  })
}

// The File Parser
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return

  // Read the file as binary data
  const reader = new FileReader()
  reader.onload = (e) => {
    const arrayBuffer = e.target.result

    // Parse the data into a Three.js scene
    loader.parse(arrayBuffer, '', (gltf) => {

      // Delete the old model to prevent crashes
      disposeCurrentSubject()

      // Assign the new model to the scene
      subject = gltf.scene

      // Re apply shadow and depth for the studio
      subject.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }

        if (child.material) {
          child.material.transparent = false
          child.material.depthWrite = true
        }
      })


      // Reset the scale and position to the center of the studio
      subject.scale.set(11, 11, 11)
      subject.position.set(0, -0.5, 0)

      scene.add(subject)


      // Point the lights back at the target
      light.target = subject
      fillLight.target = subject
      rimLight.target = subject
    })
  }
  reader.readAsArrayBuffer(file)

  // Clear the input after loading
  fileInput.value = ''
})

const modelActions = {
  uploadModel: () => fileInput.click()
}


loader.load('model.glb', (gltf) => {
  subject = gltf.scene

  // Traverse the subject's children to enable shadows for all meshes
  subject.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }

    if (child.material) {
      child.material.transparent = false
      child.material.depthWrite = true
    }
  })

  // Scale and position the subject
  subject.scale.set(11, 11, 11)
  subject.position.set(0, -0.5, 0)

  scene.add(subject)

  // Update the light targets to point to the subject
  light.target = subject
  fillLight.target = subject

})

  // Add GUI controls for scaling the 3D model
//   const modelFolder = gui.addFolder('3D Model Setup')

//   // 3D Model Upload Button
//   modelFolder.add(modelActions, 'uploadModel').name('UPLOAD .GLB / .GLTF')

//   modelFolder.add(subject.scale, 'x', 0.1, 100).name('Scale Model').onChange((val) => {
//     subject.scale.set(val, val, val)
//   })

//   // Allows you to nudge the camera up or down until it touches the floor
//   modelFolder.add(subject.position, 'y', -5, 5).name('Height Offset');



// })


// // Adding a sphere to the scene
// const geometry = new THREE.SphereGeometry(1, 128, 128)
// const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
// const sphere = new THREE.Mesh(geometry, material)
// scene.add(sphere)
// sphere.castShadow = true;

// Adding a plane to the scene
// const planeSize = 200
// const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize)
// const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })
// const mesh = new THREE.Mesh(planeGeometry, planeMaterial)
// mesh.rotation.x = -Math.PI / 2
// mesh.position.y = -1
// scene.add(mesh)
// mesh.receiveShadow = true;

// --- Changing the plane into a Cyclorama (Cyc Wall) ---

// We're forming a J shape

// --- The Seamless Cyclrorama ---
function createCycloramaGeometry() {
  // We start with a massive, high-resolution flat plane
  const planeWidth = 120 // Increased from 60 to push the side walls infinitely wide
  const planeDepth = 80  // Increased from 40 to push the back wall infinitely high
  const geo = new THREE.PlaneGeometry(planeWidth, planeDepth, 128, 128)
  const pos = geo.attributes.position

  const floorHalfWidth = 14 // Flat floor extends 14 units left and right
  const floorBack = 6       // Flat floor extends 6 units back from origin
  const radius = 6          // Smoothness of the corner fillet

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i)
    const v = pos.getY(i)

    // Calculate distance from the flat floor boundary
    let dx = 0
    let dy = 0

    if (u > floorHalfWidth) dx = u - floorHalfWidth
    else if (u < -floorHalfWidth) dx = u + floorHalfWidth

    if (v > floorBack) dy = v - floorBack // Only curve the back wall, not the front

    // Euclidean distance from the boundary (This is what rounds the corners)
    const d = Math.sqrt(dx * dx + dy * dy)

    // The closest point on the flat boundary
    const uFlat = u - dx
    const vFlat = v - dy

    let finalX, finalY, finalZ

    if (d === 0) {
      // 1. Flat Floor
      finalX = u
      finalY = -1
      finalZ = -v

    } else if (d <= radius) {
      // 2. Smooth Sweeping Cove (Floor to Wall & Wall to Wall)
      const theta = (d / radius) * (Math.PI / 2)
      const travel = radius * Math.sin(theta)
      const height = radius * (1 - Math.cos(theta))

      finalX = uFlat + (dx / d) * travel
      finalY = -1 + height
      finalZ = -(vFlat + (dy / d) * travel)

    } else {
      // 3. Vertical Walls
      const height = radius + (d - radius)
      const travel = radius

      finalX = uFlat + (dx / d) * travel
      finalY = -1 + height
      finalZ = -(vFlat + (dy / d) * travel)
    }

    pos.setXYZ(i, finalX, finalY, finalZ)
  }

  geo.computeVertexNormals()
  return geo
}

const cycGeometry = createCycloramaGeometry()
const cycMaterial = new THREE.MeshStandardMaterial({
  color: 0x990a00,
  roughness: 0.85,
  metalness: 0.05,
  side: THREE.DoubleSide
})

const cyclorama = new THREE.Mesh(cycGeometry, cycMaterial)
cyclorama.receiveShadow = true
scene.add(cyclorama)

// const cycGeometry = createCycloramaGeometry()
// const cycMaterial = new THREE.MeshStandardMaterial({
//   color: 0x8a2020, // Rich studio paper base
//   roughness: 0.85,  // Matte paper finish
//   metalness: 0.05,
//   side: THREE.DoubleSide
// })

// const cyclorama = new THREE.Mesh(cycGeometry, cycMaterial)
// cyclorama.position.set(0, 0, 0)
// cyclorama.receiveShadow = true
// scene.add(cyclorama)

// // The 2D profile of the backdrop
// const sweepProfile = new THREE.Shape()
// sweepProfile.moveTo(0, 20) // The point at the top of the J
// sweepProfile.lineTo(0, 2) // Drawing the stem of the J
// sweepProfile.quadraticCurveTo(0, 0, 2, 0) // Drawing the smooth J Curve
// sweepProfile.lineTo(30, 0) // The flat floor

// // Extrude settings for the extrusion
// const extrudeSettings = {
//   steps: 1,
//   depth: 40,
//   bevelEnabled: false,
//   curveSegments: 64 // High res so the curve gradients are smooth
// }

// const cycGeometry = new THREE.ExtrudeGeometry(sweepProfile, extrudeSettings)

// // The finish of the cyc
// const cycMaterial = new THREE.MeshStandardMaterial({
//   color: 0x222222,
//   roughness: 0.9, // Matte
//   metalness: 0.0
// })

// const cyclorama = new THREE.Mesh(cycGeometry, cycMaterial)
// cyclorama.receiveShadow = true

// // Positioning the cyc behind the subject
// cyclorama.rotation.y = -Math.PI / 2
// cyclorama.position.set(20, -1, -5)

// scene.add(cyclorama)




// --- A working Camera ---

const cameraActions = {
  takeSnapshot: () => {
    // 1. Physically pause the main animation loop so it doesn't interfere
    renderer.setAnimationLoop(null)

    const currentWidth = window.innerWidth
    const currentHeight = window.innerHeight
    const currentAspect = camera.aspect
    const currentPixelRatio = renderer.getPixelRatio()

    const exportWidth = 2400
    const exportHeight = 3000

    // Temporarily force the 3D Engine to render at a higher resolution
    camera.aspect = exportWidth / exportHeight
    camera.updateProjectionMatrix()

    renderer.setPixelRatio(1)
    renderer.setSize(exportWidth, exportHeight, false)

    const exportRenderTarget = new THREE.WebGLRenderTarget(exportWidth, exportHeight, { samples: 0 })
    const originalTarget = composer.renderTarget1
    
    composer.reset(exportRenderTarget)
    composer.setSize(exportWidth, exportHeight)

    // 2. Render synchronously and immediately read the pixels
    composer.render()
    const imageURL = renderer.domElement.toDataURL('image/png')

    // 3. Trigger download
    const link = document.createElement('a')
    link.href = imageURL
    link.download = 'studio-render-4K.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // 4. Restore original state
    camera.aspect = currentAspect
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(currentPixelRatio)
    composer.setSize(currentWidth, currentHeight)
    renderer.setSize(currentWidth, currentHeight)

    composer.reset(originalTarget)
    composer.setSize(currentWidth, currentHeight)
    exportRenderTarget.dispose()

    // 5. Resume the animation loop instantly
    renderer.setAnimationLoop(animate)
  }
}




// --- Camera Lens Controls ---
// const cameraFolder = cameraGui.addFolder('Lens Optics / Depth of Field')
// cameraFolder.add(bokehPass.uniforms.focus, 'value', 0.0, 20).name('Focus Distance')
// cameraFolder.add(bokehPass.uniforms.aperture, 'value', 0.0, 0.05).name('Aperture (f-stop)')
// cameraFolder.add(bokehPass.uniforms.maxblur, 'value', 0.0, 0.02).name('Max Blur Radius')

// // Add a button to the GUI for taking snapshots
// cameraGui.add(cameraActions, 'takeSnapshot').name('Take Snapshot');

// Default Lens Settings
const lensState = {
  fStop: 2.8, // Aperture
  focusDistance: 4.5,
  focalLength: 25,
  afGrid: false,
  iso: 400,          // Base ISO
  shutterSpeed: 0.01 // Base Shutter Speed (1/100th of a second)
}

// --- CUSTOM GLASSMORPHISM CAMERA UI ---
const glassUIHTML = `
  <div id="camera-glass-ui" class="camera-glass-deck">
    <div class="lens-controls">
      <div class="control-row">
        <label>Zoom</label>
        <input type="range" id="ui-focal" min="12" max="200" value="${lensState.focalLength}" step="1">
      </div>
      <div class="control-row">
        <label>Aperture</label>
        <input type="range" id="ui-aperture" min="1.2" max="22" value="${lensState.fStop}" step="0.1">
      </div>
      <div class="control-row">
        <select id="ui-shutter">
          <option value="0.000125">1/8000</option>
          <option value="0.00025">1/4000</option>
          <option value="0.0005">1/2000</option>
          <option value="0.001">1/1000</option>
          <option value="0.002">1/500</option>
          <option value="0.004">1/250</option>
          <option value="0.008">1/125</option>
          <option value="0.01" selected>1/100</option>
          <option value="0.0166">1/60</option>
          <option value="0.0333">1/30</option>
          <option value="0.0666">1/15</option>
          <option value="0.125">1/8</option>
          <option value="0.25">1/4</option>
          <option value="0.5">1/2</option>
          <option value="1">1"</option>
        </select>
        <select id="ui-iso">
          <option value="100">ISO 100</option>
          <option value="200">ISO 200</option>
          <option value="400" selected>ISO 400</option>
          <option value="800">ISO 800</option>
          <option value="1600">ISO 1600</option>
          <option value="3200">ISO 3200</option>
          <option value="6400">ISO 6400</option>
        </select>
        <div class="toggle-row">
          <input type="checkbox" id="ui-af" ${lensState.afGrid ? 'checked' : ''}> AF Grid
        </div>
      </div>
    </div>
    <div id="ui-shutter-btn" class="shutter-btn">
      <div class="shutter-inner"></div>
    </div>
  </div>
`
document.body.insertAdjacentHTML('beforeend', glassUIHTML)

// Define the DOM elements
const glassDeck = document.getElementById('camera-glass-ui')
const uiFocal = document.getElementById('ui-focal')
const uiAperture = document.getElementById('ui-aperture')
const uiShutter = document.getElementById('ui-shutter')
const uiIso = document.getElementById('ui-iso')
const uiAf = document.getElementById('ui-af')
const uiShutterBtn = document.getElementById('ui-shutter-btn')

// Wire the inputs to the Three.js physics engine
uiFocal.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value)
  lensState.focalLength = val
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * val)))
  camera.updateProjectionMatrix()
  updateDepthOfField()
  updateHUD()
})

uiAperture.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value)
  lensState.fStop = val
  bokehPass.uniforms.aperture.value = 1 / (val * 16.66)
  updateDepthOfField()
  updateExposure()
  updateHUD()
})

uiShutter.addEventListener('change', (e) => {
  lensState.shutterSpeed = parseFloat(e.target.value)
  updateExposure()
  updateHUD()
})

uiIso.addEventListener('change', (e) => {
  lensState.iso = parseFloat(e.target.value)
  updateExposure()
  updateHUD()
})

uiAf.addEventListener('change', (e) => {
  lensState.afGrid = e.target.checked
  afGrid.style.display = lensState.afGrid ? 'block' : 'none'
})

// Bind the circular shutter button to the hi-res snapshot function
uiShutterBtn.addEventListener('click', cameraActions.takeSnapshot)

// Match the shader settings with the settings we provide
bokehPass.uniforms.focus.value = lensState.focusDistance
bokehPass.uniforms.aperture.value = 1 / (lensState.fStop * 16.66)
camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * lensState.focalLength)))
camera.updateProjectionMatrix()

// --- OPTICS ENGINE: DYNAMIC DEPTH OF FIELD --
// I figured that I'd rather mathematically control the amount of bokeh in the backend
function updateDepthOfField() {
  // Calculate the physical aperture diameter in millimeters (f / N)
  const physicalAperture = lensState.focalLength / lensState.fStop

  // Blur scales inversely with focus distance (closer focus = massive background blur)
  const blurIntensity = (physicalAperture / lensState.focusDistance) * 0.0008

  // Clamp the maximum WebGL blur radius to prevent GPU artifacting (0.0 to 0.04)
  const dynamicMaxBlur = Math.max(0.00, Math.min(blurIntensity, 0.04))

  // Feed the calculated physics into the shader
  bokehPass.uniforms.maxblur.value = dynamicMaxBlur
}

// Run it once on startup to set the baseline
updateDepthOfField()


// --- OPTICS ENGINE: EXPOSURE TRIANGLE ---
function updateExposure() {
  // The physical formula for light gathered by a sensor: (ISO/100) * ShutterSpeed / Aperture^2
  // We multiply by 196 as our base calibration constant so that 
  // f/2.8, 1/100s, at ISO 400 produces a perfectly balanced exposure of 1.0
  const lightGathered = (lensState.iso / 100) * lensState.shutterSpeed / Math.pow(lensState.fStop, 2)
  renderer.toneMappingExposure = lightGathered * 196
}

// Run it once on startup
updateExposure()




// --- Camera Lens Controls ---
// const cameraFolder = cameraGui.addFolder('Lens Optics / Depth of Field')

// // Zoom Rocker
// cameraFolder.add(lensState, 'focalLength', 12, 200).name('Focal Length (mm)').onChange((val) => {
//   // Translate mm back into Three.js FOV degrees
//   camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * val)));
//   camera.updateProjectionMatrix();
//   updateDepthOfField()
//   updateHUD()
// })

// // Focus Distance
// cameraFolder.add(lensState, 'focusDistance', 0.1, 20).name('Focus Distance (m)').onChange((val) => {
//   bokehPass.uniforms.focus.value = val;
//   updateDepthOfField()
//   updateHUD()
// }).listen()

// // Aperture (Real f-stops)
// cameraFolder.add(lensState, 'fStop', 1.2, 22).name('Aperture (f-stop)').onChange((val) => {
//   // Translates the f-stop (e.g., 2.8) back into the microscopic decimal (e.g., 0.021) for WebGL
//   bokehPass.uniforms.aperture.value = 1 / (val * 16.66);
//   updateDepthOfField()
//   updateExposure()
//   updateHUD()
// })

// // Shutter Speed (Dropdown Menu)
// const shutterSpeeds = {
//   '1/8000': 1/8000, '1/4000': 1/4000, '1/2000': 1/2000, '1/1000': 1/1000,
//   '1/500': 1/500, '1/250': 1/250, '1/125': 1/125, '1/100': 1/100, '1/60': 1/60,
//   '1/30': 1/30, '1/15': 1/15, '1/8': 1/8, '1/4': 1/4, '1/2': 1/2, '1"': 1
// }

// cameraFolder.add(lensState, 'shutterSpeed', shutterSpeeds).name('Shutter Speed').onChange(() => {
//   updateExposure()
//   updateHUD()
// })

// // ISO (Standard Stops)
// cameraFolder.add(lensState, 'iso', [100, 200, 400, 800, 1600, 3200, 6400]).name('ISO').onChange(() => {
//   updateExposure()
//   updateHUD()
// })

// cameraFolder.add(lensState, 'afGrid').name('DSLR AF Grid').onChange((val) => {
//   afGrid.style.display = val ? 'block' : 'none'
// })

// // Add a button to the GUI for taking snapshots
// cameraGui.add(cameraActions, 'takeSnapshot').name('TAKE PHOTO');


// --- Application Controls & Mobile UI ---
let isCameraMode = false

// 1. Create a floating UI Button
const modeButton = document.createElement('button')
modeButton.innerText = '📷'
modeButton.style.position = 'absolute'
modeButton.style.top = '15px'
modeButton.style.left = '15px'
modeButton.style.padding = '10px 15px'
modeButton.style.backgroundColor = 'rgba(20, 20, 20, 0.8)'
modeButton.style.color = '#ffffff'
modeButton.style.border = '1px solid #444'
modeButton.style.borderRadius = '5px'
modeButton.style.fontFamily = 'monospace'
modeButton.style.cursor = 'pointer'
modeButton.style.zIndex = '1000' // Keeps it on top of the canvas
document.body.appendChild(modeButton)


// --- CUSTOM GLASSMORPHISM STUDIO UI ---
const studioUIHTML = `
  <div id="studio-sidebar" class="studio-sidebar">
    <div class="tabs">
      <button class="tab-btn active" data-tab="tab-subject">SUBJECT</button>
      <button class="tab-btn" data-tab="tab-lighting">LIGHTING</button>
      <button class="tab-btn" data-tab="tab-stage">STAGE</button>
    </div>
    
    <!-- SUBJECT TAB -->
    <div id="tab-subject" class="tab-content active">
      <div class="upload-btn" id="ui-upload">UPLOAD .GLB / .GLTF</div>
      
      <div class="control-group">
        <h3>Transform</h3>
        <div class="control-row"><label>Scale</label><input type="range" id="ui-scale" min="0.1" max="100" value="11" step="0.1"></div>
        <div class="control-row"><label>Height</label><input type="range" id="ui-height" min="-5" max="5" value="-0.5" step="0.1"></div>
      </div>
      
      <div class="control-group">
        <h3>Turntable</h3>
        <div class="control-row"><label>Angle</label><input type="range" id="ui-spin-angle" min="0" max="360" value="0"></div>
        <div class="control-row"><label>Speed</label><input type="range" id="ui-spin-speed" min="0.1" max="5" value="0.5" step="0.1"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-auto-spin"> Motorized Spin</div>
      </div>
    </div>

    <!-- LIGHTING TAB -->
    <div id="tab-lighting" class="tab-content">
      <div class="control-group">
        <h3>Key Light</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-key-int" min="0" max="1000" value="164"></div>
        <div class="control-row"><label>Color</label><input type="color" id="ui-key-color" value="#ffffff"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-key-help" checked> Show Helper Box</div>
      </div>
      <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 5px 0;">
      <div class="control-group">
        <h3>Fill Light</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-fill-int" min="0" max="1000" value="226"></div>
        <div class="control-row"><label>Color</label><input type="color" id="ui-fill-color" value="#ffffff"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-fill-help" checked> Show Helper Box</div>
      </div>
      <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 5px 0;">
      <div class="control-group">
        <h3>Rim / Hair Light</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-rim-int" min="0" max="1000" value="350"></div>
        <div class="control-row"><label>Color</label><input type="color" id="ui-rim-color" value="#ffffff"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-rim-help" checked> Show Helper Box</div>
      </div>
    </div>

    <!-- STAGE TAB -->
    <div id="tab-stage" class="tab-content">
      <div class="control-group">
        <h3>Seamless Cyclorama</h3>
        <div class="control-row"><label>Paper Color</label><input type="color" id="ui-cyc-color" value="#8a2020"></div>
        <div class="control-row"><label>Roughness</label><input type="range" id="ui-cyc-rough" min="0" max="1" value="0.85" step="0.01"></div>
      </div>
      <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 5px 0;">
      <div class="control-group">
        <h3>Ambient Bounce</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-amb-int" min="0" max="5" value="1" step="0.1"></div>
        <div class="control-row"><label>HDRI Refl.</label><input type="range" id="ui-hdri-int" min="0" max="3" value="0.2" step="0.1"></div>
      </div>
    </div>
  </div>
`
document.body.insertAdjacentHTML('beforeend', studioUIHTML)

const studioSidebar = document.getElementById('studio-sidebar')

// --- SIDEBAR TOGGLE LOGIC ---
const toggleBtnHTML = `<div id="sidebar-toggle" class="sidebar-toggle"><img src = '/settings.svg' width = 40%></div>`
document.body.insertAdjacentHTML('beforeend', toggleBtnHTML)

const sidebarToggle = document.getElementById('sidebar-toggle')

// Start closed on mobile, open on desktop
let isSidebarOpen = window.innerWidth >= 768 
studioSidebar.style.display = isSidebarOpen ? 'block' : 'none'

sidebarToggle.addEventListener('click', () => {
  isSidebarOpen = !isSidebarOpen
  studioSidebar.style.display = isSidebarOpen ? 'block' : 'none'
})

// --- TAB LOGIC ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
    
    // Add active class to clicked tab
    e.target.classList.add('active')
    document.getElementById(e.target.dataset.tab).classList.add('active')
  })
})

// --- WIRING THE CONTROLS ---
// Subject
document.getElementById('ui-upload').addEventListener('click', () => fileInput.click())
document.getElementById('ui-scale').addEventListener('input', (e) => { if (subject) subject.scale.setScalar(e.target.value) })
document.getElementById('ui-height').addEventListener('input', (e) => { if (subject) subject.position.y = e.target.value })
document.getElementById('ui-spin-angle').addEventListener('input', (e) => { if (subject && !turntableState.autoSpin) subject.rotation.y = THREE.MathUtils.degToRad(e.target.value) })
document.getElementById('ui-auto-spin').addEventListener('change', (e) => turntableState.autoSpin = e.target.checked)
document.getElementById('ui-spin-speed').addEventListener('input', (e) => turntableState.speed = parseFloat(e.target.value))

// Lighting
document.getElementById('ui-key-int').addEventListener('input', (e) => light.intensity = e.target.value)
document.getElementById('ui-key-color').addEventListener('input', (e) => { light.color.set(e.target.value); keysoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-key-help').addEventListener('change', (e) => lightHelperToggle.showHelper = e.target.checked)

document.getElementById('ui-fill-int').addEventListener('input', (e) => fillLight.intensity = e.target.value)
document.getElementById('ui-fill-color').addEventListener('input', (e) => { fillLight.color.set(e.target.value); fillsoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-fill-help').addEventListener('change', (e) => fillLightHelperToggle.showHelper = e.target.checked)

document.getElementById('ui-rim-int').addEventListener('input', (e) => rimLight.intensity = e.target.value)
document.getElementById('ui-rim-color').addEventListener('input', (e) => { rimLight.color.set(e.target.value); rimSoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-rim-help').addEventListener('change', (e) => rimLightHelperToggle.showHelper = e.target.checked)

// Stage
document.getElementById('ui-cyc-color').addEventListener('input', (e) => cycMaterial.color.set(e.target.value))
document.getElementById('ui-cyc-rough').addEventListener('input', (e) => cycMaterial.roughness = e.target.value)
document.getElementById('ui-amb-int').addEventListener('input', (e) => ambientBounce.intensity = e.target.value)
document.getElementById('ui-hdri-int').addEventListener('input', (e) => scene.environmentIntensity = e.target.value)

// The universal toggle logic
function toggleCameraMode() {
  isCameraMode = !isCameraMode
  if (isCameraMode) {
    // gui.hide()
    glassDeck.style.display = 'flex' // Reveal the custom glass UI
    studioSidebar.style.display = 'none'
    viewfinder.style.display = 'block'
    
    modeButton.innerText = '✖'
    modeButton.style.backgroundColor = 'rgba(138, 32, 32, 0.8)'
    
    updateHUD()

    lightHelper.visible = false
    fillLightHelper.visible = false
    rimLightHelper.visible = false
    keySoftbox.visible = false
    fillSoftbox.visible = false
    rimSoftbox.visible = false
  } else {
    // gui.show()
    glassDeck.style.display = 'none' // Hide the custom glass UI
    studioSidebar.style.display = 'block'
    viewfinder.style.display = 'none'
    
    modeButton.innerText = '📷'
    modeButton.style.backgroundColor = 'rgba(20, 20, 20, 0.8)'

    lightHelper.visible = lightHelperToggle.showHelper
    fillLightHelper.visible = fillLightHelperToggle.showHelper
    rimLightHelper.visible = rimLightHelperToggle.showHelper
    keySoftbox.visible = true
    fillSoftbox.visible = true
    rimSoftbox.visible = true
  }
}

// 3. Bind it to BOTH the button click and the keyboard shortcuts
modeButton.addEventListener('click', toggleCameraMode)

window.addEventListener('keydown', (event) => {
  if ((event.key === 'c' || event.key === 'C') && !isCameraMode) {
    toggleCameraMode()
  } else if (event.key === 'Escape' && isCameraMode) {
    toggleCameraMode()
  }
})

// Folder to keep UI organized
// const lightFolder = gui.addFolder('Key Light Setup')

// // Bind sliders to light position
// lightFolder.add(light.position, 'x', -10, 10).name('Position X').onChange(() => lightHelper.update())
// lightFolder.add(light.position, 'y', 0, 10).name('Position Y').onChange(() => lightHelper.update())
// lightFolder.add(light.position, 'z', -10, 10).name('Position Z').onChange(() => lightHelper.update())

// // Bind a slider to light intensity
// lightFolder.add(light, 'intensity', 0, 1000).name('Intensity')

// // Unified Key Light Color Picker
// lightFolder.addColor(lightColors, 'key').name('Gel Color').onChange((value) => {
//   light.color.set(value);
//   keysoftboxMaterial.color.set(value);
//   lightHelper.update();
// });

// // The Photography Controls
// lightFolder.add(light, 'angle', 0.1, Math.PI / 2).name('Beam Angle').onChange(() => lightHelper.update())
// lightFolder.add(light, 'penumbra', 0, 1).name('Penumbra').onChange(() => lightHelper.update())

// // Helper toggle for main light
// const lightHelperToggle = { showHelper: true }
// lightFolder.add(lightHelperToggle, 'showHelper').name('Show Key Light Helper').onChange((value) => {
//   lightHelper.visible = value
// })


// // Folders remain open by default for easy access to controls
// lightFolder.open()


// // Controls for the fill light
// const fillLightFolder = gui.addFolder('Fill Light Setup')

// // Bind sliders to fill light position
// fillLightFolder.add(fillLight.position, 'x', -10, 10).name('Position X').onChange(() => fillLightHelper.update())
// fillLightFolder.add(fillLight.position, 'y', 0, 10).name('Position Y').onChange(() => fillLightHelper.update())
// fillLightFolder.add(fillLight.position, 'z', -10, 10).name('Position Z').onChange(() => fillLightHelper.update())

// // Bind a slider to fill light intensity
// fillLightFolder.add(fillLight, 'intensity', 0, 1000).name('Intensity')

// // Helper toggle for fill light
// const fillLightHelperToggle = { showHelper: true }
// fillLightFolder.add(fillLightHelperToggle, 'showHelper').name('Show Fill Light Helper').onChange((value) => {
//   fillLightHelper.visible = value
// })

// // The Photography Controls
// fillLightFolder.add(fillLight, 'angle', 0.1, Math.PI / 2).name('Beam Angle').onChange(() => fillLightHelper.update())
// fillLightFolder.add(fillLight, 'penumbra', 0, 1).name('Penumbra').onChange(() => fillLightHelper.update())

// // Unified Fill Light Color Picker
// fillLightFolder.addColor(lightColors, 'fill').name('Gel Color').onChange((value) => {
//   fillLight.color.set(value);
//   fillsoftboxMaterial.color.set(value);
//   fillLightHelper.update();
// });

// // Folders kept closed by default to avoid cluttering the UI
// fillLightFolder.close()



// --- Rim Light GUI ---
// const rimLightFolder = gui.addFolder('Rim / Hair Light Setup')
// rimLightFolder.add(rimLight.position, 'x', -10, 10).name('Position X').onChange(() => rimLightHelper.update())
// rimLightFolder.add(rimLight.position, 'y', 0, 15).name('Position Y').onChange(() => rimLightHelper.update())
// rimLightFolder.add(rimLight.position, 'z', -15, 10).name('Position Z').onChange(() => rimLightHelper.update())
// rimLightFolder.add(rimLight, 'intensity', 0, 1000).name('Intensity')
// rimLightFolder.add(rimLight, 'angle', 0.1, Math.PI / 2).name('Beam Angle').onChange(() => rimLightHelper.update())
// rimLightFolder.add(rimLight, 'penumbra', 0, 1).name('Penumbra').onChange(() => rimLightHelper.update())

// rimLightFolder.addColor(lightColors, 'rim').name('Gel Color').onChange((value) => {
//   rimLight.color.set(value);
//   rimSoftboxMaterial.color.set(value);
//   rimLightHelper.update();
// });

// const rimLightHelperToggle = { showHelper: true }
// rimLightFolder.add(rimLightHelperToggle, 'showHelper').name('Show Rim Light Helper').onChange((val) => rimLightHelper.visible = val)
// rimLightFolder.close()

// --- Turntable GUI ---
const turntableState = {
  rotation: 0,
  autoSpin: false,
  speed: 0.5
}

// const turntableFolder = gui.addFolder('Subject Turntable')
// // Modifying the proxy state instead of the raw subject preserves the UI when uploading new files
// turntableFolder.add(turntableState, 'rotation', 0, 360).name('Manual Angle').onChange((val) => {
//   if (subject && !turntableState.autoSpin) {
//     subject.rotation.y = THREE.MathUtils.degToRad(val)
//   }
// }).listen()
// turntableFolder.add(turntableState, 'autoSpin').name('Motorized Spin')
// turntableFolder.add(turntableState, 'speed', 0.1, 5).name('Spin Speed')
// turntableFolder.open()



// --- Cyclorama GUI Controls ---
// const cycFolder = gui.addFolder('Cyclorama Backdrop')

// Holds default cyc color
const cycState = {
  color: '#990a00'
}

// cycFolder.addColor(cycState, 'color').name('Paper Color').onChange((val) => {
//   // Updates the seamless color based on user input
//   cycMaterial.color.set(val)

//   // // By matching the background and fog, it appears to be infinite
//   // scene.background.set(val)
//   // scene.fog.color.set(val)
// })

// cycFolder.add(cycMaterial, 'roughness', 0, 1).name('Surface Roughness')
// cycFolder.add(cycMaterial, 'metalness', 0, 1).name('Surface Reflection')

// cycFolder.open()
// --- SUBJECT MATERIAL CONTROLS ---

// const materialFolder = gui.addFolder('Subject Surface')

// materialFolder.add(material, 'roughness', 0, 1).name('Roughness')
// materialFolder.add(material, 'metalness', 0, 1).name('Metalness')

// --- AMBIENT BOUNCE LIGHT ---
// THREE.HemisphereLight( skyColor, groundColor, intensity )
// Using a dim grey for the room ambient, and a slightly brighter grey bouncing up from the floor
const ambientBounce = new THREE.HemisphereLight(0x111111, 0x444444, 0.5)
scene.add(ambientBounce)

// --- AMBIENT CONTROLS ---
// const ambientFolder = gui.addFolder('Ambient / Floor Bounce');
// ambientFolder.add(ambientBounce, 'intensity', 0, 5).name('Bounce Intensity');
// ambientFolder.addColor({ sky: '#111111' }, 'sky').name('Sky Ambient').onChange((val) => ambientBounce.color.set(val));
// ambientFolder.addColor({ ground: '#444444' }, 'ground').name('Floor Bounce').onChange((val) => ambientBounce.groundColor.set(val));

// ambientFolder.add(scene, 'environmentIntensity', 0, 3).name('HDRI Reflection Strength')

// // Close the ambient folder by default to keep the UI clean
// ambientFolder.close()

// --- Window Resize Handling ---
window.addEventListener('resize', () => {
  // Update the camera's aspect ratio and projection matrix to match the new window dimensions
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  // Update the renderer size and pixel ratio to match the new window dimensions
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)

  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)

  composer.setPixelRatio(pixelRatio)
})

// --- Viewfinder Overlay ---
const viewfinder = document.createElement('div')
viewfinder.id = 'viewfinder'
viewfinder.style.position = 'absolute'
viewfinder.style.top = '50%'
viewfinder.style.left = '50%'
viewfinder.style.transform = 'translate(-50%, -50%)'

// locks the frame to a 4:5 aspect ratio, which is the standard for portrait photography
viewfinder.style.aspectRatio = '4 / 5'
viewfinder.style.height = '85vh'

// Darkens the area outside the viewfinder to help the user focus on the subject
viewfinder.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.75)'
viewfinder.style.border = '2px solid rgba(255, 255, 255, 0.5)'

// Rules of thirds grid overlay for better composition
viewfinder.style.backgroundImage = `
  linear-gradient(to right, transparent 33.3%, rgba(255,255,255,0.2) 33.3%, rgba(255,255,255,0.2) 33.5%, transparent 33.5%, transparent 66.6%, rgba(255,255,255,0.2) 66.6%, rgba(255,255,255,0.2) 66.8%, transparent 66.8%),
  linear-gradient(to bottom, transparent 33.3%, rgba(255,255,255,0.2) 33.3%, rgba(255,255,255,0.2) 33.5%, transparent 33.5%, transparent 66.6%, rgba(255,255,255,0.2) 66.6%, rgba(255,255,255,0.2) 66.8%, transparent 66.8%)
`
viewfinder.style.pointerEvents = 'none'
viewfinder.style.display = 'none' // Hide the viewfinder by default; it will be shown when entering camera mode
document.body.appendChild(viewfinder)

// --- HUD ---
const hud = document.createElement('div')
hud.style.position = 'absolute'
hud.style.top = '40px'
hud.style.left = '50%'
hud.style.transform = 'translateX(-50%)'
hud.style.color = '#00ff00' // Green for the text like a DSLR
hud.style.fontFamily = "'CustomDigitalFont', monospace";
hud.style.fontSize = '20px'
hud.style.letterSpacing = '1px'
// hud.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)'
viewfinder.appendChild(hud)

function updateHUD() {
  // Read directly from the proxy state
  const focalLength = Math.round(lensState.focalLength);
  const fStop = lensState.fStop.toFixed(1);
  const focusDist = lensState.focusDistance.toFixed(1);

  // Format the shutter speed for the display
  const ssDisplay = lensState.shutterSpeed >= 1 ? '1"' : `1/${Math.round(1 / lensState.shutterSpeed)}`

  // Inject the expanded readout into the HUD
  hud.innerHTML = `${focalLength}mm &nbsp;|&nbsp; f/${fStop} &nbsp;|&nbsp; ${ssDisplay} &nbsp;|&nbsp; ISO ${lensState.iso}`

}

// --- AUTOFOCUS HUD INTERFACE ---
// The Active Focus Box (Hollow Rectangle)
const focusBox = document.createElement('div')
focusBox.style.position = 'absolute'
focusBox.style.width = '30px'
focusBox.style.height = '30px'
focusBox.style.border = '1px solid rgba(255, 255, 255, 0.8)'
focusBox.style.transform = 'translate(-54%, -56%)' // Centers the box on the click coordinate, found these number to look more centered than -50,-50
focusBox.style.pointerEvents = 'none'
focusBox.style.opacity = '0' // Hidden until you click
focusBox.style.transition = 'border-color 0.1s, opacity 0.2s'
viewfinder.appendChild(focusBox)

// The DSLR Multi-Point Grid Container
const afGrid = document.createElement('div')
afGrid.style.position = 'absolute'
afGrid.style.width = '100%'
afGrid.style.height = '100%'
afGrid.style.pointerEvents = 'none'
afGrid.style.display = 'none' // Hidden by default, toggled via GUI
viewfinder.appendChild(afGrid)

// Generate the 15-point diamond layout
const afPointOffsets = [
  [0, 0], // Center
  [-10, 0], [-20, 0], [-30, 0], // Left side
  [10, 0], [20, 0], [30, 0],    // Right side
  [-10, -12], [0, -12], [10, -12], // Top Mid Row
  [-10, 12], [0, 12], [10, 12],    // Bottom Mid Row
  [0, -24], // Top Far
  [0, 24]   // Bottom Far
]

// Draws the static LCD dots
afPointOffsets.forEach(offset => {
  const pt = document.createElement('div')
  pt.style.position = 'absolute'
  pt.style.width = '6px'
  pt.style.height = '6px'
  pt.style.border = '1px solid rgba(20, 20, 20, 0.9)' // Dark inner border
  pt.style.outline = '1px solid rgba(255, 255, 255, 0.6)' // Bright outer border
  pt.style.left = `calc(50% + ${offset[0]}%)`
  pt.style.top = `calc(50% + ${offset[1]}%)`
  pt.style.transform = 'translate(-50%, -50%)'
  afGrid.appendChild(pt)
})


// Raycaster: Click-To-Focus in the camera module
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let mouseDownPos = new THREE.Vector2()

// Record where the mouse clicks down on
window.addEventListener('pointerdown', (e) => {
  mouseDownPos.set(e.clientX, e.clientY)
})

// Trigger focus on release of mouse
// Avoids drag from being rergistered as a click or tap
window.addEventListener('pointerup', (e) => {

  // Calculates the length of the hypotenuse betwen the distance travelled by the mouse in the X and Y plane
  // If > 5 pixels, they are orbiting, not clicking
  const distance = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y)
  if (distance > 5) return

  // You can only rack focus while looking through the viewfinder
  if (!isCameraMode) return

  const vfRect = viewfinder.getBoundingClientRect()

  // Real cameras don't focus if you click outside the physical frame
  if (e.clientX < vfRect.left || e.clientX > vfRect.right ||
    e.clientY < vfRect.top || e.clientY > vfRect.bottom) return

  let targetPixelX = e.clientX
  let targetPixelY = e.clientY

  // If the Grid is ON, mathematically snap the click to the nearest AF dot
  if (lensState.afGrid) {
    const clickPctX = ((e.clientX - (vfRect.left + vfRect.width / 2)) / vfRect.width) * 100
    const clickPctY = ((e.clientY - (vfRect.top + vfRect.height / 2)) / vfRect.height) * 100

    let nearestPoint = afPointOffsets[0]
    let minDist = Infinity

    afPointOffsets.forEach(pt => {
      const dist = Math.hypot(pt[0] - clickPctX, pt[1] - clickPctY)
      if (dist < minDist) {
        minDist = dist
        nearestPoint = pt
      }
    })

    // Convert the snapped percentage back to exact screen pixels for the Raycaster
    targetPixelX = vfRect.left + vfRect.width / 2 + (nearestPoint[0] * vfRect.width / 100)
    targetPixelY = vfRect.top + vfRect.height / 2 + (nearestPoint[1] * vfRect.height / 100)
  }

  //Move the visual HUD box to the target
  const boxX = targetPixelX - vfRect.left
  const boxY = targetPixelY - vfRect.top
  focusBox.style.left = `${boxX}px`
  focusBox.style.top = `${boxY}px`
  focusBox.style.opacity = '1'
  focusBox.style.borderColor = 'rgba(255, 255, 255, 0.8)' // Reset to white initially

  //Fire the Raycaster
  mouse.x = (targetPixelX / window.innerWidth) * 2 - 1
  mouse.y = -(targetPixelY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(mouse, camera)

  const objectsToTest = subject ? [subject, cyclorama] : [cyclorama]
  const intersects = raycaster.intersectObjects(objectsToTest, true)

  if (intersects.length > 0) {
    const hitPoint = intersects[0].point

    // --- Optical Planar Math ---
    // 1. Get the direction the camera lens is physically pointing
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)

    // 2. Draw a line from the camera to the clicked object
    const hitVector = new THREE.Vector3().subVectors(hitPoint, camera.position)

    // 3. Project that line onto the camera's forward direction to get the exact flat focal plane distance
    const focusDist = Math.abs(hitVector.dot(cameraDirection))

    // Update state
    lensState.focusDistance = focusDist
    bokehPass.uniforms.focus.value = focusDist

    // Recalculate dynamic blur based on the accurate plane distance
    updateDepthOfField()

    updateHUD()

    // AF CONFIRMATION: Flash sharp green
    setTimeout(() => { focusBox.style.borderColor = '#00ff00' }, 50)
  } else {
    // AF FAILURE: Flash red if it fired into the infinite void
    setTimeout(() => { focusBox.style.borderColor = '#ff0000' }, 50)
  }

  // Fade the box back out after 1.5 seconds like a real LCD
  clearTimeout(focusBox.timeout)
  focusBox.timeout = setTimeout(() => {
    focusBox.style.opacity = '0'
  }, 1500)
})

// Rendering the scene
function animate(time) {
  controls.update()

  if (turntableState.autoSpin && subject) {
    turntableState.rotation += turntableState.speed
    if (turntableState.rotation >= 360) turntableState.rotation = 0
    subject.rotation.y = THREE.MathUtils.degToRad(turntableState.rotation)
  }

  if (!isCameraMode) {
    lightHelper.update()
    fillLightHelper.update()


    // Snap the softbox positions to the lights
    keySoftbox.position.copy(light.position)
    keySoftbox.lookAt(light.target.position)

    fillSoftbox.position.copy(fillLight.position)
    fillSoftbox.lookAt(fillLight.target.position)

    rimSoftbox.position.copy(rimLight.position)
    rimSoftbox.lookAt(rimLight.target.position)

    renderer.render(scene, camera)
  } else {
    composer.render()
  }
}


renderer.setAnimationLoop(animate)

// if (window.innerWidth < 768) {
//   // gui.close() // Start the main menu closed on phones
//   // cameraFolder.close()
// }