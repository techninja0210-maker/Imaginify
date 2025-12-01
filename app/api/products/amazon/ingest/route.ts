import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { processFullProduct, processImagesOnly } from "@/lib/services/amazon-product-processor";

/**
 * POST /api/products/amazon/ingest
 * INTERNAL USE ONLY - Not for public documentation
 * 
 * Receives Amazon product JSON from internal Apify Actor workflow
 * 
 * Authentication: API Key via X-API-Key header
 * Environment Variable: AMAZON_INGEST_API_KEY
 * 
 * Request Body: JSON payload matching schema v1.1
 * 
 * Required Fields:
 * - product.asin (string)
 * - data_type (optional): "product_full" | "images_only" (defaults to "product_full")
 * 
 * For "product_full": Full product JSON with all fields
 * For "images_only": JSON with product.asin and product.media.images
 * 
 * Response:
 * - 200/201: Successfully processed
 * - 400: Invalid JSON or missing required fields
 * - 401: Invalid/missing API key
 * - 404: Product not found (for images_only mode)
 * - 500: Server error
 * 
 * SECURITY NOTE: This endpoint is for internal use only.
 * Never expose the URL or API key in public Apify Actor deployments.
 */
export async function POST(req: NextRequest) {
  try {
    // Validate API Key
    const apiKey = req.headers.get("X-API-Key");
    const expectedApiKey = process.env.AMAZON_INGEST_API_KEY;

    if (!expectedApiKey) {
      console.error("[AMAZON_INGEST] AMAZON_INGEST_API_KEY not configured");
      return NextResponse.json(
        { error: "API key not configured on server" },
        { status: 500 }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json(
        { error: "Invalid or missing API key" },
        { status: 401 }
      );
    }

    // Parse JSON
    let jsonData: any;
    try {
      jsonData = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!jsonData.product || !jsonData.product.asin) {
      return NextResponse.json(
        { error: "Missing required field: product.asin" },
        { status: 400 }
      );
    }

    const asin = jsonData.product.asin;
    const schemaVersion = jsonData.schema_version || "1.1";
    const dataType = jsonData.data_type || "product_full";
    
    // Validate data_type
    if (dataType !== "product_full" && dataType !== "images_only") {
      return NextResponse.json(
        { error: 'Invalid data_type. Must be "product_full" or "images_only"' },
        { status: 400 }
      );
    }
    
    // Determine source based on request headers or JSON data
    const source = jsonData.source?.type === "apify_actor" 
      ? "apify_actor" 
      : "browser_extension";

    // Store raw JSON in AmazonProductRawJson table
    // Note: Multiple records per ASIN are allowed for historical tracking
    const rawJsonRecord = await prisma.amazonProductRawJson.create({
      data: {
        asin,
        source,
        schemaVersion,
        json: jsonData,
        status: "pending",
      },
    });

    // Process based on data_type
    let processResult;
    if (dataType === "images_only") {
      // Images-only mode: update only image fields
      processResult = await processImagesOnly(jsonData);
      
      if (!processResult.productExists) {
        // Update raw JSON status to indicate product doesn't exist
        await prisma.amazonProductRawJson.update({
          where: { id: rawJsonRecord.id },
          data: { status: "failed" },
        });
        
        return NextResponse.json(
          {
            error: "Product not found. Cannot update images for non-existent product.",
            asin,
            data_type: dataType,
          },
          { status: 404 }
        );
      }
      
      // Update raw JSON status
      await prisma.amazonProductRawJson.update({
        where: { id: rawJsonRecord.id },
        data: { status: "processed" },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Product images updated successfully",
          rawJsonId: rawJsonRecord.id,
          asin,
          data_type: dataType,
          updated: processResult.updated,
        },
        { status: 200 }
      );
    } else {
      // Full product mode: process complete product data
      processResult = await processFullProduct(jsonData);
      
      // Update raw JSON status
      await prisma.amazonProductRawJson.update({
        where: { id: rawJsonRecord.id },
        data: { status: "processed" },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Product data ingested successfully",
          rawJsonId: rawJsonRecord.id,
          asin,
          data_type: dataType,
          created: processResult.created,
          updated: processResult.updated,
        },
        { status: processResult.created ? 201 : 200 }
      );
    }
  } catch (error: any) {
    console.error("[AMAZON_INGEST] Error:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to ingest product data",
      },
      { status: 500 }
    );
  }
}

// GET endpoint removed for security - do not expose endpoint information publicly



