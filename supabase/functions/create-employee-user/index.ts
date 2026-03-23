import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, full_name, app_role, employee_data } = body;

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, app_role: app_role || "employee" },
    });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into employees table
    const empData = employee_data || {};
    const { data: empRecord, error: empError } = await supabase
      .from("employees")
      .insert({
        user_id: userData.user.id,
        full_name,
        email,
        phone: empData.phone || "",
        type: empData.type || "Full Time",
        department: empData.department || "",
        job_title: empData.job_title || "",
        joining_date: empData.joining_date || "",
        date_of_birth: empData.date_of_birth || "",
        salary_type: empData.salary_type || "Fixed Monthly",
        salary_amount: empData.salary_amount || 0,
        bank_name: empData.bank_name || "",
        account_number: empData.account_number || "",
        account_holder_name: empData.account_holder_name || "",
        address: empData.address || "",
        nationality: empData.nationality || "Sri Lankan",
        passport_number: empData.passport_number || "",
        status: empData.status || "Active",
      })
      .select()
      .single();

    if (empError) {
      console.error("Employee insert error:", empError);
      // User was created but employee record failed - still return success with warning
      return new Response(JSON.stringify({ user: userData.user, warning: "User created but employee record failed: " + empError.message }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also insert user role
    const roleMap: Record<string, string> = {
      super_admin: "admin",
      hr_manager: "admin",
      reporting_manager: "moderator",
      employee: "user",
      freelancer_intern: "user",
    };
    
    await supabase.from("user_roles").insert({
      user_id: userData.user.id,
      role: roleMap[app_role] || "user",
    });

    return new Response(JSON.stringify({ user: userData.user, employee: empRecord }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
