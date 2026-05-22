# 🎬 Demo Video Recording Guide — 2 Minutes

## Setup

**Equipment:** 
- Any device with screen recording (Mac: QuickTime, Windows: Xbox app, or free OBS)
- Good lighting
- Quiet background
- No interruptions for 2 minutes

**Quality Settings:**
- 1080p or higher
- 30 fps minimum
- No watermarks
- Clear audio (script can be narrated or silent with text overlays)

---

## Script: 60-120 Seconds Demo

### Opening (0:00-0:10) — 10 seconds

**Visual:** Show browser with GreenRoute AI dashboard

**Audio:** 
> "GreenRoute AI is a multi-agent, multi-city autonomous system that optimizes delivery routes for carbon, not just time. Now featuring Gemini-powered replanning, downloadable carbon certificates, and a real-time dashboard across three European cities. Watch what happens when we optimize the same delivery across Amsterdam, Berlin, and London."

**Action:**
- Show full dashboard with Amsterdam vehicles + map
- Point to the city selector on the left sidebar

---

### Scene 1: Amsterdam Baseline (0:10-0:25) — 15 seconds

**Visual:** Amsterdam fleet active on map
**Audio:**
> "This is Amsterdam. 8 vehicles, 156 routes optimized, 423.8 kg of CO₂ saved."

**Action:**
1. Point to CitySelector showing Amsterdam selected (🇳🇱)
2. Highlight the MultiCityComparison card for Amsterdam showing:
   - 156 routes
   - 8 vehicles
   - 423.8 kg CO₂
3. Show the CO₂ ticker counting up

---

### Scene 2: Switch to Berlin (0:25-0:40) — 15 seconds

**Visual:** Toggle city selector to Berlin
**Audio:**
> "Now let's look at Berlin. Different traffic patterns, longer rush hours, more congestion. Still the same algorithm, different city characteristics."

**Action:**
1. **CLICK** on Berlin button in CitySelector
2. Watch map update to Berlin landmarks (BER-CS, BER-BRN, etc.)
3. Point to Berlin card in MultiCityComparison:
   - 6 vehicles
   - 112 routes
   - 378.5 kg CO₂
   - "Heavy traffic pattern (6-10h, 16-20h)"
4. Highlight the higher traffic volatility

---

### Scene 3: Switch to London (0:40-0:55) — 15 seconds

**Visual:** Toggle city selector to London
**Audio:**
> "And London — the heaviest traffic of the three cities. More vehicles, more routes, more CO₂ saved because the algorithm is working harder against congestion."

**Action:**
1. **CLICK** on London button in CitySelector
2. Watch map update to London landmarks (LON-CCH, LON-BIG, etc.)
3. Point to London card in MultiCityComparison:
   - 9 vehicles
   - 189 routes  
   - 512.3 kg CO₂
   - "Very Heavy traffic (7-10h, 16-20h)"

4. Notice London has the highest CO₂ savings (because algorithm worked hardest)
5. Optionally, show the Download Certificate button and demonstrate downloading a carbon impact certificate (PDF/CSV) for a route or city.

---

### Scene 4: Aggregate Impact (0:55-1:30) — 35 seconds

**Visual:** Show the aggregate metrics section of MultiCityComparison
**Audio:**
> "Across all three cities: 457 routes optimized, 1,314.6 kg of CO₂ saved today. That's 479.8 tonnes annually. Equivalent to removing 137 cars from the road for an entire year. Or $111,741 in carbon credits under EU ETS pricing."

**Action:**
1. Scroll down in sidebar to see full MultiCityComparison component
2. Point to the "Aggregate Impact" section
3. Highlight the three highlight cards:
   - **🚗 137 cars off road / year**
   - **💰 $111,741 carbon credits value (annual)**
   - **🌱 21,816 trees needed to offset**
4. Show the metrics bars that visualize:
   - Routes Optimized: 457
   - CO₂ Saved: 1314.6 kg
   - Annual CO₂: 479.7 tonnes

---

### Closing (1:30-2:00) — 30 seconds

**Visual:** Show the full dashboard with all components

**Audio:**
> "Every route gets a downloadable carbon impact certificate with exact savings and monetary value. The algorithm is fully autonomous, replanning in under 2 seconds using Gemini LLM when traffic anomalies hit. All three cities, same algorithm, different results — that's what we mean by scalable, algorithmic excellence for sustainable logistics."

