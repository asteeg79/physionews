/**
 * Push-Subscriptions — `data/push-subscriptions.enc.json`, verschlüsselt.
 *
 * Warum verschlüsselt: Dieses Repository ist öffentlich. Eine Web-Push-
 * Subscription besteht aus Endpoint plus den Schlüsseln `p256dh` und
 * `auth` — wer sie hat, kann Benachrichtigungen auf das Gerät schicken.
 * Im Klartext committet wäre das für jeden lesbar.
 *
 * Verfahren: AES-256-GCM mit dem Schlüssel aus `PUSH_STORE_KEY`
 * (32 Byte, hex oder base64). Die Variable muss an zwei Stellen liegen:
 *  - Vercel-Env  → die App schreibt beim An-/Abmelden
 *  - GitHub-Secret → die Pipeline liest beim Versenden
 *
 * Erzeugen: `openssl rand -hex 32`
 *
 * Ohne Schlüssel bleibt die Datei ungenutzt: Lesen liefert eine leere
 * Liste, Schreiben schlägt mit einer klaren Meldung fehl — statt die
 * Schlüssel versehentlich im Klartext zu committen.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { PushSubscriptionRecord } from './types';
import { readJson, writeJson, toRequiredDate } from './json-store';

const FILE = 'push-subscriptions.enc.json';

/** Rohformat in der Datei — Zeitpunkte als ISO-String. */
interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface EncryptedEnvelope {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

export class PushStoreKeyMissingError extends Error {
  constructor() {
    super(
      'PUSH_STORE_KEY fehlt — Push-Subscriptions können ohne Schlüssel nicht gespeichert werden.'
    );
    this.name = 'PushStoreKeyMissingError';
  }
}

/** Liest den 32-Byte-Schlüssel aus der Umgebung, oder `null`. */
function readKey(): Buffer | null {
  const raw = process.env.PUSH_STORE_KEY;
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `PUSH_STORE_KEY muss 32 Byte lang sein (64 Hex-Zeichen), ist aber ${key.length} Byte.`
    );
  }
  return key;
}

/** Ist der Push-Speicher nutzbar? */
export function isPushStoreConfigured(): boolean {
  return readKey() !== null;
}

function encrypt(plaintext: string, key: Buffer): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

function decrypt(envelope: EncryptedEnvelope, key: Buffer): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(envelope.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, 'base64')),
    decipher.final(),
  ]).toString('utf-8');
}

/**
 * Alle hinterlegten Subscriptions.
 * Leere Liste, wenn kein Schlüssel gesetzt oder die Datei nicht lesbar ist.
 */
export async function listPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const key = readKey();
  if (!key) return [];

  const envelope = await readJson<EncryptedEnvelope | null>(FILE, null);
  if (!envelope) return [];

  let stored: StoredSubscription[];
  try {
    stored = JSON.parse(decrypt(envelope, key)) as StoredSubscription[];
  } catch (err) {
    console.error(
      '[PushStore] Datei konnte nicht entschlüsselt werden — passt PUSH_STORE_KEY?',
      err
    );
    return [];
  }

  return stored.map((s) => ({
    endpoint: s.endpoint,
    keys: s.keys,
    userAgent: s.userAgent ?? null,
    createdAt: toRequiredDate(s.createdAt),
    lastSeenAt: toRequiredDate(s.lastSeenAt),
  }));
}

async function save(subscriptions: PushSubscriptionRecord[], message: string): Promise<void> {
  const key = readKey();
  if (!key) throw new PushStoreKeyMissingError();

  const stored: StoredSubscription[] = subscriptions.map((s) => ({
    endpoint: s.endpoint,
    keys: s.keys,
    userAgent: s.userAgent,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
  }));

  await writeJson(FILE, encrypt(JSON.stringify(stored), key), message);
}

/** Meldet ein Gerät an — bereits bekannte Endpoints werden aufgefrischt. */
export async function upsertPushSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}): Promise<void> {
  const subscriptions = await listPushSubscriptions();
  const now = new Date();
  const existing = subscriptions.findIndex((s) => s.endpoint === input.endpoint);

  if (existing === -1) {
    subscriptions.push({
      endpoint: input.endpoint,
      keys: input.keys,
      userAgent: input.userAgent ?? null,
      createdAt: now,
      lastSeenAt: now,
    });
  } else {
    subscriptions[existing] = {
      ...subscriptions[existing],
      keys: input.keys,
      userAgent: input.userAgent ?? subscriptions[existing].userAgent,
      lastSeenAt: now,
    };
  }

  await save(subscriptions, 'chore(data): Push-Subscription gespeichert');
}

/** Meldet ein Gerät ab. `false`, wenn der Endpoint nicht hinterlegt war. */
export async function removePushSubscription(endpoint: string): Promise<boolean> {
  const subscriptions = await listPushSubscriptions();
  const remaining = subscriptions.filter((s) => s.endpoint !== endpoint);
  if (remaining.length === subscriptions.length) return false;
  await save(remaining, 'chore(data): Push-Subscription entfernt');
  return true;
}

/** Entfernt mehrere Endpoints auf einmal (abgelaufene Subscriptions). */
export async function removePushSubscriptions(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const drop = new Set(endpoints);
  const subscriptions = await listPushSubscriptions();
  const remaining = subscriptions.filter((s) => !drop.has(s.endpoint));
  if (remaining.length === subscriptions.length) return;
  await save(remaining, 'chore(data): abgelaufene Push-Subscriptions entfernt');
}
