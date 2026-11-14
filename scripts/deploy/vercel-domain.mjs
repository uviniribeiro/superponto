#!/usr/bin/env node
// Imprime o endereço público de produção do projeto Vercel vinculado (.vercel/project.json).
// Prefere um domínio próprio (ex.: maxponto.srv.br); senão usa o domínio *.vercel.app.
import { readFileSync } from 'node:fs';

const token = process.env.VERCEL_TOKEN;
const { projectId, orgId } = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
const team = orgId?.startsWith('team_') ? `?teamId=${orgId}` : '';
const res = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains${team}`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`::error::Vercel domains HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { domains = [] } = await res.json();
const names = domains.filter((d) => !d.redirect).map((d) => d.name);
const custom = names.find((n) => !n.endsWith('.vercel.app'));
const vercel = names.filter((n) => n.endsWith('.vercel.app')).sort((a, b) => a.length - b.length)[0];
const chosen = custom ?? vercel;
if (!chosen) {
  console.error('::error::Projeto Vercel sem domínio de produção');
  process.exit(1);
}
console.log(`https://${chosen}`);
