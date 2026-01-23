import fs from 'fs';
import path from 'path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Arquivo não informado');
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const extension = path.extname(filePath);

console.log(`\n🔍 Reviewing file: ${filePath}`);

if (!['.ts', '.cs'].includes(extension)) {
  console.log('⏭️ Arquivo ignorado (extensão não suportada)');
  process.exit(0);
}

// 🔜 Aqui entrará a chamada ao LLM
console.log('✅ OK – Base review executado');
