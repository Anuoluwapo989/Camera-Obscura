
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass
  ,SMAAEffect,
  SMAAPreset
} from 'postprocessing'
const scene = new THREE.Scene()
scene.background = new THREE.Color('#000000')
scene.fog = new THREE.Fog('#000000', 25, 70)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const exrLoader = new EXRLoader()
let isCameraMode = false
const studioScale = {
  worldUnitsPerMeter: 1,
  floorHalfWidth: 14,
  floorBack: 6
}

exrLoader.load('/studio.exr', (environmentMap) => {
  environmentMap.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = environmentMap
  scene.environmentIntensity = 0.2
})
camera.position.set(0, 0, 5)

const lightColors = {
  key: '#ffffff',
  fill: '#ffffff',
  rim: '#ffffff'
}
const canvas = document.querySelector('#myCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, preserveDrawingBuffer: true, antialias: false })

const renderScale = () => Math.min(window.devicePixelRatio || 1, 1.75)

const getCameraExposure = () => {
  const lightGathered = (lensState.iso / 100) * lensState.shutterSpeed / Math.pow(lensState.fStop, 2)
  return lightGathered * 196
}

function resizeStage() {
  const width = window.innerWidth
  const height = window.innerHeight
  const pixelRatio = renderScale()

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  composer.setSize(width, height)
  depthOfField.bokehScale = isCameraMode
    ? Math.max(0.1, renderer.domElement.width * (0.03 / 24))
    : 0
}

renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMappingExposure = 1.0 // Base exposure, which we will dynamically control
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  console.error('CRITICAL! WebGL Context Lost. GPU disconnected ot crashed.')
  window.location.reload()
}, false)

canvas.addEventListener('webglcontextrestored', () => {
  console.log('WebGL Context Restored. Rebuilding graphics pipeline...')
  resizeStage()
}, false)
const pixelRatio = renderScale()

const composer = new EffectComposer(renderer, { multisampling: 0 })

const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)
const depthOfField = new DepthOfFieldEffect(camera, {
  focusDistance: 4.5,
  focusRange: 1,
  bokehScale: 1,
  resolutionScale: 0.5
})
const smaaEffect = new SMAAEffect({ preset: SMAAPreset.HIGH })
const effectPass = new EffectPass(camera, depthOfField, smaaEffect)
effectPass.enabled = true
depthOfField.bokehScale = 0
composer.addPass(effectPass)
resizeStage()
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.screenSpacePanning = false
controls.enablePan = false
controls.maxPolarAngle = Math.PI / 2 - 0.05
controls.minPolarAngle = 0.1
controls.minAzimuthAngle = -Math.PI / 2.5 // Left wall limit
controls.maxAzimuthAngle = Math.PI / 2.5  // Right wall limit
controls.maxDistance = 14; // Prevents zooming backwards out of the studio walls
controls.minDistance = 2;  // Prevents zooming directly through the 3D model

const transformControl = new TransformControls(camera, renderer.domElement)

transformControl.addEventListener('dragging-changed', (e) => {
  controls.enabled = !e.value
})
scene.add(transformControl.getHelper())
const lightRaycaster = new THREE.Raycaster()
const lightMouse = new THREE.Vector2()

window.addEventListener('pointerdown', (e) => {
  if (e.target !== renderer.domElement || isCameraMode) return

  if (transformControl.axis !== null) return

  const rect = renderer.domElement.getBoundingClientRect()
  lightMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  lightMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  lightRaycaster.setFromCamera(lightMouse, camera)

  const intersects = lightRaycaster.intersectObjects([keySoftbox, fillSoftbox, rimSoftbox], false)

  if (intersects.length > 0) {
    const hit = intersects[0].object
    if (hit === keySoftbox) transformControl.attach(light)
    else if (hit === fillSoftbox) transformControl.attach(fillLight)
    else if (hit === rimSoftbox) transformControl.attach(rimLight)
    else {
      transformControl.detach()
    }
  }
})
const color = 0xFFFFFF
const intensity = 230
const light = new THREE.SpotLight(color, intensity)
light.position.set(3, 4, 3)
light.angle = Math.PI / 6
light.penumbra = 0.5
light.decay = 2
light.castShadow = true;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
light.shadow.bias = -0.0001;
light.shadow.normalBias = 0.02;

