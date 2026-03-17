// PM2 Ecosystem — Payroll Accounting Mapper
// Windows Server deployment
//
// PRÉ-REQUISITOS no servidor:
//   - Node.js 20+ e npm
//   - Python 3.12+ e pip
//   - PM2 instalado globalmente: npm install -g pm2
//
// PRIMEIRA VEZ (setup no servidor):
//   cd C:\caminho\para\payroll-accounting-mapper
//   cd backend && python -m venv .venv && .venv\Scripts\pip install -r ..\requirements.txt && cd ..
//   cd frontend && npm install && npm run build && cd ..
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup   ← gera o comando para iniciar automaticamente no boot
//
// DEPLOY (atualizar depois de git pull):
//   cd frontend && npm run build && cd ..
//   pm2 restart all

module.exports = {
  apps: [
    // ─── Backend: FastAPI + Uvicorn ────────────────────────────────────────
    {
      name: "payroll-api",
      // Usa o uvicorn do virtualenv diretamente
      script: ".venv\\Scripts\\uvicorn.exe",
      args: "app.main:app --host 0.0.0.0 --port 8000 --workers 2",
      cwd: "./backend",
      interpreter: "none",
      env: {
        // Força o carregamento do .env.production na raiz do projeto
        APP_ENV: "production",
      },
      // Reinicia automaticamente se cair
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      // Logs
      out_file: "./logs/api-out.log",
      error_file: "./logs/api-error.log",
      time: true,
    },

    // ─── Frontend: Next.js ─────────────────────────────────────────────────
    {
      name: "payroll-frontend",
      // Usa o Next.js do node_modules diretamente via node
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3000",
      cwd: "./frontend",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      out_file: "./logs/frontend-out.log",
      error_file: "./logs/frontend-error.log",
      time: true,
    },
  ],
};
