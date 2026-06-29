import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const RECEIPTS_BUCKET = "receipts";

let adminClient: SupabaseClient | null = null;

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function serviceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    ""
  );
}

function isLegacyJwtKey(key: string) {
  return key.startsWith("eyJ");
}

function storageAuthHeaders() {
  const key = serviceRoleKey();
  const headers: Record<string, string> = { apikey: key };
  // New sb_secret_ keys must use apikey only — Bearer treats them as JWTs and fails.
  if (isLegacyJwtKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function encodeObjectPath(objectPath: string) {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function downloadReceiptObjectViaFetch(objectPath: string) {
  const url = `${supabaseUrl()}/storage/v1/object/${RECEIPTS_BUCKET}/${encodeObjectPath(objectPath)}`;
  const response = await fetch(url, {
    headers: storageAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.trim() ||
        `Receipt file missing from storage (${response.status}).`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Receipt file in storage is empty.");
  }

  return buffer;
}

async function uploadReceiptObjectViaFetch(
  objectPath: string,
  buffer: Buffer,
  mimeType: string,
) {
  const url = `${supabaseUrl()}/storage/v1/object/${RECEIPTS_BUCKET}/${encodeObjectPath(objectPath)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...storageAuthHeaders(),
      "Content-Type": mimeType || "application/octet-stream",
      "x-upsert": "true",
      "cache-control": "max-age=3600",
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body.trim() || `Could not upload receipt (${response.status}).`);
  }
}

export function isSupabaseStorageEnabled() {
  return Boolean(supabaseUrl() && serviceRoleKey());
}

function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Supabase Storage is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

/** Object key inside the receipts bucket, e.g. claimId/uuid.jpg */
export function buildReceiptObjectPath(
  reimbursementId: string,
  storedName: string,
) {
  return `${reimbursementId}/${storedName}`;
}

export async function uploadReceiptObject(
  objectPath: string,
  buffer: Buffer,
  mimeType: string,
) {
  const key = serviceRoleKey();
  if (!isLegacyJwtKey(key)) {
    await uploadReceiptObjectViaFetch(objectPath, buffer, mimeType);
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).upload(
    objectPath,
    buffer,
    {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
      cacheControl: "3600",
    },
  );

  if (error) {
    throw new Error(error.message || "Could not upload receipt to storage.");
  }
}

export async function downloadReceiptObject(objectPath: string) {
  const key = serviceRoleKey();
  if (!isLegacyJwtKey(key)) {
    return downloadReceiptObjectViaFetch(objectPath);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .download(objectPath);

  if (error || !data) {
    try {
      return await downloadReceiptObjectViaFetch(objectPath);
    } catch (fetchErr) {
      console.error("receipt storage download failed", {
        objectPath,
        sdkError: error?.message,
        fetchErr,
      });
      throw new Error(error?.message || "Receipt file missing from storage.");
    }
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error("Receipt file in storage is empty.");
  }

  return buffer;
}

export async function deleteReceiptObjects(objectPaths: string[]) {
  if (objectPaths.length === 0) return;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .remove(objectPaths);

  if (error) {
    console.error("receipt storage delete failed", { objectPaths, error });
  }
}
