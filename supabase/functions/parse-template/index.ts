import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Parse DOCX XML to find red-colored text runs
function extractRedTextFields(documentXml: string): { fieldName: string; placeholder: string; xmlPath: string }[] {
  const fields: { fieldName: string; placeholder: string; xmlPath: string }[] = [];
  const seenTexts = new Set<string>();
  
  // Match run elements with red color
  // Red color patterns: FF0000, ff0000, C00000, c00000, red variants
  const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let match;
  
  while ((match = runRegex.exec(documentXml)) !== null) {
    const runContent = match[1];
    
    // Check if run properties contain red color
    const hasRedColor = /<w:color\s+w:val=["'](FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["']/i.test(runContent);
    
    if (hasRedColor) {
      // Extract the text content
      const textMatch = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let textContent = '';
      let tMatch;
      while ((tMatch = textMatch.exec(runContent)) !== null) {
        textContent += tMatch[1];
      }
      
      textContent = textContent.trim();
      if (textContent && !seenTexts.has(textContent)) {
        seenTexts.add(textContent);
        
        // Generate field name from text
        const fieldName = textContent
          .replace(/[{}[\]<>]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9_]/g, '')
          .substring(0, 50) || `field_${fields.length + 1}`;
        
        fields.push({
          fieldName,
          placeholder: textContent,
          xmlPath: textContent,
        });
      }
    }
  }
  
  return fields;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const templateName = formData.get("templateName") as string;
    const description = formData.get("description") as string || '';
    
    if (!file || !templateName) {
      return new Response(JSON.stringify({ error: "File and template name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'docx') {
      return new Response(JSON.stringify({ error: "Only DOCX files are supported. Please upload a .docx file." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Parse DOCX (it's a ZIP file)
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Extract document.xml
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) {
      return new Response(JSON.stringify({ error: "Invalid DOCX file - no document.xml found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Extract red text fields
    const fields = extractRedTextFields(documentXml);
    
    // Store file as base64 data URL (storage not available)
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    const fileDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`;
    
    // Get user from auth header
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    // Save template to database
    const { data: template, error: dbError } = await supabase
      .from("document_templates")
      .insert({
        name: templateName,
        description,
        original_file_url: fileDataUrl,
        original_file_name: file.name,
        file_type: fileExt,
        fields: fields,
        created_by: userId,
      })
      .select()
      .single();
    
    if (dbError) {
      return new Response(JSON.stringify({ error: `Database error: ${dbError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      template,
      fieldsFound: fields.length,
      message: `Template saved with ${fields.length} dynamic field(s) detected.`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
