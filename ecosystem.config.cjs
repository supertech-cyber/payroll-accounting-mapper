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
//   python -m venv .venv
//   .venv\Scripts\pip install -r backend\requirements.txt
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
      // .venv fica na RAIZ do projeto, não dentro de backend/
      // O python do venv chama uvicorn como módulo (-m uvicorn)
      script: ".venv\\Scripts\\python.exe",
      args: "-m uvicorn app.main:app --host 0.0.0.0 --port 8000",
      cwd: "./backend",
      interpreter: "none",
      env: {
        APP_ENV: "production",
        // Adiciona o python do venv ao PATH para que imports funcionem
        PYTHONPATH: "./backend",
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      out_file: "./logs/api-out.log",
      error_file: "./logs/api-error.log",
      time: true,
    },

    // ─── Frontend: Next.js ─────────────────────────────────────────────────
    {
      name: "payroll-frontend",
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
