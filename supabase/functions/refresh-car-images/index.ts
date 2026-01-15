import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseMakeModel(title: string) {
  const cleaned = title.replace(/\b(19|20)\d{2}\b/, '').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ').filter(Boolean);
  const make = parts.shift() ?? 'car';
  const model = parts.slice(0, 3).join(' ') || 'car';
  return { make, model };
}

function parseYear(title: string) {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

function buildImageUrl(title: string) {
  const { make, model } = parseMakeModel(title);
  const year = parseYear(title);
  const query = [year, make, model, 'car'].filter(Boolean).join(' ');
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      .select('id, title')
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

    const updates = listings.map((listing) => ({
      id: listing.id,
      background_image_url: buildImageUrl(listing.title || 'car'),
    }));

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
          message: `Updated ${updated} listings with make/model-aware images.`,
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
