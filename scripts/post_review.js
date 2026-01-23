import { execSync } from 'child_process';

const file = process.argv[2];

if (!file) {
  process.exit(0);
}

console.log(`💬 Postando review para ${file}`);

// 🔜 Aqui você usará a API do GitHub para comentar no PR
// Exemplo futuro:
// gh pr comment $PR_NUMBER --body "Review do arquivo ${file}"

console.log('✅ Comentário simulado');
