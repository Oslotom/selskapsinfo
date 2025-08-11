const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const basicAuth = require('basic-auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));

async function proxyJSON(url, options = {}) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json', ...(options.headers || {}) }, ...options });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} on ${url}`);
  }
  return r.json();
}

app.get('/api/enheter', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const url = `https://data.brreg.no/enhetsregisteret/api/enheter?${qs}`;
    const json = await proxyJSON(url);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/regnskap/:orgnr', async (req, res) => {
  try {
    const { orgnr } = req.params;
    const qs = new URLSearchParams(req.query).toString();
    const url = `https://data.brreg.no/regnskapsregisteret/api/regnskap/${orgnr}?${qs}`;
    const json = await proxyJSON(url);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/regnskap/:orgnr/historikk', (req, res) => {
  res.status(501).json({ error: 'Maskinporten not configured' });
});

app.listen(PORT, () => {
  console.log(`Proxy running on http://localhost:${PORT}`);
});

