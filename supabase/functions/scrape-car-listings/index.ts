import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CarListing {
  title: string;
  price: number;
  year: number;
  mileage: number;
  transmission: string;
  fuel_type: string;
  brand: string;
  image_url: string;
  location: string;
  source_url: string;
  description: string;
}

const SITE_CONFIGS = {
  webuycars: {
    searchUrl: 'https://www.webuycars.co.za/buy-a-car',
    name: 'WeBuyCars',
  },
  carsza: {
    searchUrl: 'https://www.cars.co.za/usedcars',
    name: 'Cars.co.za',
  },
  autotrader: {
    searchUrl: 'https://www.autotrader.co.za/cars-for-sale',
    name: 'AutoTrader',
  },
};

// Map brand names to our category values
const BRAND_MAPPING: Record<string, string> = {
  'toyota': 'toyota',
  'volkswagen': 'volkswagen',
  'vw': 'volkswagen',
  'mazda': 'mazda',
  'hyundai': 'hyundai',
  'bmw': 'bmw',
  'mercedes': 'mercedes',
  'mercedes-benz': 'mercedes',
  'ford': 'ford',
  'nissan': 'nissan',
  'honda': 'honda',
  'audi': 'audi',
  'kia': 'kia',
};

function detectBrand(title: string): string {
  const lowerTitle = title.toLowerCase();
  for (const [key, value] of Object.entries(BRAND_MAPPING)) {
    if (lowerTitle.includes(key)) {
      return value;
    }
  }
  return 'other';
}

function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9]/g, '');
  return parseInt(cleaned) || 0;
}

function parseYear(text: string): number {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0]) : new Date().getFullYear();
}

function parseMileage(text: string): number {
  const match = text.match(/(\d[\d\s]*)\s*(km|kilometers?)/i);
  if (match) {
    return parseInt(match[1].replace(/\s/g, ''));
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { site, limit = 50 } = await req.json();

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const siteConfig = SITE_CONFIGS[site as keyof typeof SITE_CONFIGS];
    if (!siteConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid site specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping ${limit} listings from ${siteConfig.name}...`);

    // Use Firecrawl to scrape the listings page with JSON extraction
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: siteConfig.searchUrl,
        formats: [{
          type: 'json',
          prompt: `Extract up to ${limit} car listings from this page. For each listing extract: title (full car name with year, make, model), price (as a number in Rands), year (4 digit year), mileage (in kilometers as a number), transmission (manual/automatic), fuel_type (petrol/diesel/hybrid/electric), location (city or area), image_url (main car image), and source_url (link to the listing).`,
          schema: {
            type: 'object',
            properties: {
              listings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    price: { type: 'number' },
                    year: { type: 'number' },
                    mileage: { type: 'number' },
                    transmission: { type: 'string' },
                    fuel_type: { type: 'string' },
                    location: { type: 'string' },
                    image_url: { type: 'string' },
                    source_url: { type: 'string' },
                  },
                  required: ['title', 'price'],
                },
              },
            },
          },
        }],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('Firecrawl error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape listings' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the extracted listings
    const extractedListings = scrapeData.data?.json?.listings || [];
    console.log(`Extracted ${extractedListings.length} listings`);

    if (extractedListings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { inserted: 0, message: 'No listings found to import' } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Transform and insert listings
    const vehiclesToInsert = extractedListings.slice(0, limit).map((listing: any) => ({
      title: listing.title || 'Unknown Vehicle',
      description: `${listing.title}. Listed on ${siteConfig.name}.`,
      date: new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: 'Scraped',
      address: listing.location || 'South Africa',
      background_image_url: listing.image_url || 'https://via.placeholder.com/400x300?text=No+Image',
      target_date: new Date().toISOString(),
      creator: siteConfig.name,
      category: detectBrand(listing.title || ''),
      country: 'South Africa',
      city: listing.location || null,
      ticket_price: listing.price || 0,
      year: listing.year || parseYear(listing.title || ''),
      mileage: listing.mileage || 0,
      transmission: (listing.transmission || 'manual').toLowerCase(),
      fuel_type: (listing.fuel_type || 'petrol').toLowerCase(),
      condition: 'good',
      source_url: listing.source_url || siteConfig.searchUrl,
      is_scraped: true,
      created_by: '00000000-0000-0000-0000-000000000000', // System user
    }));

    // Check for duplicates by source_url
    const sourceUrls = vehiclesToInsert.map((v: any) => v.source_url).filter(Boolean);
    const { data: existingListings } = await supabase
      .from('events')
      .select('source_url')
      .in('source_url', sourceUrls);

    const existingUrls = new Set(existingListings?.map((l: any) => l.source_url) || []);
    const newVehicles = vehiclesToInsert.filter((v: any) => !existingUrls.has(v.source_url));

    if (newVehicles.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: { inserted: 0, message: 'All listings already exist' } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('events')
      .insert(newVehicles)
      .select('id');

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${insertedData?.length || 0} new listings`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          inserted: insertedData?.length || 0,
          skipped: vehiclesToInsert.length - newVehicles.length,
          message: `Imported ${insertedData?.length || 0} new listings from ${siteConfig.name}` 
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-car-listings:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
