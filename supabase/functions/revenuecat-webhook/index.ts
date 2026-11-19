// Supabase Edge Function: keeps profiles.is_premium in sync with RevenueCat so the server-side
// free-tier limit (25 places) is lifted for paying users.
//
// Deploy:   supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secrets:  supabase secrets set RC_WEBHOOK_AUTH="<a long random string>"
// RevenueCat dashboard -> Integrations -> Webhooks: URL = https://<project>.supabase.co/functions/v1/revenuecat-webhook
//           Authorization header value = the same random string.
// The app logs into RevenueCat with the Supabase user id, so event.app_user_id == profiles.id.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GRANT = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'TEMPORARY_ENTITLEMENT_GRANT']);
const REVOKE = new Set(['EXPIRATION', 'REFUND']); // CANCELLATION keeps access until the period ends -> wait for EXPIRATION

Deno.serve(async (req) => {
  if (req.headers.get('Authorization') !== Deno.env.get('RC_WEBHOOK_AUTH')) return new Response('unauthorized', { status: 401 });
  const { event } = await req.json();
  const uid: string | undefined = event?.app_user_id;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return new Response('ignored', { status: 200 });
  let value: boolean | null = null;
  if (GRANT.has(event.type)) value = true;
  else if (REVOKE.has(event.type)) value = false;
  if (value === null) return new Response('ignored', { status: 200 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await sb.from('profiles').update({ is_premium: value }).eq('id', uid);
  if (error) return new Response(error.message, { status: 500 });
  return new Response('ok', { status: 200 });
});
