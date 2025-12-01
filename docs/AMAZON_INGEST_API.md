# Amazon Product Ingestion API

**INTERNAL USE ONLY** - This API is for internal use by Apify Actors and should not be exposed publicly.

## Endpoint

```
POST /api/products/amazon/ingest
```

## Authentication

All requests must include an API key in the `X-API-Key` header:

```
X-API-Key: <AMAZON_INGEST_API_KEY>
```

The API key is stored in the environment variable `AMAZON_INGEST_API_KEY` on the server.

## Request Format

The endpoint accepts JSON payloads matching the Apify Actor schema v1.1. The endpoint supports two modes:

1. **Full Product Ingestion** (`data_type: "product_full"` or omitted)
2. **Images-Only Backfill** (`data_type: "images_only"`)

### Required Fields

All requests must include:
- `product.asin` (string) - Amazon Standard Identification Number

### Optional Fields

- `data_type` (string) - Either `"product_full"` or `"images_only"` (defaults to `"product_full"`)
- `schema_version` (string) - Schema version (defaults to `"1.1"`)
- `source.type` (string) - Should be `"apify_actor"` for Apify workflows

## Mode 1: Full Product Ingestion

Use this mode for initial product ingestion or full product updates.

### Request Body Structure

```json
{
  "schema_version": "1.1",
  "data_type": "product_full",
  "locale": "US",
  "marketplace": "amazon.com",
  "scraped_at": "2024-01-15T10:30:00Z",
  "product": {
    "asin": "B08N5WRWNW",
    "url": "https://www.amazon.com/dp/B08N5WRWNW",
    "title": "Product Title",
    "brand": "Brand Name",
    "categories": ["Electronics", "Computers & Accessories", "Laptops"],
    "copy": {
      "short_description": "Short description text",
      "long_description_text": "Long description text",
      "long_description_html": "<p>Long description HTML</p>",
      "bullet_points": [
        "Bullet point 1",
        "Bullet point 2"
      ]
    },
    "media": {
      "primary_image_url": "https://example.com/image.jpg",
      "images": [
        {
          "url": "https://example.com/image1.jpg",
          "variant": "MAIN",
          "width": 1500,
          "height": 1500
        },
        {
          "url": "https://example.com/image2.jpg",
          "variant": "PT01",
          "width": 500,
          "height": 500
        }
      ],
      "videos": []
    },
    "price": {
      "current": 99.99,
      "list": 129.99,
      "currency": "USD",
      "display": "$99.99"
    },
    "availability": {
      "status": "in_stock",
      "text": "In Stock"
    },
    "badges": {
      "is_prime": true,
      "is_best_seller": false,
      "is_amazon_choice": false,
      "has_coupon": false,
      "has_limited_time_deal": false
    },
    "social_proof": {
      "rating": {
        "value": 4.5,
        "scale": 5.0,
        "count": 1234
      }
    },
    "engagement": {
      "customers_usually_keep": {
        "percentage": 85.5,
        "raw": "85%"
      },
      "units_sold": {
        "display": "2K+ bought in past month",
        "numeric_estimate": 2000
      }
    },
    "related_products": {
      "similar_items": [],
      "related_asins": ["B08N5WRWNW", "B08N5WRWNW"]
    }
  },
  "source": {
    "type": "apify_actor",
    "actor": "amazon-scraper",
    "submitted_by": "zhen",
    "ingest_method": "http",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "meta": {
    "scraper_version": "1.0",
    "raw_html_included": false,
    "notes": "Optional notes"
  }
}
```

### Response (Success)

**Status Code:** `201` (created) or `200` (updated)

```json
{
  "success": true,
  "message": "Product data ingested successfully",
  "rawJsonId": "clx1234567890",
  "asin": "B08N5WRWNW",
  "data_type": "product_full",
  "created": true,
  "updated": false
}
```

## Mode 2: Images-Only Backfill

Use this mode to update only the images for an existing product. **The product must already exist in the database.**

### Request Body Structure (Minimal)

