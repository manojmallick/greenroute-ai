# 🎥 Demo Recording — Quick Start (5 Minutes)

## What You'll Record

A **2-minute video** showing GreenRoute AI's multi-city optimization across Amsterdam, Berlin, and London.

---

## Step 1: Start the Services (1 minute)

```bash
cd /Users/manojmallick/Documents/greenroute-ai

# Kill any existing services
pkill -f "npm run dev"
sleep 2

# Start API Gateway
cd packages/api-gateway && npm run dev &

# Start Frontend (in new terminal or after a moment)
cd packages/frontend && npm run dev &

# Wait for servers to start
sleep 5
```

**Expected Output:**
- API Gateway: `Listening on http://localhost:3000`
- Frontend: `VITE v8... ready` and `Local: http://localhost:5173/`

---

## Step 2: Open the Dashboard (1 minute)

1. Open browser: http://localhost:5173
2. You should see:
   - Live map with vehicles on left
   - Sidebar on right with:
     - ✅ CO₂ Ticker (showing current savings)
     - ✅ CitySelector (Amsterdam, Berlin, London buttons)
     - ✅ MultiCityComparison (metrics cards + aggregate)

---

## Step 3: Record the Demo (2 minutes)

**Use this script:** `docs/DEMO_RECORDING_GUIDE.md`

**Quick version:**
1. **Show Amsterdam** (15 sec)
   - Click Amsterdam button in CitySelector
   - Point to: 156 routes, 8 vehicles, 423.8 kg CO₂
   
2. **Show Berlin** (15 sec)
   - Click Berlin button
   - Point to: 112 routes, 6 vehicles, 378.5 kg CO₂, "Heavy traffic"
   
3. **Show London** (15 sec)
   - Click London button
   - Point to: 189 routes, 9 vehicles, 512.3 kg CO₂, "Very Heavy"
   
4. **Show Aggregate** (35 sec)
   - Scroll down to see full metrics
   - Read the highlight cards:
     - 457 routes optimized
     - 1,314.6 kg CO₂ saved
     - 479.7 tonnes annually
     - 137 cars off road for a year
     - $111,741 in carbon credits

5. **Closing** (30 sec)
   - "That's GreenRoute AI — scalable carbon-aware routing"

---

## Step 4: Export & Upload

### Export Video
- **Format:** MP4
- **Quality:** 1080p, 30fps
- **Bitrate:** 5-10 Mbps
- **File name:** `greenroute-demo-2026-05-20.mp4`

### Upload to GitHub
```bash
# Go to: https://github.com/manojmallick/greenroute-ai/releases/new
# Tag: v2.1.0-algofest
# Title: GreenRoute AI — Multi-City Carbon Optimization Demo
# Upload video in release notes
```

### Upload to Devpost
- Create new project submission
- Embed video link in description
- Add: "Live dashboard at greenroute-frontend-j6pe6wobrq-ez.a.run.app"

---

## Recording Tools (Choose One)

### Mac
- **QuickTime Player**
  - Cmd+Space → "QuickTime"
  - File → New Screen Recording
  - Click record, select region, done!

### Windows
- **Xbox Game Bar**
  - Win+G → "Record"
  - Or use OBS (free, more features)

### Linux
- **OBS Studio** (free, all platforms)
  - Download from obsproject.com
  - Set output to 1920x1080, 30fps, H.264

### Browser-Based
- **Loom.com** (free recording + hosting)
- **Screencastify** (Chrome extension)

---

## Dashboard Preview

When you open http://localhost:5173, you should see:

```
┌─────────────────────────────────────────┐
│  GreenRoute AI — AlgoFest 2026          │
│  🌿 Live | ⚡ Optimize Route | 🚨 Spike │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              LIVE MAP                   │
│         (vehicles moving)               │
│                                         │
│                                         │
└─────────────────────────────────────────┘

SIDEBAR (Right):
├─ 🌍 CO₂ Saved This Session
│  └─ XX.XXX kg CO₂e
├─ 🇳🇱 🇩🇪 🇬🇧 CitySelector
│  └─ [AMS] [BER] [LON] buttons
├─ 📊 Multi-City Impact Comparison
│  ├─ Amsterdam Card: 156 routes, 8 vans
│  ├─ Berlin Card: 112 routes, 6 vans
│  ├─ London Card: 189 routes, 9 vans
│  └─ Aggregate: 457 routes, $111K value
├─ 🚗 Fleet Dashboard
├─ 📈 Leaderboard
└─ [other components]
```

---

## Verification Checklist

Before recording:
- [ ] API Gateway running on port 3000
- [ ] Frontend running on port 5173
- [ ] Dashboard loads without errors
- [ ] City buttons are clickable
- [ ] Map updates when switching cities
- [ ] All three cities show correct numbers
- [ ] Aggregate metrics display correctly

**Test the API:**
```bash
curl -s http://localhost:3000/api/health | jq .
# Should show: { "status": "ok", "service": "greenroute-api-gateway" }

curl -s http://localhost:3000/api/carbon/cities | jq '.aggregate'
# Should show: { "totalCities": 3, "totalRoutesOptimized": 457, ... }
```

---

## Common Issues & Fixes

**Dashboard is blank:**
- Reload page (Cmd+R)
- Clear browser cache (Cmd+Shift+Delete)
- Check console for errors (F12)

**City buttons don't work:**
- Make sure frontend is running
- Check browser console for JavaScript errors
- Verify you're using latest Chrome/Firefox

**Map doesn't show landmarks:**
- This is expected in dev mode (uses mock data)
- Focus on the sidebar metrics instead

**Components are invisible:**
- Check dark mode is disabled (brightness 🔆)
- Try zooming to 100% (Cmd+0)
- Try different browser

---

## Success = Demo Recorded ✅

Once you hit "Stop Recording," you're 50% done:
1. ✅ Export video (MP4)
2. ✅ Create GitHub Release
3. ✅ Submit to Devpost with video link
4. ✅ Done!

**That's it. Ship it!** 🚀

---

**Questions?**
- Check `docs/DEMO_RECORDING_GUIDE.md` for detailed instructions
- Check `docs/JUDGE_DEMO_SCRIPT.md` for the full talking points
- Check `docs/IMPLEMENTATION_CHECKLIST.md` for next steps after submission
