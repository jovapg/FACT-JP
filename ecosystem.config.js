// Configuración de PM2 para producción en VPS
// Uso:
//   pm2 start ecosystem.config.js
//   pm2 save            ← guarda para que arranque solo al reiniciar el VPS
//   pm2 startup         ← habilita auto-arranque al encender el servidor
module.exports = {
  apps: [
    {
      name: 'facjp-api',
      script: './api/server.js',
      cwd: __dirname,
      instances: 1,          // 1 instancia es suficiente para comenzar
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        // ⚠️  Cambia estos valores en el VPS — no dejes los defaults
        JWT_SECRET: 'CAMBIA_ESTO_POR_UNA_CLAVE_ALEATORIA_LARGA',
        DATA_PATH: '/root/facjp/api/src/data',
        FRONTEND_URL: 'http://TU_IP_DEL_VPS:3001'
      },
      // Logs en /root/facjp/logs/
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Reinicia si consume más de 400 MB de RAM
      max_memory_restart: '400M',
      watch: false
    }
  ]
}
