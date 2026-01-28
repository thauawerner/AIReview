import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';
import OpenAI from "openai";
import 'dotenv/config';

import { fileURLToPath } from 'url';





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
// Configuração
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const [owner, repo] = process.env.REPO_FULL_NAME.split('/');
const prNumber = parseInt(process.env.PR_NUMBER);
const baseRef = process.env.BASE_REF;

// Carregar configurações
const rules = yaml.load(
  fs.readFileSync(path.join(projectRoot, '.review', 'rules.yml'), 'utf8')
);

const ignore = yaml.load(
  fs.readFileSync(path.join(projectRoot, '.review', 'ignore.yml'), 'utf8')
);

const promptTemplate = fs.readFileSync(
  path.join(projectRoot, '.review', 'prompts', 'review.md'),
  'utf8'
);

// === FUNÇÕES DE UTILIDADE ===

function detectLanguage(filepath) {
  const ext = path.extname(filepath);
  const mapping = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cs': 'csharp',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.md': 'markdown'
  };
  return mapping[ext] || null;
}

function shouldIgnoreFile(filepath) {
  if (ignore.force_include?.includes(filepath)) {
    return false;
  }

  if (ignore.patterns.folders.some(folder => filepath.includes(folder))) {
    return true;
  }

  if (ignore.patterns.files.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path.basename(filepath));
    }
    return filepath === pattern || filepath.endsWith(pattern);
  })) {
    return true;
  }

  const ext = path.extname(filepath);
  if (ignore.patterns.extensions.includes(ext)) {
    return true;
  }

  return false;
}

function getChangedFiles() {
  try {
    const diff = execSync(
      `git diff --name-only origin/${baseRef}...HEAD`,
      { encoding: 'utf8' }
    ).trim();

    if (!diff) return [];

    return diff.split('\n').filter(file => {
      if (!file) return false;
      if (shouldIgnoreFile(file)) {
        console.log(`  ⏭️  Ignorando: ${file}`);
        return false;
      }
      const lang = detectLanguage(file);
      if (!lang) {
        console.log(`  ⏭️  Linguagem não suportada: ${file}`);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('Erro ao obter arquivos modificados:', error);
    return [];
  }
}

function getFileDiff(filepath) {
  try {
    return execSync(
      `git diff origin/${baseRef}...HEAD -- "${filepath}"`,
      { encoding: 'utf8' }
    );
  } catch (error) {
    console.error(`Erro ao obter diff de ${filepath}:`, error);
    return null;
  }
}

function getLanguageRules(language) {
  // Buscar regras específicas da linguagem
  const langRules = rules.languages?.[language]?.rules || [];
  const generalRules = rules.general?.rules || [];
  const securityRules = rules.security?.rules || [];

  return {
    language: langRules,
    general: generalRules,
    security: securityRules
  };
}


async function analyzeFileWithOpenAi(filepath, diff, language) {
  const relevantRules = getLanguageRules(language);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `# Code Review Task

## File Information
- **Path:** ${filepath}
- **Language:** ${language}
- **Changed Lines:** ${diff.split('\n').length}

## Project Rules
${yaml.dump(relevantRules, { indent: 2 })}

## Instructions
${promptTemplate}

## Code to Review
\`\`\`diff
${diff}
\`\`\`

Analyze this code following the format specified in the instructions above.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a senior code reviewer. Be concise, objective, and strictly follow the project rules.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1200
    });

    return response.choices?.[0]?.message?.content ?? null;

  } catch (error) {
    console.error(`❌ Erro ao analisar ${filepath}`);
    console.error('Status:', error.status);
    console.error('Message:', error.message);
    console.error('Details:', error.response?.data || error);
    return null;
  }
}




function aggregateReviews(fileReviews) {
  let aggregated = `# 🤖 AI Code Review Summary\n\n`;
  aggregated += `**Files Analyzed:** ${fileReviews.length}\n\n`;
  aggregated += `---\n\n`;

  // Separar por severidade
  const critical = [];
  const warnings = [];
  const suggestions = [];
  const ok = [];

  fileReviews.forEach(({ file, review }) => {
    if (review.includes('🔴 Crítico') || review.includes('## 🔴')) {
      critical.push({ file, review });
    } else if (review.includes('⚠️') || review.includes('## ⚠️')) {
      warnings.push({ file, review });
    } else if (review.includes('💡')) {
      suggestions.push({ file, review });
    } else {
      ok.push({ file, review });
    }
  });

  // Problemas críticos primeiro
  if (critical.length > 0) {
    aggregated += `## 🔴 Critical Issues (${critical.length} files)\n\n`;
    critical.forEach(({ file, review }) => {
      aggregated += `### 📄 \`${file}\`\n\n${review}\n\n---\n\n`;
    });
  }

  // Avisos
  if (warnings.length > 0) {
    aggregated += `## ⚠️ Warnings (${warnings.length} files)\n\n`;
    warnings.forEach(({ file, review }) => {
      aggregated += `### 📄 \`${file}\`\n\n${review}\n\n---\n\n`;
    });
  }

  // Sugestões
  if (suggestions.length > 0) {
    aggregated += `## 💡 Suggestions (${suggestions.length} files)\n\n`;
    suggestions.forEach(({ file, review }) => {
      aggregated += `### 📄 \`${file}\`\n\n${review}\n\n---\n\n`;
    });
  }

  // Arquivos OK
  if (ok.length > 0) {
    aggregated += `## ✅ Files Without Issues (${ok.length})\n\n`;
    ok.forEach(({ file }) => {
      aggregated += `- \`${file}\`\n`;
    });
    aggregated += `\n`;
  }

  return {
    body: aggregated,
    hasCritical: critical.length > 0,
    hasWarnings: warnings.length > 0
  };
}

async function postReviewComment(aggregated) {
  const timestamp = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo'
  });

  const body = `${aggregated.body}
  
---
*Review generated at ${timestamp} using GitHub Copilot*
*⚠️ This is an automated analysis. Always consider human review for final approval.*`;

  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body
    });
    console.log('✅ Comentário postado no PR');
  } catch (error) {
    console.error('❌ Erro ao postar comentário:', error.message);
  }
}

