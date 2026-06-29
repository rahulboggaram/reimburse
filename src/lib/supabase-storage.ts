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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .download(objectPath);

  if (error || !data) {
    throw new Error(error?.message || "Receipt file missing from storage.");
  }

  return Buffer.from(await data.arrayBuffer());
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
