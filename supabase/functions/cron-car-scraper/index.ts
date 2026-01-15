import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_CONFIGS = {
  carfind: {
    baseUrl: 'https://www.carfind.co.za',
    searchUrl: 'https://www.carfind.co.za/used-cars',
    name: 'CarFind',
  },
  surf4cars: {
    baseUrl: 'https://www.surf4cars.co.za',
    searchUrl: 'https://www.surf4cars.co.za/used-cars-for-sale-in-south-africa',
    name: 'Surf4Cars',
  },
  autotrader: {
    baseUrl: 'https://www.autotrader.co.za',
    searchUrl: 'https://www.autotrader.co.za/cars-for-sale',
    name: 'AutoTrader',
  },
  webuycars: {
    baseUrl: 'https://www.webuycars.co.za',
    searchUrl: 'https://www.webuycars.co.za/buy-a-car',
    name: 'WeBuyCars',
  },
  carscoza: {
    baseUrl: 'https://www.cars.co.za',
    searchUrl: 'https://www.cars.co.za/usedcars',
    name: 'Cars.co.za',
  },
};

const BRAND_MAPPING: Record<string, string> = {
  toyota: 'toyota',
  volkswagen: 'volkswagen',
  vw: 'volkswagen',
  mazda: 'mazda',
  hyundai: 'hyundai',
  bmw: 'bmw',
  mercedes: 'mercedes',
  'mercedes-benz': 'mercedes',
  ford: 'ford',
  nissan: 'nissan',
  honda: 'honda',
  audi: 'audi',
  kia: 'kia',
  chevrolet: 'chevrolet',
  opel: 'opel',
  renault: 'renault',
  suzuki: 'suzuki',
  isuzu: 'isuzu',
  jeep: 'jeep',
  volvo: 'volvo',
  peugeot: 'peugeot',
  mitsubishi: 'mitsubishi',
  subaru: 'subaru',
  lexus: 'lexus',
  jaguar: 'jaguar',
  mini: 'mini',
  haval: 'haval',
  gwm: 'gwm',
  chery: 'chery',
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

function parseMakeModel(title: string) {
  const cleaned = title.replace(/\b(19|20)\d{2}\b/, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const make = parts.shift() ?? 'car';
  const model = parts.join(' ') || 'car';
  return { make, model };
}

function ensureAbsoluteUrl(url: string | null | undefined, baseUrl: string) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${baseUrl}${url}`;
  return url;
}

function resolveImageUrl(title: string, imageUrl: string | null | undefined, baseUrl: string) {
  const absolute = ensureAbsoluteUrl(imageUrl, baseUrl);
  if (absolute) return absolute;
  const { make, model } = parseMakeModel(title);
  return `https://source.unsplash.com/800x600/?${encodeURIComponent(`${make} ${model} car`)}`;
}

async function scrapeFromSite(
  siteKey: keyof typeof SITE_CONFIGS,
  firecrawlKey: string,
  limit: number,
) {
  const siteConfig = SITE_CONFIGS[siteKey];
  console.log(`Scraping ${limit} listings from ${siteConfig.name}...`);

  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firecrawlKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: siteConfig.searchUrl,
      formats: ['extract'],
      extract: {
        prompt: `Extract up to ${limit} used or preowned car listings from this page. For each listing extract: title (full car name with year, make, model), price (as a number in Rands without currency symbols), year (4 digit year), mileage (in kilometers as a number without 'km'), transmission (manual or automatic), fuel_type (petrol, diesel, hybrid, or electric), location (city or area), image_url (main car image URL), and source_url (direct link to the listing).`,
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
                required: ['title', 'source_url'],
              },
            },
          },
        },
      },
      waitFor: 4000,
      onlyMainContent: true,
    }),
  });

  const scrapeData = await scrapeResponse.json();
  if (!scrapeResponse.ok || !scrapeData.success) {
    console.error(`Firecrawl error for ${siteConfig.name}:`, scrapeData);
    return [];
  }

  const listings = scrapeData.data?.extract?.listings || [];
  console.log(`Extracted ${listings.length} listings from ${siteConfig.name}`);

  return listings.slice(0, limit).map((listing: any) => ({
    title: listing.title || 'Unknown Vehicle',
    price: listing.price || 0,
    year: listing.year || new Date().getFullYear(),
    mileage: listing.mileage || 0,
    transmission: (listing.transmission || 'manual').toLowerCase(),
    fuel_type: (listing.fuel_type || 'petrol').toLowerCase(),
    location: listing.location || 'South Africa',
    image_url: resolveImageUrl(
      listing.title || 'Unknown Vehicle',
      listing.image_url,
      siteConfig.baseUrl,
    ),
    source_url: ensureAbsoluteUrl(listing.source_url, siteConfig.baseUrl) || siteConfig.searchUrl,
    site_name: siteConfig.name,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let requestedLimit = 25;
    try {
      const body = await req.json();
      requestedLimit = body.limit || 25;
    } catch {
      // Use default
    }

    const totalLimit = Math.max(25, requestedLimit);
    const sites = Object.keys(SITE_CONFIGS) as Array<keyof typeof SITE_CONFIGS>;
    const limitPerSite = Math.ceil(totalLimit / sites.length) + 2;

    const scrapeResults = await Promise.all(
      sites.map((site) => scrapeFromSite(site, firecrawlKey, limitPerSite)),
    );

    const allListings = scrapeResults.flat();
    const uniqueBySource = new Map<string, any>();
    for (const listing of allListings) {
      if (listing.source_url && !uniqueBySource.has(listing.source_url)) {
        uniqueBySource.set(listing.source_url, listing);
      }
    }

    const curatedListings = Array.from(uniqueBySource.values()).slice(0, totalLimit);
    if (curatedListings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { inserted: 0, message: 'No listings found to import' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const sourceUrls = curatedListings.map((listing) => listing.source_url).filter(Boolean);
    const { data: existingListings } = await supabase
      .from('events')
      .select('source_url')
      .in('source_url', sourceUrls);

    const existingUrls = new Set(existingListings?.map((item: any) => item.source_url) || []);
    const newListings = curatedListings.filter((listing) => !existingUrls.has(listing.source_url));

    if (newListings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, data: { inserted: 0, message: 'All listings already exist' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const vehiclesToInsert = newListings.map((listing) => ({
      title: listing.title,
      description: `${listing.title}. Listed on ${listing.site_name}.`,
      date: formattedDate,
      time: 'Available Now',
      address: listing.location,
      background_image_url: listing.image_url,
      target_date: now.toISOString(),
      creator: listing.site_name,
      category: detectBrand(listing.title),
      country: 'South Africa',
      city: listing.location,
      ticket_price: listing.price,
      year: listing.year,
      mileage: listing.mileage,
      transmission: listing.transmission,
      fuel_type: listing.fuel_type,
      condition: 'good',
      source_url: listing.source_url,
      is_scraped: true,
      created_by: null,
    }));

    const batchSize = 20;
    let totalInserted = 0;

    for (let i = 0; i < vehiclesToInsert.length; i += batchSize) {
      const batch = vehiclesToInsert.slice(i, i + batchSize);
      const { data: insertedData, error } = await supabase
        .from('events')
        .insert(batch)
        .select('id');

      if (error) {
        console.error('Insert error:', error);
      } else {
        totalInserted += insertedData?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          inserted: totalInserted,
          total_scraped: curatedListings.length,
          sites: sites.length,
          message: `Imported ${totalInserted} new used car listings from ${sites.length} sites.`,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in cron-car-scraper:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