scene.add(light)
const fillLight = new THREE.SpotLight(0xFFFFFF, 226)
fillLight.position.set(-3, 3, -3)
fillLight.angle = Math.PI / 4
fillLight.penumbra = 0.8
fillLight.decay = 2
scene.add(fillLight)
const lightHelper = new THREE.SpotLightHelper(light)
scene.add(lightHelper)
const fillLightHelper = new THREE.SpotLightHelper(fillLight)
fillLight.shadow.mapSize.width = 1024;
fillLight.shadow.mapSize.height = 1024;
fillLight.shadow.bias = -0.0001;
fillLight.shadow.normalBias = 0.02;

scene.add(fillLightHelper)
const ambientBounce = new THREE.HemisphereLight(0x111111, 0x444444, 0.5)
scene.add(ambientBounce)
const rimLight = new THREE.SpotLight(0xFFFFFF, 20)
rimLight.position.set(0, 5, -6)
rimLight.angle = Math.PI / 5
rimLight.penumbra = 0.5
rimLight.decay = 2
rimLight.castShadow = true
rimLight.shadow.mapSize.width = 1024;
rimLight.shadow.mapSize.height = 1024;
rimLight.shadow.bias = -0.0001;
rimLight.shadow.normalBias = 0.02;
scene.add(rimLight)

const rimLightHelper = new THREE.SpotLightHelper(rimLight)

scene.add(rimLightHelper)
const softboxGeometry = new THREE.BoxGeometry(1, 1, 0.1)
const keysoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.key })
const fillsoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.fill })
const keySoftbox = new THREE.Mesh(softboxGeometry, keysoftboxMaterial)
scene.add(keySoftbox)
const fillSoftbox = new THREE.Mesh(softboxGeometry, fillsoftboxMaterial)
scene.add(fillSoftbox)
const rimSoftboxMaterial = new THREE.MeshBasicMaterial({ color: lightColors.rim })
const rimSoftbox = new THREE.Mesh(softboxGeometry, rimSoftboxMaterial)
scene.add(rimSoftbox)
const loader = new GLTFLoader()
let subject
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.accept = '.glb, .gltf'
fileInput.style.display = 'none'
document.body.appendChild(fileInput)
function disposeCurrentSubject() {
  if (!subject) return

  scene.remove(subject)
  subject.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose()
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
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const arrayBuffer = e.target.result
    loader.parse(arrayBuffer, '', (gltf) => {
      disposeCurrentSubject()
      subject = gltf.scene
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
      subject.scale.set(11, 11, 11)
      subject.position.set(0, -0.5, 0)

      scene.add(subject)
      light.target = subject
      fillLight.target = subject
      rimLight.target = subject
    })
  }
  reader.readAsArrayBuffer(file)
  fileInput.value = ''
})

loader.load('model.glb', (gltf) => {
  subject = gltf.scene
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
  subject.scale.set(11, 11, 11)
  subject.position.set(0, -0.5, 0)

  scene.add(subject)
  light.target = subject
  fillLight.target = subject
  rimLight.target = subject

})
function createCycloramaGeometry() {
  const planeWidth = 120 // Increased from 60 to push the side walls infinitely wide
  const planeDepth = 80  // Increased from 40 to push the back wall infinitely high
  const geo = new THREE.PlaneGeometry(planeWidth, planeDepth, 128, 128)
  const pos = geo.attributes.position

  const floorHalfWidth = studioScale.floorHalfWidth
  const floorBack = studioScale.floorBack
  const radius = 6          // Smoothness of the corner fillet

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i)
    const v = pos.getY(i)
    let dx = 0
    let dy = 0

    if (u > floorHalfWidth) dx = u - floorHalfWidth
    else if (u < -floorHalfWidth) dx = u + floorHalfWidth

    if (v > floorBack) dy = v - floorBack // Only curve the back wall, not the front
    const d = Math.sqrt(dx * dx + dy * dy)
    const uFlat = u - dx
    const vFlat = v - dy

    let finalX, finalY, finalZ

    if (d === 0) {
      finalX = u
      finalY = -1
      finalZ = -v

    } else if (d <= radius) {
      const theta = (d / radius) * (Math.PI / 2)
      const travel = radius * Math.sin(theta)
      const height = radius * (1 - Math.cos(theta))

      finalX = uFlat + (dx / d) * travel
      finalY = -1 + height
      finalZ = -(vFlat + (dy / d) * travel)

    } else {
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
  color: 0x696969,
  roughness: 0.85,
  metalness: 0.05,
  side: THREE.DoubleSide
})

