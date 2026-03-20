# React + Vite

## Run (this project)

### Quick Start (Recommended)

**Run from project root:**
```powershell
.\start_servers.ps1
```
This starts both backend and frontend servers in separate windows and opens the browser automatically.

### Manual Start

#### 1) Start backend (FastAPI)

- From the `Backend/` folder: run `api_server.py` (serves `http://127.0.0.1:8000`).

#### 2) Start frontend (Vite)

- URL: `http://127.0.0.1:5175/`

**⚠️ IMPORTANT - Windows PowerShell Blank UI Fix:**

If the UI appears blank, it's because the frontend dev server didn't start. This happens when PowerShell blocks `npm.ps1` due to execution policy.

**Solution (choose one):**

1. **✅ Recommended:** Use `dev.cmd` from Frontend folder:
   ```cmd
   cd Frontend
   dev.cmd
   ```

2. **Alternative:** Use npm.cmd directly:
   ```powershell
   cd Frontend
   & "C:\Program Files\nodejs\npm.cmd" run dev
   ```

3. **One-time fix:** Unblock PowerShell scripts:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

**Troubleshooting Blank UI:**
1. Check if frontend server is running: `Test-NetConnection 127.0.0.1 -Port 5175`
2. If `False`, the server isn't running - use one of the solutions above
3. Check browser console (F12) for errors
4. Ensure backend is running: `Test-NetConnection 127.0.0.1 -Port 8000`

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
