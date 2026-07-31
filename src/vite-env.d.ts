/// <reference types="vite/client" />

/**
 * Constante inyectada por Vite en tiempo de compilación (ver `define` en
 * vite.config.ts). Declararla aquí evita los `@ts-ignore` que había en
 * Layout.tsx, que además de ruidosos silenciaban cualquier otro error de esa
 * línea.
 */
declare const __BUILD_DATE__: string;

/** Version real de package.json, inyectada en build. Ver vite.config.ts. */
declare const __APP_VERSION__: string;
