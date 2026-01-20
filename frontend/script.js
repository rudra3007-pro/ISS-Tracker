const map = L.map("map").setView([20,0],2)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
.addTo(map)

const issIcon = L.icon({
  iconUrl:"https://upload.wikimedia.org/wikipedia/commons/d/d0/International_Space_Station.svg",
  iconSize:[46,30]
})

let isFirstFix = true
let followISS = true
let backendOnline = true

const issMarker = L.marker([0,0],{icon:issIcon}).addTo(map)
const track = L.polyline([], {color:"#38bdf8"}).addTo(map)

let satrec = null

/* ================= LOAD TLE ================= */

async function loadTLE(){
  try{
    const res = await fetch("http://localhost:3000/tle")
    const tle = await res.json()
    satrec = satellite.twoline2satrec(tle.line1, tle.line2)
  }catch(e){
    console.warn("Backend offline: TLE not loaded")
    backendOnline = false
  }
}

loadTLE()

const latEl = document.getElementById("lat")
const lonEl = document.getElementById("lon")
const altEl = document.getElementById("alt")
const velEl = document.getElementById("vel")

/* ================= SIMULATION TIME (ADDED) ================= */

let simTime = new Date()
const TIME_STEP_MS = 1000


/* ================= UPDATE ISS ================= */

function updateISS(){

  if(!satrec) return

  simTime = new Date(simTime.getTime() + TIME_STEP_MS)
  const pv = satellite.propagate(satrec, simTime)

  if(!pv.position || !pv.velocity) return

  const gmst = satellite.gstime(simTime)
  const geo = satellite.eciToGeodetic(pv.position, gmst)

  const lat = satellite.degreesLat(geo.latitude)
  const lon = satellite.degreesLong(geo.longitude)
  const alt = geo.height
  const vel = Math.sqrt(
    pv.velocity.x**2 +
    pv.velocity.y**2 +
    pv.velocity.z**2
  )
    console.log(alt, vel)


  issMarker.setLatLng([lat,lon])
  track.addLatLng([lat,lon])

  const pts = track.getLatLngs()
  if(pts.length > 1){
    const prev = pts[pts.length-2]
    if(Math.abs(prev.lng - lon) > 180){
      track.setLatLngs([])
    }
  }

  if(isFirstFix){
    map.setView([lat, lon], 4)
    isFirstFix = false
  }

  if(followISS){
    map.panTo([lat, lon], {
  animate: true,
  duration: 0.3,
  easeLinearity: 0.25
})


  }

  if(track.getLatLngs().length > 200)
    track.setLatLngs([])

  latEl.textContent = lat.toFixed(2)
  lonEl.textContent = lon.toFixed(2)
  altEl.textContent = alt.toFixed(2)
  velEl.textContent = vel.toFixed(5)

  if(backendOnline){
    try{
      fetch("http://localhost:3000/telemetry",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          time:simTime.toISOString(),
          lat, lon, alt, vel
        })
      })
    }catch(e){
      backendOnline = false
    }
  }
}

setInterval(updateISS,250)



/* ================= CHARTS ================= */

const altChart = new Chart(
  document.getElementById("altitudeChart"),
  {
    type:"line",
    data:{ labels:[], datasets:[{
      label:"Altitude (km)",
      data:[],
      borderColor:"#38bdf8",
      tension:0.3,
      pointRadius:0
    }]},
    options:{ animation:false }
  }
)

const velChart = new Chart(
  document.getElementById("velocityChart"),
  {
    type:"line",
    data:{ labels:[], datasets:[{
      label:"Velocity (km/s)",
      data:[],
      borderColor:"#f59e0b",
      tension:0.3,
      pointRadius:0
    }]},
    options:{ animation:false }
  }
)

/* ================= LOAD TELEMETRY ================= */

async function loadTelemetry(){
  if(!backendOnline) return

  try{
    const res = await fetch("http://localhost:3000/telemetry")
    const data = await res.json()

    const labels = data.map(d=>d.time.slice(11,19))

    altChart.data.labels = labels
    altChart.data.datasets[0].data = data.map(d=>d.alt)
    altChart.update()

    velChart.data.labels = labels
    velChart.data.datasets[0].data = data.map(d=>d.vel)
    velChart.update()
  }catch(e){
    backendOnline = false
  }
}

setInterval(loadTelemetry,1000)
