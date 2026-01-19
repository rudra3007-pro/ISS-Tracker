const map = L.map("map").setView([20,0],2)

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
.addTo(map)

const issIcon = L.icon({
  iconUrl:"https://upload.wikimedia.org/wikipedia/commons/d/d0/International_Space_Station.svg",
  iconSize:[46,30]
})

let isFirstFix = true
let followISS = true

const issMarker = L.marker([0,0],{
  icon:issIcon
})
.addTo(map)
.bindTooltip("🛰 ISS",{
  permanent:true,
  direction:"right",
  offset:[12,0],
  className:"iss-label"
})

const track = L.polyline([], {
  color:"#000000",
  weight:3,
  opacity:0.85,
  smoothFactor:1
}).addTo(map)


let satrec

async function loadTLE(){
  const res = await fetch("http://localhost:3000/tle")
  const tle = await res.json()
  satrec = satellite.twoline2satrec(tle.line1, tle.line2)
}

loadTLE()

const latEl = document.getElementById("lat")
const lonEl = document.getElementById("lon")
const altEl = document.getElementById("alt")
const velEl = document.getElementById("vel")

function updateISS(){
  if(!satrec) return

  const now = new Date()
  const pv = satellite.propagate(satrec, now)
  const gmst = satellite.gstime(now)
  const geo = satellite.eciToGeodetic(pv.position, gmst)

  const lat = satellite.degreesLat(geo.latitude)
  const lon = satellite.degreesLong(geo.longitude)
  const alt = geo.height
  const vel = Math.sqrt(
    pv.velocity.x**2 +
    pv.velocity.y**2 +
    pv.velocity.z**2
  )

  issMarker.setLatLng([lat,lon])
  track.addLatLng([lat,lon])

  if (isFirstFix) {
    map.setView([lat, lon], 4)
    isFirstFix = false
  }


  if(track.getLatLngs().length > 200)
    track.setLatLngs([])

  latEl.textContent = lat.toFixed(2)
  lonEl.textContent = lon.toFixed(2)
  altEl.textContent = alt.toFixed(1)
  velEl.textContent = vel.toFixed(2)

  fetch("http://localhost:3000/telemetry",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({
      time:now.toISOString(),
      lat, lon, alt, vel
    })
  })
}

setInterval(updateISS,1000)



/* ---------- CHARTS ---------- */

const altChart = new Chart(
  document.getElementById("altitudeChart"),
  {
    type:"line",
    data:{
      labels:[],
      datasets:[{
        label:"Altitude (km)",
        data:[],
        borderColor:"#00f5ff",
        borderWidth:2,
        tension:0.35,
        pointRadius:0,
        fill:false
      }]
    },
    options:{
      animation:false,
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          labels:{
            color:"#7aa2f7",
            font:{ size:11 }
          }
        },
        tooltip:{
          backgroundColor:"rgba(0,0,0,0.8)",
          borderColor:"#00f5ff",
          borderWidth:1,
          titleColor:"#00f5ff",
          bodyColor:"#e6f1ff"
        }
      },
      scales:{
        x:{
          grid:{ color:"rgba(255,255,255,0.05)" },
          ticks:{ color:"#7aa2f7", maxTicksLimit:6 }
        },
        y:{
          title:{
            display:true,
            text:"Altitude (km)",
            color:"#7aa2f7"
          },
          grid:{ color:"rgba(255,255,255,0.05)" },
          ticks:{ color:"#7aa2f7" }
        }
      }
    }
  }
)


const velChart = new Chart(
  document.getElementById("velocityChart"),
  {
    type:"line",
    data:{
      labels:[],
      datasets:[{
        label:"Velocity (km/s)",
        data:[],
        borderColor:"#ffb020",
        borderWidth:2,
        tension:0.35,
        pointRadius:0,
        fill:false
      }]
    },
    options:{
      animation:false,
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{
          labels:{
            color:"#fbbf24",
            font:{ size:11 }
          }
        },
        tooltip:{
          backgroundColor:"rgba(0,0,0,0.8)",
          borderColor:"#ffb020",
          borderWidth:1,
          titleColor:"#ffb020",
          bodyColor:"#fff7ed"
        }
      },
      scales:{
        x:{
          grid:{ color:"rgba(255,255,255,0.05)" },
          ticks:{ color:"#fbbf24", maxTicksLimit:6 }
        },
        y:{
          title:{
            display:true,
            text:"Velocity (km/s)",
            color:"#fbbf24"
          },
          grid:{ color:"rgba(255,255,255,0.05)" },
          ticks:{ color:"#fbbf24" }
        }
      }
    }
  }
)


async function loadTelemetry(){
  const res = await fetch("http://localhost:3000/telemetry")
  const data = await res.json()

  const labels = data.map(d => d.time.slice(11,19))

  altChart.data.labels = labels
  altChart.data.datasets[0].data = data.map(d => d.alt)
  altChart.update()

  velChart.data.labels = labels
  velChart.data.datasets[0].data = data.map(d => d.vel)
  velChart.update()
}

setInterval(loadTelemetry, 5000)