const cyclorama = new THREE.Mesh(cycGeometry, cycMaterial)
cyclorama.receiveShadow = true
scene.add(cyclorama)
const frameState = {
  width: 3,
  height: 2,
  label: '2:3 HORIZONTAL'
}

function getFrameAspect() {
  return frameState.width / frameState.height
}

const cameraActions = {
  takeSnapshot: () => {
    renderer.setAnimationLoop(null)

    const currentWidth = window.innerWidth
    const currentHeight = window.innerHeight
    const currentPixelRatio = renderer.getPixelRatio()
    const currentBokehScale = depthOfField.bokehScale
    const isMobile = window.innerWidth < 768
    const exportWidth = isMobile ? currentWidth * 2 : 2400
    const exportHeight = Math.round(exportWidth / getFrameAspect())
    const currentAspect = camera.aspect
    const currentProjectionMatrix = camera.projectionMatrix.clone()
    const currentProjectionMatrixInverse = camera.projectionMatrixInverse.clone()

    camera.aspect = getFrameAspect()
    camera.updateProjectionMatrix()

    renderer.setPixelRatio(1)
    renderer.setSize(exportWidth, exportHeight, false)
    composer.setSize(exportWidth, exportHeight)
    depthOfField.bokehScale = Math.max(0.1, exportWidth * (0.03 / 24))

    setTimeout(() => {
      composer.render()
      const imageURL = renderer.domElement.toDataURL('image/png', 1.0)

      const link = document.createElement('a')
      link.href = imageURL
      link.download = 'studio-render.png'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      renderer.setPixelRatio(currentPixelRatio)
      renderer.setSize(currentWidth, currentHeight)
      composer.setSize(currentWidth, currentHeight)
      camera.aspect = currentAspect
      camera.projectionMatrix.copy(currentProjectionMatrix)
      camera.projectionMatrixInverse.copy(currentProjectionMatrixInverse)
      resizeStage()
      depthOfField.bokehScale = currentBokehScale
      renderer.toneMappingExposure = isCameraMode ? getCameraExposure() : 1
      renderer.setAnimationLoop(animate)
    }, 100)
  }
}

const lensState = {
  fStop: 2.8, // Aperture
  focusDistance: 4.5,
  focalLength: 25,
  afGrid: false,
  iso: 400,          // Base ISO
  shutterSpeed: 0.01 // Base Shutter Speed (1/100th of a second)
}
let viewfinderExposure
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
        <select id="ui-frame" aria-label="Frame aspect ratio">
          <option value="3:2" selected>2:3 H</option>
          <option value="2:3">2:3 V</option>
          <option value="4:3">3:4 H</option>
          <option value="3:4">3:4 V</option>
          <option value="16:9">9:16 H</option>
          <option value="9:16">9:16 V</option>
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
const glassDeck = document.getElementById('camera-glass-ui')
const uiFocal = document.getElementById('ui-focal')
const uiAperture = document.getElementById('ui-aperture')
const uiShutter = document.getElementById('ui-shutter')
const uiIso = document.getElementById('ui-iso')
const uiFrame = document.getElementById('ui-frame')
const uiAf = document.getElementById('ui-af')
const uiShutterBtn = document.getElementById('ui-shutter-btn')
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

uiFrame.addEventListener('change', (e) => {
  const [width, height] = e.target.value.split(':').map(Number)
  frameState.width = width
  frameState.height = height
  frameState.label = e.target.options[e.target.selectedIndex].textContent
  updateViewfinderFrame()
})

