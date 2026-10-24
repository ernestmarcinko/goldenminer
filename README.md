# Golden Miner

An idle mining game: dig deeper, collect gold and diamonds, and find chests, maps, gems and veins on the way down. Built with TypeScript, Vite and React; it is a static site with no backend, and progress is saved in your browser.

## Run it

Node 22.12 or newer is required (`nvm install` reads `.nvmrc` and installs Node 24).

```
npm install
npm run dev      # development server
npm test         # unit tests
npm run build    # production build in dist/
```

## Saves

The game autosaves every 30 seconds and when the tab is hidden or closed. The Save button in the header exports the save as text, imports one, or starts over. Only one tab can play at a time.

## The original

The 2013 original lives in `legacy/` (open `legacy/index-dev.html`).
