#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const appRoot = fs.existsSync(path.join(rootDir, 'src'))
  ? rootDir
  : path.join(rootDir, 'apps/mobile');
const scanRoots = [path.join(appRoot, 'App.tsx'), path.join(appRoot, 'src')];
const visibleCardContentFiles = [
  path.join(appRoot, 'src/learning/localCardRecords.ts'),
];

const textNodeMetadataPattern =
  /\b(?:\w+\.space_metadata\.(?:library|group|box|box_ref)|\w+\.track|\w+\.libraryName|\w+\.groupName|\w+\.boxName)\b/;

const visiblePropPattern =
  /\b(?:label|title|detail|summary|text|accessibilityLabel|placeholder|items)\s*=/;

const rawMetadataExpressionPattern =
  /\b(?:space_metadata\.(?:library|group|box|box_ref)|\w+\.track|\w+\.libraryName|\w+\.groupName|\w+\.boxName)\b|track\.toUpperCase\(/;

const visibleCardContentLeakPattern =
  /\bCET[46]\b|(?:听力|阅读|写作|翻译|词汇|仔细阅读|快速阅读|学习馆|知识组|训练轨道|原盒位)|\b0\d{3,6}\b/;

const directDisplayMetadataPatterns = [
  {
    pattern: /\b\w*Track\.toUpperCase\(\)/,
    reason: 'raw learning track transformed for display',
  },
  {
    pattern:
      /testID=\{`[^`]*\$\{[^`]*(?:boxRef|space_metadata\.(?:library|group|box|box_ref)|libraryName|groupName|boxName)[^`]*\}[^`]*`\}/,
    reason: 'raw space metadata embedded in rendered element props',
  },
  {
    pattern: /(?:\bCET[46]\b|学习馆|知识组|训练轨道|原盒位)/,
    reason: 'semantic space metadata term in visible copy',
  },
];

function walkSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      walkSourceFiles(path.join(dir, entry.name), files);
      continue;
    }

    if (entry.name.endsWith('.tsx')) {
      files.push(path.join(dir, entry.name));
    }
  }

  return files;
}

function collectSourceFiles() {
  return scanRoots.flatMap(scanRoot => {
    if (!fs.existsSync(scanRoot)) {
      return [];
    }

    if (fs.statSync(scanRoot).isFile()) {
      return scanRoot.endsWith('.tsx') ? [scanRoot] : [];
    }

    return walkSourceFiles(scanRoot);
  });
}

function collectVisibleCardContentFiles() {
  return visibleCardContentFiles.filter(filePath => fs.existsSync(filePath));
}

function checkTextNodeMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];
  let inTextNode = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.includes('<Text') || trimmed.includes('<Text ')) {
      inTextNode = true;
    }

    const isStyleOnlyName =
      /\bstyles\.(?:libraryName|groupName|boxName)\b/.test(trimmed);

    if (
      inTextNode &&
      textNodeMetadataPattern.test(trimmed) &&
      !isStyleOnlyName
    ) {
      findings.push({
        filePath,
        line: index + 1,
        text: trimmed,
        reason: 'space metadata leaked in Text display node',
      });
    }

    if (trimmed.includes('</Text>')) {
      inTextNode = false;
    }
  }

  return findings;
}

function checkDirectDisplayMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (visiblePropPattern.test(text) && rawMetadataExpressionPattern.test(text)) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata passed through visible or accessibility JSX prop',
      });
    }

    const rule = directDisplayMetadataPatterns.find(({ pattern }) =>
      pattern.test(text),
    );

    if (rule) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: rule.reason,
      });
    }
  }

  return findings;
}

function checkVisibleCardContentMetadata(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const findings = [];
  let inSpaceMetadata = false;

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim();

    if (text.startsWith('space_metadata:')) {
      inSpaceMetadata = true;
      continue;
    }

    if (inSpaceMetadata && text === '},') {
      inSpaceMetadata = false;
      continue;
    }

    if (inSpaceMetadata) {
      continue;
    }

    if (
      /^(card_id|knowledge_ref|track):/.test(text) ||
      /^import\b/.test(text)
    ) {
      continue;
    }

    if (visibleCardContentLeakPattern.test(text)) {
      findings.push({
        filePath,
        line: index + 1,
        text,
        reason: 'raw metadata leaked through visible dev seed card content',
      });
    }
  }

  return findings;
}

function collectFindings() {
  const files = collectSourceFiles();
  const allFindings = files.flatMap(file => [
    ...checkTextNodeMetadata(file),
    ...checkDirectDisplayMetadata(file),
  ]);
  const cardContentFindings = collectVisibleCardContentFiles().flatMap(file =>
    checkVisibleCardContentMetadata(file),
  );
  return [...allFindings, ...cardContentFindings];
}

function formatFindings(findings) {
  if (findings.length === 0) {
    return 'PASS: No metadata leaks detected in visible text.';
  }

  const grouped = findings.reduce((carry, item) => {
    const key = item.filePath;
    if (!carry[key]) {
      carry[key] = [];
    }
    carry[key].push(item);
    return carry;
  }, {});

  const lines = [
    'FAIL: Visual metadata leak candidates detected.',
    ...Object.entries(grouped).flatMap(([filePath, values]) => [
      `- ${path.relative(rootDir, filePath)}`,
      ...values.map(
        ({ line, reason, text }) =>
          `  line ${line}: ${reason}\n    ${text.slice(0, 160)}`,
      ),
    ]),
  ];

  return lines.join('\n');
}

const findings = collectFindings();
console.log(formatFindings(findings));

if (findings.length > 0) {
  process.exit(1);
}