uiAf.addEventListener('change', (e) => {
  lensState.afGrid = e.target.checked
  afGrid.style.display = lensState.afGrid ? 'block' : 'none'
})
uiShutterBtn.addEventListener('click', cameraActions.takeSnapshot)
camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * lensState.focalLength)))
camera.updateProjectionMatrix()
function updateDepthOfField() {
  const sensorWidthMm = 24
  const focalLengthMm = lensState.focalLength
  const focusDistanceMm = Math.max(
    focalLengthMm + 0.001,
    (lensState.focusDistance / studioScale.worldUnitsPerMeter) * 1000
  )
  const circleOfConfusionMm = 0.03
  const hyperfocalDistanceMm = (focalLengthMm * focalLengthMm) /
    (lensState.fStop * circleOfConfusionMm) + focalLengthMm
  const nearFocusMm = (hyperfocalDistanceMm * focusDistanceMm) /
    (hyperfocalDistanceMm + focusDistanceMm - focalLengthMm)
  const farFocusMm = hyperfocalDistanceMm > focusDistanceMm - focalLengthMm
    ? (hyperfocalDistanceMm * focusDistanceMm) /
    (hyperfocalDistanceMm - focusDistanceMm + focalLengthMm)
    : Infinity
  const focusRangeWorldUnits = Math.max(
    0.001,
    Math.min(1000, ((farFocusMm - nearFocusMm) / 1000) * studioScale.worldUnitsPerMeter)
  )

  depthOfField.cocMaterial.focusDistance = lensState.focusDistance
  depthOfField.cocMaterial.focusRange = focusRangeWorldUnits
}
updateDepthOfField()
function updateExposure() {
  const exposure = getCameraExposure()
  renderer.toneMappingExposure = isCameraMode ? exposure : 1

  if (viewfinderExposure) {
    const exposureStops = THREE.MathUtils.clamp(Math.log2(Math.max(exposure, 0.0001)), -6, 6)
    viewfinderExposure.style.opacity = `${Math.min(0.78, Math.abs(exposureStops) * 0.13)}`
    viewfinderExposure.style.backgroundColor = exposureStops < 0 ? '#000000' : '#ffffff'
  }
}
updateExposure()

// --- APP LAUNCH SCREEN & IN-APP BRANDING ---
const websiteHTML = `
  <div id="intro-screen" class="intro-screen">
    <nav class="agency-nav">
      <div class="brand"><span>CAMERA OBSCURA</span><small>OPTICAL PREVISUALIZATION SYSTEM</small></div>
    </nav>

    <div id="hero-overlay" class="hero-overlay">
      <button id="enter-btn" class="enter-btn">ENTER STUDIO</button>
    </div>
    
    <div class="intro-footer"><span>CAMERA OBSCURA</span><span>© 2026 Anu Abosede</span></div>
  </div>

  <div id="app-branding" class="app-branding">CAMERA OBSCURA</div>
`
document.body.insertAdjacentHTML('afterbegin', websiteHTML)

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
        <div class="toggle-row"><input type="checkbox" id="ui-key-help"> Show Helper Box</div>
      </div>
      <div class="control-group">
        <h3>Fill Light</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-fill-int" min="0" max="1000" value="226"></div>
        <div class="control-row"><label>Color</label><input type="color" id="ui-fill-color" value="#ffffff"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-fill-help"> Show Helper Box</div>
      </div>
      <div class="control-group">
        <h3>Rim / Hair Light</h3>
        <div class="control-row"><label>Intensity</label><input type="range" id="ui-rim-int" min="0" max="1000" value="100"></div>
        <div class="control-row"><label>Color</label><input type="color" id="ui-rim-color" value="#ffffff"></div>
        <div class="toggle-row"><input type="checkbox" id="ui-rim-help"> Show Helper Box</div>
      </div>
    </div>

    <!-- STAGE TAB -->
    <div id="tab-stage" class="tab-content">
      <div class="control-group">
        <h3>Seamless Cyclorama</h3>
        <div class="control-row"><label>Paper Color</label><input type="color" id="ui-cyc-color" value="#696969"></div>
        <div class="control-row"><label>Roughness</label><input type="range" id="ui-cyc-rough" min="0" max="1" value="0.85" step="0.01"></div>
      </div>
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
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))

    e.target.classList.add('active')
    document.getElementById(e.target.dataset.tab).classList.add('active')
  })
})

