// 3D Bangkok branch map (three.js). Each branch is a giant coffee cup standing at its real
// lat/lng; cup height = that branch's sales. Drag to orbit, hover for numbers, click to filter.
//
// This file is only ever loaded with import() once the panel scrolls into view, so three.js
// (~150 KB gzipped) doesn't slow down the first page load.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// Degrees → scene units. Siam, Silom and the university are only ~1.5 km apart, so the map is
// stretched (280 units per degree, ~30 units across) to give their cups room to stand apart.
const SCALE = 280
const MAX_CUP = 8 // tallest cup height
const GROW_MS = 1600

// Chao Phraya, roughly (north → south, around the Bang Kachao bend). Decorative, not survey-grade.
const RIVER = [
  [13.83, 100.51], [13.8, 100.508], [13.785, 100.505], [13.77, 100.5], [13.755, 100.492], [13.745, 100.494],
  [13.735, 100.503], [13.722, 100.512], [13.708, 100.513], [13.697, 100.523], [13.69, 100.54], [13.697, 100.556],
  [13.709, 100.567], [13.702, 100.585], [13.682, 100.591], [13.664, 100.58], [13.648, 100.566], [13.62, 100.57],
]

// Seeded random, so the little background city looks the same on every visit.
function mulberry(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function labelTexture({ name, value, ink, surface, accent, font }) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 176
  const g = c.getContext('2d')
  g.fillStyle = surface
  g.globalAlpha = 0.92
  g.beginPath()
  g.roundRect(8, 8, 496, 160, 40)
  g.fill()
  g.globalAlpha = 1
  g.lineWidth = 6
  g.strokeStyle = accent
  g.stroke()
  g.textAlign = 'center'
  g.fillStyle = ink
  g.font = `600 64px ${font}`
  g.fillText(name, 256, 82)
  g.fillStyle = accent
  g.font = `500 48px ${font}`
  g.fillText(value, 256, 144)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/**
 * Builds the scene inside `container`.
 * branches: [{ branch, sales, share, lat, lng }]
 * Returns { update({ colors, selected }), grow(), dispose() }.
 */
export function createBranchMap(container, { branches, colors, formatValue, onHover, onSelect, reduced }) {
  const font = getComputedStyle(document.body).fontFamily
  const width = () => container.clientWidth
  const height = () => container.clientHeight

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width(), height())
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  container.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(colors.surface, 70, 130)
  const camera = new THREE.PerspectiveCamera(38, width() / height(), 0.1, 200)
  camera.position.set(20, 40, 26)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.enableZoom = false // the mouse wheel keeps scrolling the page instead of zooming
  controls.maxPolarAngle = 1.32
  controls.minPolarAngle = 0.3
  controls.autoRotate = !reduced
  controls.autoRotateSpeed = 0.55
  // Let vertical swipes on a phone still scroll the page; horizontal drags orbit.
  renderer.domElement.style.touchAction = 'pan-y'

  // ─── Lights ───
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a6a50, 1.6)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2)
  sun.position.set(-20, 40, 18)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 120 })
  scene.add(sun)

  // ─── Projection: lat/lng → x/z, centered on the branches ───
  const midLat = branches.reduce((s, b) => s + b.lat, 0) / branches.length
  const cos = Math.cos((midLat * Math.PI) / 180)
  const raw = (lat, lng) => ({ x: lng * cos * SCALE, z: -lat * SCALE })
  const xs = branches.map((b) => raw(b.lat, b.lng))
  const cx = (Math.min(...xs.map((p) => p.x)) + Math.max(...xs.map((p) => p.x))) / 2
  const cz = (Math.min(...xs.map((p) => p.z)) + Math.max(...xs.map((p) => p.z))) / 2
  const project = (lat, lng) => {
    const p = raw(lat, lng)
    return new THREE.Vector3(p.x - cx, 0, p.z - cz)
  }

  // ─── Ground, grid, river ───
  const groundMat = new THREE.MeshStandardMaterial({ color: colors.surface2, roughness: 1 })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // GridHelper bakes its colors in, so a theme change swaps in a new one.
  const makeGrid = (c) => {
    const g = new THREE.GridHelper(160, 64, c.line, c.grid)
    g.position.y = 0.01
    g.material.transparent = true
    g.material.opacity = 0.5
    scene.add(g)
    return g
  }
  let grid = makeGrid(colors)

  const riverCurve = new THREE.CatmullRomCurve3(RIVER.map(([lat, lng]) => project(lat, lng)))
  const riverMat = new THREE.MeshStandardMaterial({ color: 0x4f9ad8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.85 })
  const river = new THREE.Mesh(new THREE.TubeGeometry(riverCurve, 300, 1.05, 8), riverMat)
  river.scale.y = 0.04
  river.position.y = 0.02
  scene.add(river)

  // ─── A tiny background city (one InstancedMesh = one draw call for all ~180 blocks) ───
  const rand = mulberry(42)
  const branchPoints = branches.map((b) => project(b.lat, b.lng))
  const fitRadius = Math.max(...branchPoints.map((p) => p.length())) + 4 // + room for cups and labels
  const riverPoints = riverCurve.getPoints(200)
  const cityMat = new THREE.MeshStandardMaterial({ color: colors.line, roughness: 0.9 })
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), cityMat, 260)
  city.castShadow = true
  city.receiveShadow = true
  const m = new THREE.Matrix4()
  let placed = 0
  for (let tries = 0; placed < 260 && tries < 5000; tries++) {
    const p = new THREE.Vector3((rand() - 0.5) * 76, 0, (rand() - 0.5) * 76)
    if (p.length() > 36) continue
    if (branchPoints.some((b) => b.distanceTo(p) < 2.6)) continue
    if (riverPoints.some((r) => Math.hypot(r.x - p.x, r.z - p.z) < 1.9)) continue
    const h = 0.3 + rand() * rand() * 2.8
    const w = 0.5 + rand() * 0.9
    m.compose(new THREE.Vector3(p.x, h / 2, p.z), new THREE.Quaternion(), new THREE.Vector3(w, h, 0.5 + rand() * 0.9))
    city.setMatrixAt(placed++, m)
  }
  city.count = placed
  scene.add(city)

  // ─── Branch cups ───
  const max = Math.max(...branches.map((b) => b.sales))
  const cupGeo = new THREE.CylinderGeometry(0.95, 0.72, 1, 40, 1, true)
  const baseGeo = new THREE.CircleGeometry(0.72, 40)
  const foamGeo = new THREE.CylinderGeometry(0.92, 0.92, 0.1, 40)
  const handleGeo = new THREE.TorusGeometry(0.42, 0.11, 12, 24, Math.PI * 1.2)
  const steamGeo = new THREE.SphereGeometry(0.2, 12, 12)
  const ringGeo = new THREE.RingGeometry(1.3, 1.5, 48)

  const cups = branches.map((b, i) => {
    const h = 1 + (MAX_CUP - 1) * (b.sales / max)
    const color = colors.categorical[i % colors.categorical.length]
    const group = new THREE.Group()
    group.position.copy(project(b.lat, b.lng))

    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide, transparent: true })
    const body = new THREE.Mesh(cupGeo, mat)
    body.scale.y = h
    body.position.y = h / 2
    body.castShadow = true
    body.userData.branch = b.branch
    group.add(body)

    const base = new THREE.Mesh(baseGeo, mat)
    base.rotation.x = -Math.PI / 2
    base.position.y = 0.02
    group.add(base)

    const foamMat = new THREE.MeshStandardMaterial({ color: 0xf3e3c8, roughness: 0.8, transparent: true })
    const foam = new THREE.Mesh(foamGeo, foamMat)
    foam.position.y = h - 0.1
    group.add(foam)

    const handle = new THREE.Mesh(handleGeo, mat)
    handle.position.set(0.92, h * 0.55, 0)
    handle.rotation.z = -Math.PI * 0.6
    handle.castShadow = true
    group.add(handle)

    // Steam puffs, each on its own phase so they rise one after another.
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })
    const steam = Array.from({ length: 5 }, (_, k) => {
      const puff = new THREE.Mesh(steamGeo, steamMat.clone())
      puff.userData.phase = k / 5
      group.add(puff)
      return puff
    })

    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.04
    group.add(ring)

    const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }))
    label.scale.set(5.6, 1.93, 1)
    label.position.y = h + 2
    label.renderOrder = 10
    group.add(label)

    scene.add(group)
    return { b, h, group, body, mat, foamMat, steam, ring, ringMat, label, index: i }
  })

  const drawLabels = (c) => {
    for (const cup of cups) {
      cup.label.material.map?.dispose()
      cup.label.material.map = labelTexture({ name: cup.b.branch, value: formatValue(cup.b.sales), ink: c.ink, surface: c.surface, accent: c.accent, font })
      cup.label.material.needsUpdate = true
    }
  }
  drawLabels(colors)

  // ─── Interaction: hover → tooltip, click (not drag) → select ───
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let hovered = null
  let downAt = null
  let selected = null

  const pick = (e) => {
    const r = renderer.domElement.getBoundingClientRect()
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(cups.map((c) => c.body))[0]
    return { cup: hit ? cups.find((c) => c.body === hit.object) : null, x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const onMove = (e) => {
    const { cup, x, y } = pick(e)
    hovered = cup
    renderer.domElement.style.cursor = cup ? 'pointer' : ''
    onHover(cup ? { ...cup.b, x, y } : null)
  }
  const onLeave = () => {
    hovered = null
    onHover(null)
  }
  const onDown = (e) => (downAt = { x: e.clientX, y: e.clientY })
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return
    const { cup } = pick(e)
    if (cup) onSelect(cup.b.branch)
  }
  const el = renderer.domElement
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)

  // Stop auto-rotating while the user is dragging; resume a few seconds after.
  let resume = 0
  controls.addEventListener('start', () => {
    controls.autoRotate = false
    clearTimeout(resume)
  })
  controls.addEventListener('end', () => {
    clearTimeout(resume)
    if (!reduced) resume = setTimeout(() => (controls.autoRotate = true), 3500)
  })

  // ─── Animation loop ───
  let growStart = null
  let frame = 0
  let visible = true
  const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)

  const tick = () => {
    frame = requestAnimationFrame(tick)
    if (!visible) return
    const now = performance.now()
    const t = now / 1000
    controls.update()

    for (const cup of cups) {
      // Grow: cups rise one after another, with a little overshoot.
      const local = growStart === null ? 0 : Math.min(1, Math.max(0, (now - growStart - cup.index * 140) / GROW_MS))
      const g = reduced ? (growStart === null ? 0 : 1) : Math.max(0.001, easeOutBack(local))
      cup.group.scale.set(1, Math.max(0.001, g), 1)
      cup.label.material.opacity = Math.min(1, local * 2)

      const dim = selected && selected !== cup.b.branch
      cup.mat.opacity = dim ? 0.25 : 1
      cup.foamMat.opacity = dim ? 0.25 : 1
      cup.mat.emissive.set(hovered === cup ? 0x332211 : 0x000000)

      // Steam: rise, drift, fade, loop. Counter-scale so puffs stay round while the cup grows.
      for (const puff of cup.steam) {
        const p = (t * 0.35 + puff.userData.phase) % 1
        puff.position.set(Math.sin((p + puff.userData.phase) * 9) * 0.25, cup.h + 0.2 + p * 2.2 / Math.max(g, 0.2), 0)
        puff.scale.set(0.6 + p, (0.6 + p) / Math.max(g, 0.2), 0.6 + p)
        puff.material.opacity = (dim ? 0.15 : 0.55) * Math.sin(p * Math.PI) * Math.min(1, local * 2)
      }

      // Selected branch: a ring pulses out on the ground.
      if (selected === cup.b.branch) {
        const p = (t * 0.8) % 1
        cup.ring.scale.setScalar(1 + p * 1.8)
        cup.ringMat.opacity = 0.8 * (1 - p)
      } else cup.ringMat.opacity = 0
    }
    renderer.render(scene, camera)
  }
  tick()

  // Pause rendering while the panel is scrolled off screen.
  const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
  io.observe(container)
  const ro = new ResizeObserver(() => {
    if (width() === 0 || height() === 0) return
    renderer.setSize(width(), height())
    camera.aspect = width() / height()
    // Back the camera off just far enough that a circle around every branch fits the
    // narrower of the two view angles (vertical on a wide screen, horizontal on a phone).
    const half = Math.min(camera.fov / 2, (Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) * 180) / Math.PI)
    // × 0.88: the sphere fit is conservative, and the tilted view makes the map look smaller than it is.
    camera.position.setLength((fitRadius / Math.sin((half * Math.PI) / 180)) * 0.88)
    camera.updateProjectionMatrix()
  })
  ro.observe(container)

  return {
    grow() {
      if (growStart === null) growStart = performance.now()
    },
    // Either field may be left out: a branch click doesn't need to redraw the labels.
    update({ colors: c, selected: s }) {
      if (s !== undefined) selected = s
      if (!c) return
      scene.fog.color.set(c.surface)
      groundMat.color.set(c.surface2)
      cityMat.color.set(c.line)
      cups.forEach((cup) => {
        const color = c.categorical[cup.index % c.categorical.length]
        cup.mat.color.set(color)
        cup.ringMat.color.set(color)
      })
      scene.remove(grid)
      grid.dispose()
      grid = makeGrid(c)
      drawLabels(c)
    },
    dispose() {
      cancelAnimationFrame(frame)
      clearTimeout(resume)
      io.disconnect()
      ro.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse((o) => {
        o.geometry?.dispose()
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        mats.forEach((mat) => {
          mat.map?.dispose()
          mat.dispose()
        })
      })
      renderer.dispose()
      el.remove()
    },
  }
}
