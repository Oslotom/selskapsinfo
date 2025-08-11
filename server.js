import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import basicAuth from 'basic-auth';
import { SignJWT, importPKCS8 } from 'jose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic auth protection for API routes
const API_USER = process.env.PROXY_USER || 'oslotom';
const API_PASS = process.env.PROXY_PASS || 'oslotom';
app.use('/api', (req, res, next) => {
  const creds = basicAuth(req);
  if (!creds || creds.name !== API_USER || creds.pass !== API_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="Access"');
    return res.status(401).send('Authentication required.');
  }
  next();
});

app.use('/api', cors({ origin: process.env.CORS_ORIGIN || true }));

async function proxyJSON(url, init = {}) {
  const r = await fetch(url, { headers: { Accept: 'application/json' }, ...init });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return r.json();
}

// Open endpoints
app.get('/api/enheter', async (req, res) => {
  try {
    const qs = new URLSearchParams({ ...req.query });
    const url = `https://data.brreg.no/enhetsregisteret/api/enheter?${qs.toString()}`;
    const json = await proxyJSON(url);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/regnskap/:orgnr', async (req, res) => {
  try {
    const { orgnr } = req.params;
    const qs = new URLSearchParams({ ...req.query });
    const url = `https://data.brreg.no/regnskapsregisteret/api/regnskap/${orgnr}?${qs.toString()}`;
    const json = await proxyJSON(url);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

async function getMaskinportenAccessToken() {
  const clientId = process.env.MP_CLIENT_ID;
  const tokenEndpoint = process.env.MP_TOKEN_ENDPOINT;
  const scope = process.env.MP_SCOPE;
  const pkcs8 = await importPKCS8(process.env.MP_PRIVATE_KEY_PEM || '', 'RS256');

  const jwt = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(tokenEndpoint)
    .setExpirationTime('2m')
    .setIssuedAt()
    .sign(pkcs8);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const r = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!r.ok) throw new Error(`Token endpoint error: HTTP ${r.status}`);
  const data = await r.json();
  return data.access_token;
}

// Protected endpoint requiring Maskinporten
app.get('/api/regnskap/:orgnr/historikk', async (req, res) => {
  try {
    const { orgnr } = req.params;
    const qs = new URLSearchParams({ ...req.query });
    const token = await getMaskinportenAccessToken();
    const url = `https://data.brreg.no/regnskapsregisteret/api/regnskap/${orgnr}?${qs.toString()}`;
    const json = await proxyJSON(url, { headers: { Authorization: `Bearer ${token}` } });
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Serve static files for frontend
app.use(express.static('.', { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
});

