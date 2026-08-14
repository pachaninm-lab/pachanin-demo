#!/usr/bin/env node
import fs from 'node:fs';

const servicePath = 'apps/api/src/modules/ai-insights/restricted-public-qwen.service.ts';
const specPath = 'apps/api/src/modules/ai-insights/restricted-public-qwen.service.spec.ts';

function replaceExactlyOnce(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source not found`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected source is ambiguous`);
  return `${text.slice(0, first)}${after}${text.slice(first + before.length)}`;
}

let service = fs.readFileSync(servicePath, 'utf8');
const declarationNeedle = `  const responseBudgetRule = generalAgroResponseBudgetRule(locale, answerMode, responseBudgetProfile);\n  const coverageRule = [`;
const declarationReplacement = `  const responseBudgetRule = generalAgroResponseBudgetRule(locale, answerMode, responseBudgetProfile);\n  const firstSafeBlockRule = answerMode === 'general_agro'\n    ? 'Begin with one short self-contained complete sentence that directly answers the question. End this first sentence before any explanation, list, caveat or clarifying question; target at most 14 words in Russian or English and one short sentence in Chinese when this can be done truthfully. Never omit a required safety or current-evidence boundary to satisfy this format.'\n    : '';\n  const coverageRule = [`;
service = replaceExactlyOnce(service, declarationNeedle, declarationReplacement, 'first-safe-block declaration');

const promptNeedle = `Reply in \${language}. \${coverageRule} \${responseBudgetRule} Respond naturally to greetings.`;
const promptReplacement = `Reply in \${language}. \${coverageRule} \${firstSafeBlockRule} \${responseBudgetRule} Respond naturally to greetings.`;
service = replaceExactlyOnce(service, promptNeedle, promptReplacement, 'first-safe-block prompt insertion');
fs.writeFileSync(servicePath, service, 'utf8');

let spec = fs.readFileSync(specPath, 'utf8');
const generalNeedle = `    expect(body.messages[0].content).toContain('actual reasoning assistant, not a scripted FAQ bot');\n    expect(body.messages[0].content).toContain('Do not refuse merely because the platform knowledge base does not cover an agriculture or agribusiness topic');`;
const generalReplacement = `    expect(body.messages[0].content).toContain('actual reasoning assistant, not a scripted FAQ bot');\n    expect(body.messages[0].content).toContain('Begin with one short self-contained complete sentence that directly answers the question');\n    expect(body.messages[0].content).toContain('End this first sentence before any explanation, list, caveat or clarifying question');\n    expect(body.messages[0].content).toContain('Do not refuse merely because the platform knowledge base does not cover an agriculture or agribusiness topic');`;
spec = replaceExactlyOnce(spec, generalNeedle, generalReplacement, 'general-agro prompt regression');

const verifiedNeedle = `    expect(body.messages[0].content).toContain('Never present planned, proposed or unverified functionality as already available');\n    expect(body.messages[1].content).toContain('ANSWER_MODE: verified_platform');`;
const verifiedReplacement = `    expect(body.messages[0].content).toContain('Never present planned, proposed or unverified functionality as already available');\n    expect(body.messages[0].content).not.toContain('Begin with one short self-contained complete sentence that directly answers the question');\n    expect(body.messages[1].content).toContain('ANSWER_MODE: verified_platform');`;
spec = replaceExactlyOnce(spec, verifiedNeedle, verifiedReplacement, 'verified-platform isolation regression');
fs.writeFileSync(specPath, spec, 'utf8');

console.log('GEKTA_G3A_MATERIALIZED=1');