const turntableState = {
  rotation: 0,
  autoSpin: false,
  speed: 0.5
}
document.getElementById('ui-upload').addEventListener('click', () => fileInput.click())
document.getElementById('ui-scale').addEventListener('input', (e) => { if (subject) subject.scale.setScalar(e.target.value) })
document.getElementById('ui-height').addEventListener('input', (e) => { if (subject) subject.position.y = e.target.value })
document.getElementById('ui-spin-angle').addEventListener('input', (e) => { if (subject && !turntableState.autoSpin) subject.rotation.y = THREE.MathUtils.degToRad(e.target.value) })
document.getElementById('ui-auto-spin').addEventListener('change', (e) => turntableState.autoSpin = e.target.checked)
document.getElementById('ui-spin-speed').addEventListener('input', (e) => turntableState.speed = parseFloat(e.target.value))

const lightHelperToggle = { showHelper: false }
const fillLightHelperToggle = { showHelper: false }
const rimLightHelperToggle = { showHelper: false }

function syncHelperVisibility() {
  lightHelper.visible = !isCameraMode && lightHelperToggle.showHelper
  fillLightHelper.visible = !isCameraMode && fillLightHelperToggle.showHelper
  rimLightHelper.visible = !isCameraMode && rimLightHelperToggle.showHelper
}

syncHelperVisibility()

document.getElementById('ui-key-int').addEventListener('input', (e) => light.intensity = e.target.value)
document.getElementById('ui-key-color').addEventListener('input', (e) => { light.color.set(e.target.value); keysoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-key-help').addEventListener('change', (e) => {
  lightHelperToggle.showHelper = e.target.checked
  syncHelperVisibility()
})

document.getElementById('ui-fill-int').addEventListener('input', (e) => fillLight.intensity = e.target.value)
document.getElementById('ui-fill-color').addEventListener('input', (e) => { fillLight.color.set(e.target.value); fillsoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-fill-help').addEventListener('change', (e) => {
  fillLightHelperToggle.showHelper = e.target.checked
  syncHelperVisibility()
})

document.getElementById('ui-rim-int').addEventListener('input', (e) => rimLight.intensity = e.target.value)
document.getElementById('ui-rim-color').addEventListener('input', (e) => { rimLight.color.set(e.target.value); rimSoftboxMaterial.color.set(e.target.value) })
document.getElementById('ui-rim-help').addEventListener('change', (e) => {
  rimLightHelperToggle.showHelper = e.target.checked
  syncHelperVisibility()
})

document.getElementById('ui-cyc-color').addEventListener('input', (e) => cycMaterial.color.set(e.target.value))
document.getElementById('ui-cyc-rough').addEventListener('input', (e) => cycMaterial.roughness = e.target.value)
document.getElementById('ui-amb-int').addEventListener('input', (e) => ambientBounce.intensity = e.target.value)
document.getElementById('ui-hdri-int').addEventListener('input', (e) => scene.environmentIntensity = e.target.value)
const uiTogglesHTML = `
<div id="toggles-container">
  <div id="camera-toggle" class="glass-btn">
    <img src="/camera.svg" alt="Camera" width="22" height="22">
  </div>
  <div id="sidebar-toggle" class="glass-btn">
     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
  </div>
</div>
`

const cameraIconSvg = `
  <img src="/camera.svg" alt="Camera" width="22" height="22">
`

const closeIconSvg = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" style="opacity: 0.9;">
    <path d="M6 6l12 12M18 6L6 18"></path>
  </svg>
