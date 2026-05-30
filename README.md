# SportX — Elite Sports Equipment

```
sportx/
├── frontend/
│   └── index.html        ← Open this in any browser
└── backend/
    ├── server.js          ← Express REST API
    ├── package.json
    └── README.md
```

## Quick Start

**Frontend** — just open `frontend/index.html` in a browser. No build step.

**Backend**
```bash
cd backend
npm install
npm run dev    # runs on http://localhost:4000
```

## Audio Behaviour
- Ambient stadium crowd hum plays softly in the background while the hero section is visible
- Fades out automatically when you scroll down past the hero
- Fades back in when you scroll back up
- Requires one tap/click to unlock (browser autoplay policy)
- No loud sound effects — all reactions are visual only
