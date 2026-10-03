import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.altus-advisory.com",
  "https://www.altus-advisory.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
] as const;

function getAllowedOrigins(): string[] {
  const raw = (Deno.env.get("ALLOWED_ORIGINS") || "").trim();
  if (!raw) return [...DEFAULT_ALLOWED_ORIGINS];
  const parsed = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_ORIGINS];
}

function resolveCorsOrigin(req: Request): string {
  const origin = (req.headers.get("origin") || "").trim();
  const allowed = getAllowedOrigins();
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || "https://www.altus-advisory.com";
}

function buildCorsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-csrf-token, x-requested-with",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const { data: membershipRows } = await adminClient
      .from("organization_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const combinedRoles = [
      ...(roleRows || []).map((r) => r.role),
      ...(membershipRows || []).map((m) => m.role),
    ];

    const hasPermission = combinedRoles.some((role) =>
      [
        "admin",
        "administrator",
        "super_admin",
        "corporate_admin",
        "regional_admin",
        "regional_hr",
        "organization_admin",
        "organization_owner",
      ].includes(role),
    );

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Insufficient privileges" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();
    const userIdRaw =
      typeof body?.userId === "string" ? body.userId.trim() : "";

    if (!userIdRaw || !isUuid(userIdRaw)) {
      return new Response(JSON.stringify({ error: "Invalid userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userIdRaw === user.id) {
      return new Response(
        JSON.stringify({
          error: "You cannot permanently delete your own account.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if caller is a platform operator
    const { data: isOp } = await adminClient.rpc("is_platform_operator", {
      _user_id: user.id,
    });

    let isAuthorizedTenantAdmin = !!isOp;
    let callerAdminOrgIds: string[] = [];

    if (!isAuthorizedTenantAdmin) {
      // Verify caller and target user share an active organization where caller has administrative authority
      const { data: callerMemberships } = await adminClient
        .from("organization_memberships")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .eq("is_active", true);

      callerAdminOrgIds = (callerMemberships || [])
        .filter((m) =>
          [
            "organization_owner",
            "organization_admin",
            "brand_admin",
          ].includes(m.role),
        )
        .map((m) => m.organization_id);

      if (callerAdminOrgIds.length > 0) {
        const { data: targetMembership } = await adminClient
          .from("organization_memberships")
          .select("id")
          .eq("user_id", userIdRaw)
          .eq("is_active", true)
          .in("organization_id", callerAdminOrgIds)
          .limit(1)
          .maybeSingle();

        if (targetMembership) {
          isAuthorizedTenantAdmin = true;
        }
      }
    }

    if (!isAuthorizedTenantAdmin) {
      return new Response(
        JSON.stringify({
          error:
            "Forbidden: Target user does not belong to your organization or you lack administrative authority.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: targetUser, error: targetError } =
      await adminClient.auth.admin.getUserById(userIdRaw);
    if (targetError || !targetUser?.user) {
      return new Response(
        JSON.stringify({ error: "Target user not found in auth." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!isOp) {
      // Tenant Admin Scope: Never unconditionally destroy auth.users across other tenants
      const requestedOrgId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
      const orgsToRemove = requestedOrgId && callerAdminOrgIds.includes(requestedOrgId)
        ? [requestedOrgId]
        : callerAdminOrgIds;

      // 1. Remove target user from caller's tenant organization(s)
      const { error: memDeleteError } = await adminClient
        .from("organization_memberships")
        .delete()
        .eq("user_id", userIdRaw)
        .in("organization_id", orgsToRemove);

      if (memDeleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to remove organization membership: ${memDeleteError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 2. Check if the target user retains active memberships in other customer tenants
      const { data: remainingMemberships } = await adminClient
        .from("organization_memberships")
        .select("id, organization_id")
        .eq("user_id", userIdRaw)
        .eq("is_active", true);

      if (remainingMemberships && remainingMemberships.length > 0) {
        // User is still active in other tenants; re-home their profile to an existing tenant
        await adminClient
          .from("profiles")
          .update({ organization_id: remainingMemberships[0].organization_id })
          .eq("id", userIdRaw)
          .in("organization_id", orgsToRemove);

        return new Response(
          JSON.stringify({
            success: true,
            hardDeleted: false,
            membershipRemoved: true,
            remainingTenants: remainingMemberships.length,
            userId: userIdRaw,
            message: "User was removed from this organization. Account remains active in other organizations.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // 3. User has zero memberships remaining anywhere on the platform; delete auth account
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        userIdRaw,
        false,
      );
      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: `Failed to hard delete user: ${deleteError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          hardDeleted: true,
          membershipRemoved: true,
          userId: userIdRaw,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Platform Operator Scope. With an organizationId (the tenant User Management
    // page always sends one) this removes the user from that organization and
    // deletes the account only when no other membership remains, the same rule
    // tenant admins follow. Without one, the account is deleted platform-wide.
    if (typeof body?.organizationId === "string" && isUuid(body.organizationId)) {
      const { error: memDeleteError } = await adminClient
        .from("organization_memberships")
        .delete()
        .eq("user_id", userIdRaw)
        .eq("organization_id", body.organizationId);

      if (memDeleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to remove organization membership: ${memDeleteError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: remainingMemberships } = await adminClient
        .from("organization_memberships")
        .select("id, organization_id")
        .eq("user_id", userIdRaw)
        .eq("is_active", true);

      if (remainingMemberships && remainingMemberships.length > 0) {
        await adminClient
          .from("profiles")
          .update({ organization_id: remainingMemberships[0].organization_id })
          .eq("id", userIdRaw)
          .eq("organization_id", body.organizationId);

        return new Response(
          JSON.stringify({
            success: true,
            hardDeleted: false,
            membershipRemoved: true,
            remainingTenants: remainingMemberships.length,
            userId: userIdRaw,
            message: "User was removed from this organization. Account remains active in other organizations.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      userIdRaw,
      false,
    );
    if (deleteError) {
      return new Response(
        JSON.stringify({
          error: `Failed to hard delete user: ${deleteError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        hardDeleted: true,
        userId: userIdRaw,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error: " + (err?.message || String(err)),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