`
document.body.insertAdjacentHTML('beforeend', uiTogglesHTML)

const introScreen = document.getElementById('intro-screen')
const enterBtn = document.getElementById('enter-btn')
const appBranding = document.getElementById('app-branding')
const heroOverlay = document.getElementById('hero-overlay')
const cameraToggle = document.getElementById('camera-toggle')
const sidebarToggle = document.getElementById('sidebar-toggle')
sidebarToggle.innerHTML = '<img src="/settings.svg" alt="Settings" width="22" height="22">'

// 1. Start with the app UI completely hidden
let isSidebarOpen = false
studioSidebar.style.display = 'none'
sidebarToggle.style.opacity = '0'
cameraToggle.style.opacity = '0'

// 2. The Launch Animation
enterBtn.addEventListener('click', () => {
  // Slide the massive text away
  heroOverlay.classList.add('hidden')
  introScreen.classList.add('hidden')

  // Fade the toolset in
  setTimeout(() => {
    sidebarToggle.style.transition = 'opacity 1s ease'
    cameraToggle.style.transition = 'opacity 1s ease'
    sidebarToggle.style.opacity = '1'
    cameraToggle.style.opacity = '1'
    appBranding.style.opacity = '1'

    // Automatically pop open the sidebar on desktop
    if (window.innerWidth >= 768) {
      isSidebarOpen = true
      studioSidebar.style.display = 'block'
      // Add a quick fade-in animation to the sidebar
      studioSidebar.style.animation = 'fadeIn 0.5s ease forwards'
    }
  }, 400)
})

sidebarToggle.addEventListener('click', () => {
  isSidebarOpen = !isSidebarOpen
  studioSidebar.style.display = isSidebarOpen ? 'block' : 'none'
})

function toggleCameraMode() {
  isCameraMode = !isCameraMode
  updateExposure()
  depthOfField.bokehScale = isCameraMode
    ? Math.max(0.1, renderer.domElement.width * (0.03 / 24))
    : 0
  if (isCameraMode) {
    glassDeck.style.display = 'flex'
    studioSidebar.style.display = 'none'
    sidebarToggle.style.display = 'none'
    viewfinder.style.display = 'block'

    cameraToggle.innerHTML = closeIconSvg
    cameraToggle.classList.add('active')

    transformControl.detach()
    transformControl.enabled = false

    updateHUD()

    lightHelper.visible = false
    fillLightHelper.visible = false
    rimLightHelper.visible = false
    keySoftbox.visible = false
    fillSoftbox.visible = false
    rimSoftbox.visible = false
  } else {
    glassDeck.style.display = 'none'
    sidebarToggle.style.display = 'flex'
    studioSidebar.style.display = isSidebarOpen ? 'block' : 'none'
    viewfinder.style.display = 'none'

    cameraToggle.innerHTML = cameraIconSvg
    cameraToggle.classList.remove('active')

    transformControl.enabled = true

    syncHelperVisibility()
    keySoftbox.visible = true
    fillSoftbox.visible = true
    rimSoftbox.visible = true
  }
}

cameraToggle.addEventListener('click', toggleCameraMode)

window.addEventListener('keydown', (event) => {
  if ((event.key === 'c' || event.key === 'C') && !isCameraMode) {
    toggleCameraMode()
  } else if (event.key === 'Escape' && isCameraMode) {
    toggleCameraMode()
  }
})
window.addEventListener('resize', () => {
  resizeStage()
  updateViewfinderFrame()
})
const viewfinder = document.createElement('div')
viewfinder.id = 'viewfinder'
viewfinder.style.position = 'absolute'
viewfinder.style.top = '50%'
viewfinder.style.left = '50%'
viewfinder.style.transform = 'translate(-50%, -50%)'
function updateViewfinderFrame() {
  const aspect = getFrameAspect()
  const maxWidth = window.innerWidth * 0.9
  const maxHeight = window.innerHeight * 0.85
  const width = Math.min(maxWidth, maxHeight * aspect)
  const height = width / aspect

  viewfinder.style.width = `${width}px`
  viewfinder.style.height = `${height}px`
  viewfinder.style.aspectRatio = `${frameState.width} / ${frameState.height}`
}

updateViewfinderFrame()
viewfinder.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.75)'
viewfinder.style.border = '2px solid rgba(255, 255, 255, 0.5)'
viewfinder.style.backgroundImage = `
  linear-gradient(to right, transparent 33.3%, rgba(255,255,255,0.2) 33.3%, rgba(255,255,255,0.2) 33.5%, transparent 33.5%, transparent 66.6%, rgba(255,255,255,0.2) 66.6%, rgba(255,255,255,0.2) 66.8%, transparent 66.8%),
  linear-gradient(to bottom, transparent 33.3%, rgba(255,255,255,0.2) 33.3%, rgba(255,255,255,0.2) 33.5%, transparent 33.5%, transparent 66.6%, rgba(255,255,255,0.2) 66.6%, rgba(255,255,255,0.2) 66.8%, transparent 66.8%)