**Action:**
1. Take a final screenshot of the complete dashboard
2. Optionally show the CO₂ Ticker and how it displays real-time savings
3. End with the GreenRoute AI logo visible

---

## Recording Tips

### Video Quality
- ✅ Record at 1080p or higher
- ✅ 30 fps minimum (60 fps is better)
- ✅ Good contrast (light text on dark background of dashboard works well)
- ✅ Steady camera (use tripod or phone stand)
- ✅ Smooth scrolling and clicks

### Audio Quality
- ✅ Record in a quiet room
- ✅ Speak clearly and at normal pace
- ✅ Use a good microphone (built-in is fine if room is quiet)
- ✅ Or record without voice and add text overlays

### Pacing
- ✅ Move slowly between scenes (viewers need time to read)
- ✅ Hover on key metrics for 2-3 seconds
- ✅ Let the map load/update (shows real interactivity)
- ✅ Don't rush — 2 minutes is plenty of time

### Shots to Get
1. **Wide shot** of full dashboard with all components visible
2. **Close-up** of CitySelector with buttons
3. **Close-up** of each city card in MultiCityComparison
4. **Close-up** of the aggregate metrics
5. **Full view** of the CO₂ Ticker
6. **Certificate download**: Show the Download Certificate button and the resulting PDF/CSV

---

## Post-Recording

### Export Settings
- **Format:** MP4 (most compatible)
- **Codec:** H.264
- **Bitrate:** 5-10 Mbps (good quality, reasonable file size)
- **Resolution:** 1920x1080 or higher

### File Name
```
greenroute-ai-demo-2026-05-20.mp4
```

### Upload
1. Upload to GitHub Releases (supports videos up to 2GB)
2. Or host on YouTube (unlisted) and embed link in Devpost
3. Or upload to Loom.com (free, easy sharing)

---

## Alternative: Screenshot Walk-Through

If video recording isn't possible:

1. **Take 5-6 high-quality screenshots:**
   - Dashboard overview
   - CitySelector with Amsterdam
   - CitySelector with Berlin
   - CitySelector with London
   - MultiCityComparison aggregate view
   - CO₂ impact details

2. **Create a simple presentation:**
   - Upload screenshots to Google Slides or Figma
   - Add text overlays explaining each screenshot
   - Export as PDF or animated GIF

3. **Share as**: Screenshots + GIF carousel in Devpost

---

## Performance Notes

If the dashboard is slow:
- Close other browser tabs
- Restart the development server
- Clear browser cache (Cmd+Shift+Delete)
- Use Chrome/Chromium (best performance)

If components don't show:
- Check browser console for errors (F12)
- Verify API gateway is running: `curl http://localhost:3000/api/health`
- Verify frontend is running: `curl http://localhost:5173`
- Reload the page (Cmd+R)

---

## Success Checklist

- [ ] All three cities show correctly when toggled
- [ ] Map updates with city-specific landmarks
- [ ] MultiCityComparison shows correct data for each city
- [ ] Aggregate metrics are visible and correct
- [ ] CO₂ Ticker displays and updates smoothly
- [ ] Downloadable carbon certificate (PDF/CSV) is demonstrated
- [ ] Gemini-powered replanning is visible (ReplanBanner or event)
- [ ] Real-time metrics and API endpoints are highlighted
- [ ] Video is clear and audible
- [ ] Total runtime is 2 minutes
- [ ] File is exported in MP4 format
- [ ] Video is uploaded to GitHub Releases

---

## Pro Tips

**Make it Engaging:**
- Add subtle background music (royalty-free)
- Include transition animations between cities
- Use cursor highlights to point to key elements
- Add text overlays with key metrics

**For Judges:**
- Start with the problem statement ("Urban delivery causes 27% of transport CO₂")
- Show the solution ("Three cities, same algorithm, different results")
- End with impact ("479 tonnes annually = 137 cars off road")

**Timing:**
- 0:00-0:10 — Hook (problem statement)
- 0:10-0:40 — Demo (3 cities)
- 0:40-1:30 — Impact (aggregate metrics)
- 1:30-2:00 — Close (why it wins)

---

**Ready to record? Hit the "record" button and speak with confidence. You've built something awesome! 🚀**