async function submitFormalReview(hasCritical, hasWarnings) {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    const isOwnPR = pr.user.login === 'github-actions[bot]';

    let event = 'COMMENT';
    let body = '✅ No critical issues detected. Manual review still recommended.';

    if (hasCritical) {
      body = '🔴 Critical issues detected. Please address before merging.';
      if (!isOwnPR) {
        event = 'REQUEST_CHANGES';
      }
    } else if (hasWarnings) {
      body = '⚠️ Some warnings found. Review recommended before merging.';
    }

    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      event,
      body
    });

    console.log(`✅ Review formal submetido: ${event}`);
  } catch (error) {
    console.error('❌ Erro ao submeter review:', error.message);
  }
}


// === MAIN ===

async function main() {
  console.log('🚀 Iniciando AI Code Review...\n');

  // 1. Obter arquivos modificados
  console.log('📂 Detectando arquivos modificados...');
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('ℹ️  Nenhum arquivo relevante para revisar.');
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: '## 🤖 AI Code Review\n\nNo relevant code files were modified in this PR.'
    });
    return;
  }

  console.log(`✓ ${changedFiles.length} arquivo(s) para revisar:\n`);
  changedFiles.forEach(f => console.log(`  - ${f}`));
  console.log('');

  // 2. Analisar cada arquivo
  console.log('🧠 Analisando arquivos com AI...\n');
  const fileReviews = [];

  for (const file of changedFiles) {
    console.log(`🔍 Revisando: ${file}`);

    const language = detectLanguage(file);
    let diff = getFileDiff(file);

    if (!diff || diff.trim().length === 0) {
      console.log('  📄 Diff vazio, analisando arquivo completo');

      const absoluteFilePath = path.join(projectRoot, file);

      if (!fs.existsSync(absoluteFilePath)) {
        console.log(`  ❌ Arquivo não encontrado: ${absoluteFilePath}`);
        continue;
      }

      const fullContent = fs.readFileSync(absoluteFilePath, 'utf8');

      diff = `--- FULL FILE CONTENT ---
${fullContent}`;
    } else {
      console.log('  🧩 Analisando apenas o diff');
    }

    const review = await analyzeFileWithOpenAi(file, diff, language);

    if (review) {
      fileReviews.push({ file, review, language });
      console.log(`  ✓ Revisão concluída`);
    } else {
      console.log(`  ⚠️  Erro na revisão`);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }


  if (fileReviews.length === 0) {
    console.log('\n⚠️  Nenhuma análise foi gerada.');
    return;
  }

  // 3. Agregar resultados
  console.log('\n📊 Agregando resultados...');
  const aggregated = aggregateReviews(fileReviews);

  console.log('💬 Postando comentário no PR...');
  await postReviewComment(aggregated);

  console.log('✍️  Submetendo review formal...');
  await submitFormalReview(aggregated.hasCritical, aggregated.hasWarnings);

  console.log('\n' + '='.repeat(50));
  console.log('✅ AI Code Review concluído!');
  console.log('='.repeat(50));
  console.log(`📊 Estatísticas:`);
  console.log(`   - Arquivos analisados: ${fileReviews.length}`);
  console.log(`   - Problemas críticos: ${aggregated.hasCritical ? 'SIM' : 'Não'}`);
  console.log(`   - Avisos encontrados: ${aggregated.hasWarnings ? 'SIM' : 'Não'}`);
}

main().catch(error => {
  console.error('\n❌ ERRO FATAL:', error);
  process.exit(1);
});