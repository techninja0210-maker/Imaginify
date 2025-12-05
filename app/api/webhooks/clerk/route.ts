/* eslint-disable camelcase */
import { clerkClient } from "@clerk/nextjs";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createUser, deleteUser, updateUser } from "@/lib/actions/user.actions";
import { requireGmailEmail } from "@/lib/utils";
import { prisma } from "@/lib/database/prisma";

export async function POST(req: Request) {
  console.log("[CLERK WEBHOOK] Webhook received at:", new Date().toISOString());
  
  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("[CLERK WEBHOOK] WEBHOOK_SECRET not configured!");
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`[CLERK WEBHOOK] Processing event: ${eventType} for user: ${id}`);

  // CREATE
  if (eventType === "user.created") {
    const { id, email_addresses, image_url, first_name, last_name, username } = evt.data;

    // Log full webhook data for debugging (sanitized)
    console.log("[CLERK WEBHOOK] user.created event data:", {
      id,
      hasEmail: !!email_addresses?.[0]?.email_address,
      hasImage: !!image_url,
      hasFirstName: !!first_name,
      hasLastName: !!last_name,
      hasUsername: !!username,
      emailCount: email_addresses?.length || 0,
    });

    // Get primary email address
    const primaryEmail = email_addresses?.[0]?.email_address;
    
    if (!primaryEmail) {
      console.error("[CLERK WEBHOOK] No email address found for user:", id);
      // Delete the user in Clerk since we can't create them without an email
      try {
        await clerkClient.users.deleteUser(id);
      } catch (deleteError) {
        console.error("[CLERK WEBHOOK] Failed to delete user without email:", deleteError);
      }
      return NextResponse.json(
        { error: "Email address is required" },
        { status: 400 }
      );
    }

    // Validate Gmail-only sign-in
    try {
      requireGmailEmail(primaryEmail, "user creation");
    } catch (gmailError: any) {
      console.error("[CLERK WEBHOOK] Non-Gmail sign-up attempt:", primaryEmail);
      
      // Delete the user in Clerk since they're not allowed
      try {
        await clerkClient.users.deleteUser(id);
        console.log("[CLERK WEBHOOK] Deleted non-Gmail user:", id);
      } catch (deleteError) {
        console.error("[CLERK WEBHOOK] Failed to delete non-Gmail user:", deleteError);
      }
      
      return NextResponse.json(
        { 
          error: gmailError.message || "Only Gmail accounts are allowed",
          rejected: true,
          email: primaryEmail
        },
        { status: 403 }
      );
    }

    // Generate username if not provided by Clerk
    // Username is required in database, but Clerk doesn't always provide it for email/password sign-ups
    let generatedUsername = username?.trim();
    if (!generatedUsername || generatedUsername.length === 0) {
      // Try to use email prefix (before @) as username, fallback to Clerk ID
      const emailPrefix = primaryEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 20);
      // Ensure uniqueness by appending part of Clerk ID
      if (emailPrefix.length > 0) {
        generatedUsername = `${emailPrefix}_${id.slice(0, 4)}`;
      } else {
        // Fallback if email prefix is empty or invalid
        generatedUsername = `user_${id.slice(0, 12)}`;
      }
      console.log("[CLERK WEBHOOK] Generated username:", generatedUsername);
    } else {
      console.log("[CLERK WEBHOOK] Using username from Clerk:", generatedUsername);
    }
    
    // Ensure photo is set (required in database)
    // Clerk may not provide photo for email/password sign-ups
    let userPhoto = image_url?.trim();
    if (!userPhoto || userPhoto.length === 0) {
      // Generate a default avatar using the email
      const emailHash = Buffer.from(primaryEmail.toLowerCase()).toString('base64').slice(0, 10);
      userPhoto = `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailHash}`;
      console.log("[CLERK WEBHOOK] Generated default photo URL");
    } else {
      console.log("[CLERK WEBHOOK] Using photo from Clerk");
    }

    const user = {
      clerkId: id,
      email: primaryEmail,
      username: generatedUsername,
      // Set default values "User" and "Name" if first_name/last_name are not provided
      firstName: first_name || 'User',
      lastName: last_name || 'Name',
      photo: userPhoto,
    };

    console.log("[CLERK WEBHOOK] Creating user:", {
      clerkId: id,
      email: primaryEmail,
      username: generatedUsername,
      hasUsernameFromClerk: !!username,
    });

    let newUser;
    try {
      newUser = await createUser(user);
      
      if (!newUser) {
        throw new Error("createUser returned null or undefined");
      }
      
      console.log("[CLERK WEBHOOK] User created successfully:", {
        userId: newUser?.id,
        clerkId: id,
        email: primaryEmail,
        username: generatedUsername
      });
    } catch (createError: any) {
      // Log detailed error information
      const errorMessage = createError?.message || "Unknown error";
      const errorStack = createError?.stack;
      const errorCode = createError?.code;
      
      console.error("[CLERK WEBHOOK] Failed to create user in database:", {
        error: errorMessage,
        code: errorCode,
        clerkId: id,
        email: primaryEmail,
        username: generatedUsername,
        stack: errorStack?.split('\n').slice(0, 5).join('\n'), // First 5 lines of stack
      });
      
      // Delete the user in Clerk if database save fails
      try {
        await clerkClient.users.deleteUser(id);
        console.log("[CLERK WEBHOOK] Deleted Clerk user due to database error:", id);
      } catch (deleteError) {
        console.error("[CLERK WEBHOOK] Failed to delete Clerk user after database error:", deleteError);
      }
      
      return NextResponse.json(
        { 
          error: "Failed to create user in database",
          details: errorMessage,
          code: errorCode,
          clerkId: id
        },
        { status: 500 }
      );
    }

    // Set public metadata
    if (newUser) {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser.id,
        },
      });
    }

    return NextResponse.json({ message: "OK", user: newUser });
  }

  // UPDATE
  if (eventType === "user.updated") {
    const { id, image_url, first_name, last_name, username } = evt.data;

    console.log("[CLERK WEBHOOK] user.updated event data:", {
      id,
      hasUsername: !!username,
      hasImage: !!image_url,
      hasFirstName: !!first_name,
      hasLastName: !!last_name,
    });

    // Get existing user to preserve username if not provided
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { clerkId: id },
        select: { username: true, photo: true }
      });
    } catch (error) {
      console.error("[CLERK WEBHOOK] Error fetching existing user:", error);
    }

    // Preserve username if Clerk doesn't provide one
    const finalUsername = username?.trim() || existingUser?.username;
    if (!finalUsername) {
      console.error("[CLERK WEBHOOK] No username available for user update:", id);
      return NextResponse.json(
        { error: "Username is required but not provided" },
        { status: 400 }
      );
    }

    // Preserve photo if Clerk doesn't provide one
    const finalPhoto = image_url?.trim() || existingUser?.photo;
    if (!finalPhoto) {
      console.error("[CLERK WEBHOOK] No photo available for user update:", id);
      return NextResponse.json(
        { error: "Photo is required but not provided" },
        { status: 400 }
      );
    }

    const user = {
      firstName: first_name || null,
      lastName: last_name || null,
      username: finalUsername,
      photo: finalPhoto,
    };

    try {
      const updatedUser = await updateUser(id, user);
      return NextResponse.json({ message: "OK", user: updatedUser });
    } catch (error: any) {
      console.error("[CLERK WEBHOOK] Failed to update user:", error);
      return NextResponse.json(
        { 
          error: "Failed to update user",
          details: error?.message || "Unknown error"
        },
        { status: 500 }
      );
    }
  }

  // DELETE
  if (eventType === "user.deleted") {
    const { id } = evt.data;

    const deletedUser = await deleteUser(id!);

    return NextResponse.json({ message: "OK", user: deletedUser });
  }

  console.log(`Webhook with and ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  return new Response("", { status: 200 });
}