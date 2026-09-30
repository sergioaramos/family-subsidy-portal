// Prueba técnica R-3 (T8). Temporal: se borra en T9.
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { Amplify } from 'aws-amplify';
import { signIn, signOut, confirmSignIn, fetchAuthSession, setUpTOTP, verifyTOTPSetup, updateMFAPreference } from 'aws-amplify/auth';

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
Amplify.configure(outputs);
const { SPIKE_C_EMAIL: email, SPIKE_C_PASSWORD: password } = process.env;

// TOTP RFC 6238 (lo mismo que calcula una app autenticadora)
function base32(s) { const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = ''; for (const c of s.replace(/=+$/, '')) bits += al.indexOf(c).toString(2).padStart(5, '0'); return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2))); }
function totp(secret, t = Date.now()) { const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(t / 30000))); const h = createHmac('sha1', base32(secret)).update(buf).digest(); const o = h[h.length - 1] & 0xf; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
const esperarSiguienteVentana = () => new Promise((r) => setTimeout(r, 30000 - (Date.now() % 30000) + 1000));

async function estado(etiqueta) {
  const { tokens } = await fetchAuthSession({ forceRefresh: true });
  const r = await fetch(outputs.data.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: tokens.accessToken.toString() }, body: JSON.stringify({ query: '{ listSpikeFuncionarios { items { id } } }' }) }).then((x) => x.json());
  return { etiqueta, grupos_access: tokens.accessToken.payload['cognito:groups'] ?? [], grupos_id: tokens.idToken.payload['cognito:groups'] ?? [], requiere_mfa: tokens.idToken.payload.requiere_mfa ?? null, consulta_funcionario: r.errors ? r.errors.map((e) => e.errorType ?? e.message) : 'OK' };
}

const res = [];
await signOut().catch(() => {});
const s1 = await signIn({ username: email, password });
res.push({ paso: '1er ingreso', nextStep: s1.nextStep.signInStep });
res.push(await estado('sin TOTP'));

const { sharedSecret } = await setUpTOTP();
await verifyTOTPSetup({ code: totp(sharedSecret) });
await updateMFAPreference({ totp: 'PREFERRED' });
res.push({ paso: 'TOTP configurado y preferido' });

await signOut();
await esperarSiguienteVentana();
const s2 = await signIn({ username: email, password });
res.push({ paso: '2do ingreso', nextStep: s2.nextStep.signInStep });
if (s2.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
  const s3 = await confirmSignIn({ challengeResponse: totp(sharedSecret) });
  res.push({ paso: 'código TOTP enviado', nextStep: s3.nextStep.signInStep });
}
res.push(await estado('con TOTP'));
console.log(JSON.stringify(res, null, 2));
await signOut();
