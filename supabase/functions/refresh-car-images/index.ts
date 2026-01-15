import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLOCKED_IMAGE_HOSTS = new Set([
  'source.unsplash.com',
  'images.unsplash.com',
  'via.placeholder.com',
  'placehold.co',
]);

function resolveImageUrl(imageUrl: string, sourceUrl: string) {
  try {
    return new URL(imageUrl, sourceUrl).toString();
  } catch {
    return null;
  }
}

function isRealImageUrl(imageUrl: string | null) {
  if (!imageUrl) return false;
  try {
    const parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_IMAGE_HOSTS.has(hostname)) return false;
    for (const blocked of BLOCKED_IMAGE_HOSTS) {
      if (hostname.endsWith(`.${blocked}`)) return false;
    }
    if (imageUrl.toLowerCase().includes('placeholder')) return false;
    return true;
  } catch {
    return false;
  }
}

function extractImageUrl(extracted: unknown) {
  if (typeof extracted === 'string') return extracted;
  if (Array.isArray(extracted)) {
    return extracted.find((item) => typeof item === 'string') ?? null;
  }
  return null;
}

async function fetchListingImage(sourceUrl: string, firecrawlKey: string) {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: sourceUrl,
      formats: ['extract'],
      extract: {
        prompt:
          'Extract the main vehicle listing image URL from this page. Return only a direct image URL if present.',
        schema: {
          type: 'object',
          properties: {
            image_url: { type: 'string' },
          },
        },
      },
      waitFor: 3000,
      onlyMainContent: true,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    console.error('Firecrawl scrape error:', payload);
    return null;
  }

  const extracted = extractImageUrl(payload?.data?.extract?.image_url);
  if (!extracted) return null;
  const resolved = resolveImageUrl(extracted, sourceUrl);
  return isRealImageUrl(resolved) ? resolved : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let limit = 500;
    try {
      const body = await req.json();
      limit = body.limit || 500;
    } catch {
      // defaults
    }

    const { data: listings, error } = await supabase
      .from('events')
      .select('id, title, source_url, background_image_url')
      .eq('is_scraped', true)
      .limit(limit);

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { updated: 0, message: 'No listings found to update' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const updates = [];
    for (const listing of listings) {
      if (!listing.source_url) continue;
      const imageUrl = await fetchListingImage(listing.source_url, firecrawlKey);
      if (!imageUrl) continue;
      if (listing.background_image_url === imageUrl) continue;
      updates.push({
        id: listing.id,
        background_image_url: imageUrl,
      });
    }

    const batchSize = 50;
    let updated = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const { data: updatedRows, error: updateError } = await supabase
        .from('events')
        .upsert(batch, { onConflict: 'id' })
        .select('id');

      if (updateError) {
        console.error('Update error:', updateError);
      } else {
        updated += updatedRows?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          updated,
          message: `Updated ${updated} listings with verified listing images.`,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in refresh-car-images:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
