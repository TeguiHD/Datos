const fs = require('fs');
const file = '/home/nicoholas/Documentos/Paginas/Planificaciones/datos-nicoholas/apps/web/app/(dashboard)/_components/FloatingAiChat.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add filter to ChatMessage meta
content = content.replace(
  "mode: 'executions';",
  "mode: 'executions';\n    filter?: Record<string, unknown>;"
);

// 2. Add filter to onSuccess object
content = content.replace(
  "rows: result.rows,",
  "rows: result.rows,\n          filter: result.filter,"
);

// 3. Import ArrowRight
content = content.replace(
  "Activity, BarChart3 } from 'lucide-react';",
  "Activity, BarChart3, ArrowRight } from 'lucide-react';"
);

// 4. Add button inside MessageBubble (below the table, but inside the white container)
// Let's insert it before "{meta.count > 100" or similar.
const marker = "{meta.count > 100 && (";
const newCode = `
             <div className="mt-3 text-center">
               <a 
                 href={\`/dashboard?\${new URLSearchParams((meta.filter || {}) as Record<string, string>).toString()}\`}
                 className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-full px-4 py-2 transition-all hover:scale-[1.02]"
               >
                 Ver análisis detallado en Cronograma
                 <ArrowRight className="h-3.5 w-3.5" />
               </a>
             </div>
             
             {meta.count > 100 && (`
             
content = content.replace(marker, newCode);

fs.writeFileSync(file, content);
console.log('patched');
