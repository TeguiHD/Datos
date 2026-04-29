const fs = require('fs');
const file = '/home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas/apps/web/middleware.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "\`script-src 'self' 'unsafe-inline'${isDev ? \" 'unsafe-eval'\" : ''}\`,",
  "\`script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com\${isDev ? \" 'unsafe-eval'\" : ''}\`,"
);

// We might also need connect-src for the beacon to report
code = code.replace(
  "isDev ? 'wss:' : '',\n  ]",
  "isDev ? 'wss:' : '',\n    'https://cloudflareinsights.com',\n  ]"
);

fs.writeFileSync(file, code);
console.log('CSP Patched');
