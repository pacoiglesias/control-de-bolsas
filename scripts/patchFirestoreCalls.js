// scripts/patchFirestoreCalls.js
/**
 * This script scans the codebase for direct Firestore setDoc and updateDoc calls
 * and replaces them with safeSetDoc and safeUpdateDoc from '../src/lib/safeFirestore'.
 * It also adds the necessary imports.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const files = [
  'src/pages/Users.tsx',
  'src/pages/Respaldo.tsx',
  'src/pages/Compras.tsx',
  'src/pages/CajaChica.tsx',
  'src/lib/deliveries.ts',
  'src/lib/cloudBackup.ts',
  'src/lib/autoDocumentProcessor.ts',
  'src/hooks/useFCMNotifications.ts',
  'src/hooks/usePresence.ts',
  'src/hooks/useSystemSettings.ts',
  'src/hooks/useConfig.ts',
  'src/features/wizard/steps/ConfirmacionStep.tsx',
  'src/hooks/useAndresStats.ts',
  'src/components/Recepcion/DocumentAutoAssigner.tsx',
  'src/components/OrderModal/useOrderActions.ts',
  'src/components/ErrorBoundary.tsx',
  'src/components/Dashboard/ConsolaCuadreEjecutivoModal.tsx',
  'src/components/Compras/OrderModals.tsx',
  'src/components/Dashboard/AdminQuickEditPanel.tsx',
  'src/components/Dashboard/UniversalDocumentUploadModal.tsx',
  'src/components/Cobranza/SincronizadorOficialModal.tsx',
  'src/components/CajaChica/ExpenseDrawer.tsx',
  'src/context/ConfigContext.tsx',
  'src/context/AuthContext.tsx',
  'src/App.tsx',
];

files.forEach(relativePath => {
  const filePath = path.join(projectRoot, relativePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const hasSetDoc = /setDoc\s*\(/.test(content);
  const hasUpdateDoc = /updateDoc\s*\(/.test(content);
  if (hasSetDoc) {
    if (!content.includes('safeSetDoc') && !content.includes('safeUpdateDoc')) {
      const importLine = "import { safeSetDoc, safeUpdateDoc } from '../lib/safeFirestore';";
      const lines = content.split('\n');
      const lastFirestoreImportIdx = lines.findIndex(l => l.includes("'firebase/firestore'"));
      if (lastFirestoreImportIdx !== -1) {
        lines.splice(lastFirestoreImportIdx + 1, 0, importLine);
      } else {
        lines.unshift(importLine);
      }
      content = lines.join('\n');
    }
    content = content.replace(/setDoc\s*\(([^,]+),\s*([^,\)]+)([^)]*)\)/g, (match, p1, p2, p3) => {
      return `safeSetDoc(${p1.trim()}, ${p2.trim()}${p3})`;
    });
  }
  if (hasUpdateDoc) {
    if (!content.includes('safeSetDoc') && !content.includes('safeUpdateDoc')) {
      const importLine = "import { safeSetDoc, safeUpdateDoc } from '../lib/safeFirestore';";
      const lines = content.split('\n');
      const lastFirestoreImportIdx = lines.findIndex(l => l.includes("'firebase/firestore'"));
      if (lastFirestoreImportIdx !== -1) {
        lines.splice(lastFirestoreImportIdx + 1, 0, importLine);
      } else {
        lines.unshift(importLine);
      }
      content = lines.join('\n');
    }
    content = content.replace(/updateDoc\s*\(([^,]+),\s*([^\)]+)\)/g, (match, p1, p2) => {
      return `safeUpdateDoc(${p1.trim()}, ${p2.trim()})`;
    });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Patched ${relativePath}`);
});
