#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log(`even-realities-deploy

Publish a packaged Even Realities .ehpk to the Even Hub portal.

Required env:
  PACKAGE_ID                  Even Realities package id
  EHPK_PATH                   Path to the packaged .ehpk file

Auth env:
  EVENHUB_USERNAME            Even Hub login username/email
  EVENHUB_PASSWORD            Even Hub plaintext password

Optional env:
  CHANGELOG                   Release changelog text (first line used)
`);
  process.exit(0);
}

const HUB = 'https://hub.evenrealities.com';
const PACKAGE_ID = required('PACKAGE_ID');
const EHPK_PATH = required('EHPK_PATH');
const USERNAME = process.env.EVENHUB_USERNAME;
const PASSWORD = process.env.EVENHUB_PASSWORD;
const CHANGELOG = (process.env.CHANGELOG ?? '').split('\n')[0].trim() || 'Automated build';

if ((USERNAME && !PASSWORD) || (!USERNAME && PASSWORD)) {
  console.error('incomplete login auth: set both EVENHUB_USERNAME and EVENHUB_PASSWORD');
  process.exit(1);
}

if (!hasUsernamePassword()) {
  console.error('missing required auth: set EVENHUB_USERNAME and EVENHUB_PASSWORD');
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

function hasUsernamePassword() {
  return Boolean(USERNAME && PASSWORD);
}

function encodePassword(username, password) {
  const passwordBytes = new TextEncoder().encode(password);
  const usernameBytes = new TextEncoder().encode(username);
  const encoded = new Uint8Array(passwordBytes.length);

  for (let i = 0; i < passwordBytes.length; i += 1) {
    encoded[i] = passwordBytes[i] ^ usernameBytes[i % usernameBytes.length];
  }

  return Buffer.from(encoded).toString('base64');
}

async function postJson(path, body) {
  return fetch(`${HUB}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function postForm(path, token, form) {
  return fetch(`${HUB}${path}`, {
    method: 'POST',
    headers: { 'X-Even-Authorization': token },
    body: form,
  });
}

async function unwrap(label, response) {
  if (!response.ok) {
    throw new Error(`${label} failed: HTTP ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  if (json && typeof json === 'object' && 'code' in json) {
    if (json.code !== 0) {
      throw new Error(`${label} failed: code=${json.code} ${json.message ?? ''}`);
    }
    return json.data;
  }

  return json;
}

async function login() {
  const response = await postJson('/api/v1/auth/login', {
    email: USERNAME,
    password: encodePassword(USERNAME, PASSWORD),
  });
  const data = await unwrap('login', response);
  const token = data.access_token;
  if (!token) throw new Error(`login returned no access_token: ${JSON.stringify(data)}`);
  return token;
}

async function uploadDraft(token, ehpk, filename) {
  const form = new FormData();
  form.append('ehpk', new Blob([ehpk], { type: 'application/octet-stream' }), filename);

  const response = await postForm(
    `/api/v1/versions/draft?package_id=${encodeURIComponent(PACKAGE_ID)}`,
    token,
    form,
  );
  const data = await unwrap('upload draft', response);
  const draftId = data.draft_id ?? data.id;
  if (!draftId) throw new Error(`draft returned no id: ${JSON.stringify(data)}`);
  return draftId;
}

async function createVersion(token, draftId, changelog) {
  const form = new FormData();
  form.append('draft_id', draftId);
  form.append('changelog', changelog);

  const response = await postForm(
    `/api/v1/versions/create?package_id=${encodeURIComponent(PACKAGE_ID)}`,
    token,
    form,
  );
  return unwrap('create version', response);
}

const ehpk = await readFile(EHPK_PATH);
const filename = basename(EHPK_PATH);

console.log('Logging in…');
const token = await login();

console.log(`Uploading ${filename} (${ehpk.length} bytes) as draft…`);
const draftId = await uploadDraft(token, ehpk, filename);
console.log(`Draft created: ${draftId}`);

console.log(`Publishing draft with changelog: ${JSON.stringify(CHANGELOG)}`);
const version = await createVersion(token, draftId, CHANGELOG);
console.log('Published:', JSON.stringify(version, null, 2));
