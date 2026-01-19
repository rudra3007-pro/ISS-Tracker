import express from "express"
import fetch from "node-fetch"
import cors from "cors"
import fs from "fs"
import sqlite3 from "sqlite3"

const app = express()
app.use(cors())
app.use(express.json())

/* ---------- DATABASE ---------- */

const db = new sqlite3.Database("telemetry.db")

db.run(`
CREATE TABLE IF NOT EXISTS iss_telemetry (
  time TEXT,
  lat REAL,
  lon REAL,
  alt REAL,
  vel REAL
)
`)

/* ---------- TLE AUTO UPDATE ---------- */

const TLE_URL = "https://celestrak.org/NORAD/elements/stations.txt"
const TLE_FILE = "tle.json"

async function updateTLE(){
  const res = await fetch(TLE_URL)
  const text = await res.text()
  const lines = text.split("\n")
  const i = lines.findIndex(l => l.includes("ISS"))

  const tle = {
    line1: lines[i+1].trim(),
    line2: lines[i+2].trim(),
    updated: new Date().toISOString()
  }

  fs.writeFileSync(TLE_FILE, JSON.stringify(tle, null, 2))
}

updateTLE()
setInterval(updateTLE, 6 * 60 * 60 * 1000)

/* ---------- APIs ---------- */

app.get("/tle", (req,res)=>{
  res.sendFile(process.cwd() + "/tle.json")
})

app.post("/telemetry", (req,res)=>{
  const { time, lat, lon, alt, vel } = req.body
  db.run(
    "INSERT INTO iss_telemetry VALUES (?,?,?,?,?)",
    [time, lat, lon, alt, vel]
  )
  res.json({ status:"saved" })
})

app.get("/telemetry", (req,res)=>{
  db.all(
    "SELECT * FROM iss_telemetry ORDER BY time DESC LIMIT 300",
    [],
    (err, rows)=>{
      if(err) return res.status(500).json(err)
      res.json(rows.reverse())
    }
  )
})

app.listen(3000, ()=>{
  console.log("Backend running → http://localhost:3000")
})
