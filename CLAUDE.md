# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

English Test — a Vite + React 19 + TypeScript app. Uses pnpm for package management.

## Commands

```bash
pnpm dev          # Start dev server (localhost:5173)
pnpm build        # Type-check with tsc, then build for production
pnpm lint         # Run ESLint on all .ts/.tsx files
pnpm preview      # Preview production build locally
```

No test runner is configured yet.

## Architecture

- **Vite 8** with `@vitejs/plugin-react` for bundling and HMR
- **TypeScript** with project references: `tsconfig.app.json` (browser code) and `tsconfig.node.json` (Vite config)
- **ESLint** flat config with `typescript-eslint`, `react-hooks`, and `react-refresh` plugins
- Entry point: `src/main.tsx` → `src/App.tsx`
- Static assets in `src/assets/`, public files in `public/`

## Proxy

HTTP/HTTPS proxy at `http://127.0.0.1:7897` is configured in `.zshrc` — relevant for any network calls (API fetches, package installs).
请始终用中文回复。