```json
{
  "schema_version": "1.1",
  "data_type": "images_only",
  "scraped_at": "2024-01-15T10:30:00Z",
  "product": {
    "asin": "B08N5WRWNW",
    "media": {
      "primary_image_url": "https://example.com/image.jpg",
      "images": [
        {
          "url": "https://example.com/image1.jpg",
          "variant": "MAIN",
          "width": 1500,
          "height": 1500
        },
        {
          "url": "https://example.com/image2.jpg",
          "variant": "PT01",
          "width": 500,
          "height": 500
        }
      ]
    }
  },
  "source": {
    "type": "apify_actor",
    "actor": "amazon-scraper",
    "submitted_by": "zhen",
    "ingest_method": "http",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Response (Success)

**Status Code:** `200`

```json
{
  "success": true,
  "message": "Product images updated successfully",
  "rawJsonId": "clx1234567890",
  "asin": "B08N5WRWNW",
  "data_type": "images_only",
  "updated": true
}
```

### Response (Product Not Found)

**Status Code:** `404`

```json
{
  "error": "Product not found. Cannot update images for non-existent product.",
  "asin": "B08N5WRWNW",
  "data_type": "images_only"
}
```

## Error Responses

### 400 Bad Request

Invalid JSON or missing required fields:

```json
{
  "error": "Missing required field: product.asin"
}
```

Invalid data_type:

```json
{
  "error": "Invalid data_type. Must be \"product_full\" or \"images_only\""
}
```

### 401 Unauthorized

Invalid or missing API key:

```json
{
  "error": "Invalid or missing API key"
}
```

### 500 Internal Server Error

Server error:

```json
{
  "error": "Failed to ingest product data"
}
```

## Image Data Structure

Images should be provided as an array of image objects in `product.media.images`:

```json
{
  "product": {
    "media": {
      "primary_image_url": "https://example.com/main.jpg",
      "images": [
        {
          "url": "https://example.com/image1.jpg",
          "variant": "MAIN",
          "width": 1500,
          "height": 1500,
          "alt": "Product image 1"
        },
        {
          "url": "https://example.com/image2.jpg",
          "variant": "PT01",
          "width": 500,
          "height": 500,
          "alt": "Product image 2"
        }
      ]
    }
  }
}
```

**Note:** The `primary_image_url` will be stored separately as `mainImageUrl`, while the full `images` array will be stored as `allImages` in the database.

## Implementation Notes

1. **Duplicate ASINs:** The endpoint automatically handles duplicate ASINs by updating existing records rather than creating duplicates.

2. **Images-Only Mode:** Only use `images_only` mode for products that already exist in the database. If the product doesn't exist, you'll receive a 404 error.

3. **Raw JSON Storage:** All requests are stored in the `AmazonProductRawJson` table for audit purposes, regardless of mode.

4. **Processing Status:** The raw JSON record status is set to:
   - `"pending"` when first stored
   - `"processed"` after successful processing
   - `"failed"` if processing fails (e.g., product not found for images-only)

## Example cURL Request

### Full Product Ingestion

```bash
curl -X POST https://your-domain.com/api/products/amazon/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "schema_version": "1.1",
    "data_type": "product_full",
    "product": {
      "asin": "B08N5WRWNW",
      "title": "Example Product",
      "media": {
        "primary_image_url": "https://example.com/image.jpg",
        "images": []
      }
    }
  }'
```

### Images-Only Backfill

```bash
curl -X POST https://your-domain.com/api/products/amazon/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY_HERE" \
  -d '{
    "schema_version": "1.1",
    "data_type": "images_only",
    "product": {
      "asin": "B08N5WRWNW",
      "media": {
        "primary_image_url": "https://example.com/image.jpg",
        "images": [
          {
            "url": "https://example.com/image1.jpg",
            "variant": "MAIN",
            "width": 1500,
            "height": 1500
          }
        ]
      }
    }
  }'
```

## Next Steps for Image Backfill

1. Query all ASINs from the database
2. For each ASIN, call the ingestion endpoint with `data_type: "images_only"`
3. Include the complete image array from the Apify Actor
4. Handle 404 errors gracefully (product may have been deleted)