`
viewfinder.style.pointerEvents = 'none'
viewfinder.style.display = 'none'
document.body.appendChild(viewfinder)
viewfinderExposure = document.createElement('div')
viewfinderExposure.className = 'viewfinder-exposure'
viewfinder.insertBefore(viewfinderExposure, viewfinder.firstChild)
const hud = document.createElement('div')
hud.className = 'viewfinder-hud'
viewfinder.appendChild(hud)

function updateHUD() {
  const focalLength = Math.round(lensState.focalLength);
  const fStop = lensState.fStop.toFixed(1);
  const ssDisplay = lensState.shutterSpeed >= 1 ? '1"' : `1/${Math.round(1 / lensState.shutterSpeed)}`
  const exposureStops = THREE.MathUtils.clamp(
    Math.log2(Math.max(getCameraExposure(), 0.0001)),
    -4,
    4
  )
  const meterPosition = THREE.MathUtils.clamp(((exposureStops + 2) / 4) * 100, 0, 100)
  const meterBars = Array.from({ length: 10 }, () => '<i></i>').join('')

  hud.innerHTML = `
    <span class="hud-group hud-camera">
      <span class="hud-value">${focalLength}</span>
      <span class="hud-unit">mm</span>
      <span class="hud-value">${fStop}</span>
    </span>
    <span class="hud-meter" aria-label="Exposure compensation">
      <span class="hud-meter-label">-2</span>
      <span class="hud-meter-track" style="--exposure-position: ${meterPosition}%">
        <span class="hud-meter-pointer"></span>
        <span class="hud-meter-bars">${meterBars}</span>
        
      </span>
      <span class="hud-meter-label">+2</span>
    </span>
    <span class="hud-group hud-exposure">
      <span class="hud-unit">${ssDisplay}</span>
      <span class="hud-label">ISO</span>
      <span class="hud-value">${lensState.iso}</span>
    </span>
  `
}

const focusBox = document.createElement('div')
focusBox.style.position = 'fixed'
focusBox.style.width = '30px'
focusBox.style.height = '30px'
focusBox.style.border = '1px solid rgba(255, 255, 255, 0.8)'
focusBox.style.boxSizing = 'border-box'
focusBox.style.transform = 'translate(-50%, -50%)'
focusBox.style.pointerEvents = 'none'
focusBox.style.opacity = '0'
focusBox.style.transition = 'border-color 0.1s, opacity 0.2s'
focusBox.style.zIndex = '1999'
document.body.appendChild(focusBox)

const afGrid = document.createElement('div')
afGrid.style.position = 'absolute'
afGrid.style.width = '100%'
afGrid.style.height = '100%'
afGrid.style.pointerEvents = 'none'
afGrid.style.display = 'none'
viewfinder.appendChild(afGrid)

const afPointOffsets = [
  [0, 0], [-0.1, 0], [-0.2, 0], [-0.3, 0], [0.1, 0], [0.2, 0], [0.3, 0],
  [-0.1, -0.12], [0, -0.12], [0.1, -0.12], [-0.1, 0.12], [0, 0.12], [0.1, 0.12],
  [0, -0.24], [0, 0.24]
]

function getFramePoint(frameRect, point) {
  return {
    x: frameRect.left + frameRect.width * (0.5 + point[0]),
    y: frameRect.top + frameRect.height * (0.5 + point[1])
  }
}

afPointOffsets.forEach(offset => {
  const pt = document.createElement('div')
  pt.style.position = 'absolute'
  pt.style.width = '6px'
  pt.style.height = '6px'
  pt.style.border = '1px solid rgba(20, 20, 20, 0.9)'
  pt.style.outline = '1px solid rgba(255, 255, 255, 0.6)'
  pt.style.left = `${(0.5 + offset[0]) * 100}%`
  pt.style.top = `${(0.5 + offset[1]) * 100}%`
  pt.style.transform = 'translate(-50%, -50%)'
  afGrid.appendChild(pt)
})
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let mouseDownPos = new THREE.Vector2()

window.addEventListener('pointerdown', (e) => {
  mouseDownPos.set(e.clientX, e.clientY)
})

window.addEventListener('pointerup', (e) => {
  if (e.target instanceof Element && e.target.closest('.camera-glass-deck, .glass-btn, input, select, button')) return

  const distance = Math.hypot(e.clientX - mouseDownPos.x, e.clientY - mouseDownPos.y)
  if (distance > 5) return
  if (!isCameraMode) return

  const vfRect = viewfinder.getBoundingClientRect()

  if (e.clientX < vfRect.left || e.clientX > vfRect.right ||
    e.clientY < vfRect.top || e.clientY > vfRect.bottom) return

  let targetPixelX = e.clientX
  let targetPixelY = e.clientY

  if (lensState.afGrid) {
    const clickOffsetX = (e.clientX - (vfRect.left + vfRect.width / 2)) / vfRect.width
    const clickOffsetY = (e.clientY - (vfRect.top + vfRect.height / 2)) / vfRect.height

    let nearestPoint = afPointOffsets[0]
    let minDist = Infinity

    afPointOffsets.forEach(pt => {
      const dist = Math.hypot(pt[0] - clickOffsetX, pt[1] - clickOffsetY)
      if (dist < minDist) {
        minDist = dist
        nearestPoint = pt
      }
    })

    const framePoint = getFramePoint(vfRect, nearestPoint)
    targetPixelX = framePoint.x
    targetPixelY = framePoint.y
  }

  focusBox.style.left = `${targetPixelX}px`
  focusBox.style.top = `${targetPixelY}px`
  focusBox.style.opacity = '1'
  focusBox.style.borderColor = 'rgba(255, 255, 255, 0.8)'

  if (vfRect.width === 0 || vfRect.height === 0) return

  mouse.x = ((targetPixelX - vfRect.left) / vfRect.width) * 2 - 1
  mouse.y = -((targetPixelY - vfRect.top) / vfRect.height) * 2 + 1
  camera.updateMatrixWorld(true)
  scene.updateMatrixWorld(true)
  raycaster.setFromCamera(mouse, camera)

  const objectsToTest = subject ? [subject, cyclorama] : [cyclorama]
  const intersects = raycaster.intersectObjects(objectsToTest, true)

  if (intersects.length > 0) {
    const hitPoint = intersects[0].point
    const hitPointInCameraSpace = hitPoint.clone().applyMatrix4(camera.matrixWorldInverse)
    const focusDist = Math.max(0.1, -hitPointInCameraSpace.z)

    lensState.focusDistance = focusDist
    depthOfField.cocMaterial.focusDistance = focusDist

    updateDepthOfField()
    updateHUD()

    setTimeout(() => { focusBox.style.borderColor = '#00ff00' }, 50)
  } else {
    setTimeout(() => { focusBox.style.borderColor = '#ff0000' }, 50)
  }

  clearTimeout(focusBox.timeout)
  focusBox.timeout = setTimeout(() => {
    focusBox.style.opacity = '0'
  }, 1500)
})
function animate(time) {
  controls.update()
  renderer.toneMappingExposure = isCameraMode ? getCameraExposure() : 1

  if (turntableState.autoSpin && subject) {
    turntableState.rotation += turntableState.speed
    if (turntableState.rotation >= 360) turntableState.rotation = 0
    subject.rotation.y = THREE.MathUtils.degToRad(turntableState.rotation)
  }

  if (!isCameraMode) {
    lightHelper.update()
    fillLightHelper.update()
    rimLightHelper.update()

    keySoftbox.position.copy(light.position)
    keySoftbox.lookAt(light.target.position)

    fillSoftbox.position.copy(fillLight.position)
    fillSoftbox.lookAt(fillLight.target.position)

    rimSoftbox.position.copy(rimLight.position)
    rimSoftbox.lookAt(rimLight.target.position)

  }

  composer.render()
}

renderer.setAnimationLoop(animate)