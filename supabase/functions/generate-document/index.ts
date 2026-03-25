import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replaceRedTextInXml(documentXml: string, fieldValues: Record<string, string>): string {
  let result = documentXml;
  
  // For each field value, find runs with red color containing matching text and replace
  for (const [placeholder, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    
    // Replace text content in red-colored runs matching the placeholder
    const runRegex = new RegExp(
      `(<w:r\\b[^>]*>)((?:<w:rPr>[\\s\\S]*?<w:color\\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["'][\\s\\S]*?<\\/w:rPr>)[\\s\\S]*?)(<w:t[^>]*>)(${escapeRegex(placeholder)})(<\\/w:t>)`,
      'g'
    );
    
    result = result.replace(runRegex, (match, runStart, rprContent, tStart, _text, tEnd) => {
      // Change the color from red to black (000000) and replace text
      const updatedRpr = rprContent.replace(
        /<w:color\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["']\s*\/>/gi,
        '<w:color w:val="000000"/>'
      );
      return `${runStart}${updatedRpr}${tStart}${value}${tEnd}`;
    });
  }
  
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { templateId, fieldValues, documentName } = await req.json();
    
    if (!templateId || !fieldValues) {
      return new Response(JSON.stringify({ error: "templateId and fieldValues are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get template
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    
    if (templateError || !template) {
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Download original DOCX file
    const fileUrl = template.original_file_url;
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Could not download template file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Parse DOCX
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    
    if (!documentXml) {
      return new Response(JSON.stringify({ error: "Invalid template file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Replace placeholders with field values
    const updatedXml = replaceRedTextInXml(documentXml, fieldValues);
    
    // Update the document.xml in the zip
    zip.file("word/document.xml", updatedXml);
    
    // Also check and replace in headers/footers
    const headerFiles = Object.keys(zip.files).filter(f => f.match(/word\/header\d+\.xml/));
    for (const hf of headerFiles) {
      let headerXml = await zip.file(hf)?.async("string");
      if (headerXml) {
        headerXml = replaceRedTextInXml(headerXml, fieldValues);
        zip.file(hf, headerXml);
      }
    }
    
    const footerFiles = Object.keys(zip.files).filter(f => f.match(/word\/footer\d+\.xml/));
    for (const ff of footerFiles) {
      let footerXml = await zip.file(ff)?.async("string");
      if (footerXml) {
        footerXml = replaceRedTextInXml(footerXml, fieldValues);
        zip.file(ff, footerXml);
      }
    }
    
    // Generate the modified DOCX
    const outputBuffer = await zip.generateAsync({ type: "uint8array" });
    
    // Save generated file
    const outputFileName = `generated/${Date.now()}_${documentName || 'document'}.docx`;
    await supabase.storage
      .from("document-templates")
      .upload(outputFileName, outputBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    
    const { data: outputUrlData } = supabase.storage
      .from("document-templates")
      .getPublicUrl(outputFileName);
    
    // Get user
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }
    
    // Save generated document record
    await supabase.from("generated_documents").insert({
      template_id: templateId,
      name: documentName || `Generated from ${template.name}`,
      field_values: fieldValues,
      output_file_url: outputUrlData.publicUrl,
      generated_by: userId,
    });
    
    // Return the file directly for download
    return new Response(outputBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${documentName || 'document'}.docx"`,
        "X-Download-Url": outputUrlData.publicUrl,
      },
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
