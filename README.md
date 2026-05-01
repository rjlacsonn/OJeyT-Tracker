# OJeyT Tracker 🎓

A clean, responsive OJT (On-the-Job Training) hour tracker built with vanilla HTML, CSS, and JavaScript.

## Getting Started

### Option 1 — Open directly (simplest)
Just double-click `index.html` and it opens in your browser. Done!

### Option 2 — Live Server in VS Code (recommended)
1. Open the `ojeyt-tracker` folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**
4. Your app opens at `http://127.0.0.1:5500` and auto-refreshes on save!

## Project Structure

```
ojeyt-tracker/
├── index.html          ← Main HTML (single page app)
├── css/
│   ├── reset.css       ← Browser normalization
│   ├── variables.css   ← Design tokens, colors, dark mode
│   ├── layout.css      ← Topbar, nav, page containers
│   ├── components.css  ← All UI components (cards, buttons, etc.)
│   ├── pages.css       ← Page-specific styles (minimal)
│   ├── animations.css  ← Keyframes & transitions
│   └── responsive.css  ← Mobile → tablet → desktop breakpoints
├── js/
│   ├── storage.js      ← localStorage wrapper
│   ├── timer.js        ← Session timer logic
│   ├── ui.js           ← DOM rendering helpers
│   └── app.js          ← Main controller (state, events)
└── README.md
```

## Features

- ✅ **Check In / Check Out** — live timer with active session badge
- 📊 **Progress bar** — hours rendered vs. required
- 🔥 **Streak tracker** — consecutive days attended
- 📅 **Session history** — full log with date, time, and duration
- 📈 **Insights** — summary stats + completion forecast
- 📉 **Weekly bar chart** — visual breakdown of this week
- 🌙 **Dark mode** — auto-detects system preference, manually toggleable
- 📱 **Fully responsive** — mobile, tablet, and desktop
- 💾 **Persistent** — all data saved in localStorage (no backend needed)

## Customizing

### Change the color scheme
Edit `css/variables.css` — all colors are CSS custom properties.
The main green brand color is `--green-400: #1D9E75`.

### Add a feature
- **New page**: add a `<section id="page-xxx">` in `index.html`, a nav button, and handle it in `app.js → navTo()`
- **New stat**: add to the stats grid in `index.html` and update `UI.updateStats()` in `ui.js`
- **New setting**: add a field in the Settings section and save it in `app.js → saveSettings()`

## Tips

- Sessions shorter than 1 minute are not saved (accidental taps)
- If you refresh the page mid-session, the timer resumes automatically
- The streak counts consecutive calendar days with at least one session

## Future Ideas

- Export sessions to CSV / PDF
- Multiple internship profiles
- PWA support (installable on phone home screen)
- Notification reminders
- Notes per session
