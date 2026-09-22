// Claims Reference Portal
// 1) Create a Supabase project.
// 2) Run supabase.sql in Supabase SQL Editor.
// 3) Put your project URL and anon key below.
// 4) Create your administrator user in Supabase Authentication,
//    then set profiles.is_admin = true for that user's id.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const SUPABASE_URL = "https://mriecntgwcksczyfbhfc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0U_DQ0kK8ccTjFY0E2Wc2A_WU_Z0q8B";
const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;


let entries = [];
let documentTypes = [];
let selectedEntry = null;
let selectedAttachment = null;
let currentPage = 1;
let totalPages = 1;
let pdfDocument = null;
let zoom = 1;
let isAdmin = false;

const $ = id => document.getElementById(id);

function setStatus(text, good=true){
  $("connectionStatus").textContent = text;
  $("connectionStatus").style.background = good ? "#e9fff2" : "#fff4e5";
  $("connectionStatus").style.color = good ? "#087443" : "#9a5a00";
}

async function loadDocumentTypes(){
  if(!configured){ documentTypes=[]; return; }
  const {data,error}=await supabase.from("document_types").select("*").order("sort_order",{ascending:true}).order("name",{ascending:true});
  if(error){
    console.error("Document types query failed:", error);
    documentTypes=[];
    return;
  }
  documentTypes=data || [];
}

async function loadEntries(){
  if(!configured){
    entries = [];
    setStatus("Not connected", false);
    renderAll();
    return;
  }
  const {data,error} = await supabase.from("entries").select("*, attachments(*)").order("sort_order").order("code");
  if(error){
    console.error(error);
    entries = [];
    setStatus("Database error", false);
    renderAll();
    return;
  }
  entries = data || [];
  setStatus("Connected");
  renderAll();
}

function renderAll(){
  const q = $("searchInput").value.trim().toLowerCase();
  const filtered = entries.filter(e => !q || e.code.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));
  $("entryCount").textContent = entries.length;
  $("entryList").innerHTML = filtered.map(e => `
    <button class="entry-button ${selectedEntry?.id===e.id?'active':''}" data-entry="${e.id}">
      ${escapeHtml(e.code)}
      <span class="entry-title">${escapeHtml(e.title)}</span>
    </button>`).join("");
  document.querySelectorAll(".entry-button").forEach(b => b.onclick=()=>selectEntry(b.dataset.entry));
  $("clearSearch").classList.toggle("hidden", !q);
  if(!selectedEntry || !filtered.some(e=>e.id===selectedEntry.id)){
    if(filtered[0]) selectEntry(filtered[0].id);
    else showNoMatch();
  } else renderSelected();
}

function selectEntry(id){
  selectedEntry = entries.find(e=>String(e.id)===String(id)) || null;
  if(selectedEntry) {
    currentPage=1; selectedAttachment=null; resetViewer();
    renderAll();
  }
}

function renderSelected(){
  if(!selectedEntry) return;
  $("selectedCode").textContent = selectedEntry.code;
  $("selectedTitle").textContent = selectedEntry.title;
  renderPdx(selectedEntry.pdx || "");
  renderSdx(selectedEntry.sdx || "");
  renderSubmissionType(selectedEntry.submission_type || "Direct Submit");

  renderNotes(selectedEntry.notes || "");

  const attachments = selectedEntry.attachments || [];
  $("attachmentRows").innerHTML = attachments.length ? attachments.map(a=>`
    <div class="attachment-row">
      <button class="attachment-link" data-attachment="${a.id}">${escapeHtml(a.label)}</button>
      <div class="document-type">${escapeHtml(a.type || "")}</div>
    </div>`).join("") : `<div class="empty-state"><div class="empty-icon">▤</div><h3>No attachments yet</h3><p>The administrator can add documents from the Administrator panel.</p></div>`;
  document.querySelectorAll(".attachment-link").forEach(b=>b.onclick=()=>openAttachment(b.dataset.attachment));
}

function showNoMatch(){
  selectedEntry=null;
  $("selectedCode").textContent="—";
  $("selectedTitle").textContent="No matching reference";
  renderPdx("");
  renderSdx("");
  renderSubmissionType("");
  $("attachmentRows").innerHTML="";
  $("notesContent").innerHTML="";
  $("notesSection").classList.add("hidden");
  $("emptyState").classList.remove("hidden");
  resetViewer();
}

function renderPdx(pdx){
  const badge=$("selectedPdx");
  if(!badge)return;
  const value=String(pdx || "").trim();
  badge.classList.toggle("hidden", !value);
  const strong=badge.querySelector("strong");
  if(strong) strong.textContent=value;
}

function renderSdx(sdx){
  const badge=$("selectedSdx");
  if(!badge)return;
  const value=String(sdx || "").trim();
  badge.classList.toggle("hidden", !value);
  const strong=badge.querySelector("strong");
  if(strong) strong.textContent=value;
}

function renderSubmissionType(type){
  const badge=$("selectedSubmissionType");
  if(!badge)return;
  const value=String(type || "").trim();
  badge.classList.toggle("hidden", !value);
  badge.classList.toggle("direct", value === "Direct Submit");
  badge.classList.toggle("cf4", value === "For CF4");
  const strong=badge.querySelector("strong");
  if(strong) strong.textContent=value;
}

function renderNotes(notes){
  const container=$("notesContent");
  container.innerHTML="";
  const lines=String(notes || "")
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(Boolean);

  if(!lines.length){
    $("notesSection").classList.add("hidden");
    return;
  }

  lines.forEach(line=>{
    const row=document.createElement("div");
    row.className="note-line";
    row.textContent=line;
    container.appendChild(row);
  });
  $("notesSection").classList.remove("hidden");
}
function hideNoMatch(){ $("emptyState").classList.add("hidden"); }

function resetViewer(){
  hideNoMatch();
  selectedAttachment=null;
  pdfDocument=null; currentPage=1; totalPages=1; zoom=1;
  ["pdfCanvas","imageViewer","frameViewer"].forEach(id=>$(id).classList.add("hidden"));
  $("viewerPlaceholder").classList.remove("hidden");
  $("viewerTitle").textContent="Select an attachment";
  updatePageLabels();
}

async function openAttachment(id){
  const a = (selectedEntry?.attachments || []).find(x=>String(x.id)===String(id));
  if(!a) return;
  selectedAttachment=a; currentPage=1; zoom=1;
  $("viewerPlaceholder").classList.add("hidden");
  $("viewerTitle").textContent=a.label || "Document";
  ["pdfCanvas","imageViewer","frameViewer"].forEach(x=>$(x).classList.add("hidden"));
  const url=a.url;
  const kind=(a.kind || "").toLowerCase();
  if(kind==="image" || /\.(png|jpe?g|gif|webp)$/i.test(url)){
    $("imageViewer").src=url; $("imageViewer").classList.remove("hidden"); totalPages=1;
  } else if(kind==="pdf" || /\.pdf($|\?)/i.test(url)){
    $("pdfCanvas").classList.remove("hidden");
    await loadPdf(url, $("pdfCanvas"));
  } else {
    $("frameViewer").src=url; $("frameViewer").classList.remove("hidden"); totalPages=1;
  }
  updatePageLabels();
}

async function loadPdf(url, canvas){
  try{
    pdfDocument=await pdfjsLib.getDocument(url).promise;
    totalPages=pdfDocument.numPages;
    await renderPdfPage(currentPage, canvas);
  }catch(err){
    console.error(err);
    canvas.classList.add("hidden");
    $("frameViewer").src=url;
    $("frameViewer").classList.remove("hidden");
    totalPages=1;
  }
  updatePageLabels();
}

async function renderPdfPage(pageNum, canvas, mode="main"){
  if(!pdfDocument) return;
  const page=await pdfDocument.getPage(pageNum);
  const base=page.getViewport({scale:1});
  const stage = mode === "magnifier" ? $("magnifierStage") : $("viewerStage");
  const maxWidth=Math.max(320, stage.clientWidth-48);
  const maxHeight=Math.max(320, stage.clientHeight-48);
  const fitScale=Math.min(maxWidth/base.width, maxHeight/base.height);
  const fit=Math.min(mode === "magnifier" ? 2.5 : 1.55, fitScale);
  const requestedZoom = mode === "magnifier" ? zoom : 1;
  const cssScale = Math.max(0.25, fit * requestedZoom);
  const dpr=window.devicePixelRatio || 1;
  // The magnifier gets its own high-resolution render buffer. PDF pages are vector
  // content, so rendering at several times the display resolution preserves fine text
  // and lines instead of relying on browser/canvas enlargement.
  const qualityMultiplier = mode === "magnifier" ? 3 : 1;
  const renderScale = cssScale * dpr * qualityMultiplier;
  const renderViewport=page.getViewport({scale:renderScale});
  const displayViewport=page.getViewport({scale:cssScale});
  canvas.width=Math.ceil(renderViewport.width);
  canvas.height=Math.ceil(renderViewport.height);
  canvas.style.width=displayViewport.width+"px";
  canvas.style.height=displayViewport.height+"px";
  canvas.style.transform="none";
  const ctx=canvas.getContext("2d", {alpha:false});
  ctx.setTransform(1,0,0,1,0,0);
  await page.render({canvasContext:ctx,viewport:renderViewport}).promise;
}

function updatePageLabels(){
  const txt=`PAGE ${currentPage} OF ${totalPages}`;
  $("pageLabel").textContent=txt;
  $("magnifierPageLabel").textContent=txt;
  $("prevPage").disabled=currentPage<=1;
  $("nextPage").disabled=currentPage>=totalPages;
  $("magnifierPrev").disabled=currentPage<=1;
  $("magnifierNext").disabled=currentPage>=totalPages;
}

async function changePage(delta){
  if(!selectedAttachment || totalPages<=1) return;
  currentPage=Math.min(totalPages,Math.max(1,currentPage+delta));
  if(pdfDocument) await renderPdfPage(currentPage,$("pdfCanvas"),"main");
  if($("magnifierModal").classList.contains("hidden")===false && pdfDocument)
    await renderPdfPage(currentPage,$("magnifierCanvas"),"magnifier");
  updatePageLabels();
}

async function openMagnifier(){
  if(!selectedAttachment) return;
  $("magnifierModal").classList.remove("hidden");
  $("magnifierTitle").textContent=selectedAttachment.label || "Document";
  zoom=1; $("zoomLabel").textContent="100%";
  ["magnifierCanvas","magnifierImage","magnifierFrame"].forEach(x=>$(x).classList.add("hidden"));
  if(pdfDocument){
    $("magnifierCanvas").classList.remove("hidden");
    await renderPdfPage(currentPage,$("magnifierCanvas"),"magnifier");
  } else if(selectedAttachment.kind==="image" || /\.(png|jpe?g|gif|webp)$/i.test(selectedAttachment.url)){
    $("magnifierImage").src=selectedAttachment.url;
    $("magnifierImage").classList.remove("hidden");
    applyZoom();
  } else {
    $("magnifierFrame").src=selectedAttachment.url;
    $("magnifierFrame").classList.remove("hidden");
  }
  updatePageLabels();
}

async function applyZoom(){
  $("zoomLabel").textContent=Math.round(zoom*100)+"%";
  // PDF pages are re-rendered at the requested zoom so the canvas gets more pixels.
  if(pdfDocument && selectedAttachment && !$("magnifierModal").classList.contains("hidden")){
    await renderPdfPage(currentPage,$("magnifierCanvas"),"magnifier");
  } else {
    // Raster images cannot gain detail beyond their source resolution, but keep the
    // browser's normal high-quality interpolation instead of pixel-art scaling.
    $("magnifierImage").style.imageRendering="auto";
    $("magnifierImage").style.transform=`scale(${zoom})`;
  }
}
$("zoomIn").onclick=async()=>{zoom=Math.min(3,zoom+.25);await applyZoom()};
$("zoomOut").onclick=async()=>{zoom=Math.max(.5,zoom-.25);await applyZoom()};

$("prevPage").onclick=()=>changePage(-1);
$("nextPage").onclick=()=>changePage(1);
$("magnifierPrev").onclick=()=>changePage(-1);
$("magnifierNext").onclick=()=>changePage(1);
$("openMagnifier").onclick=openMagnifier;

$("searchInput").oninput=renderAll;
$("clearSearch").onclick=()=>{$("searchInput").value="";renderAll();$("searchInput").focus()};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));

$("adminButton").onclick=async()=>{
  if(isAdmin) openAdmin();
  else if(configured) $("loginModal").classList.remove("hidden");
  else alert("Supabase is not configured. Configure the Supabase settings in app.js to enable administrator login and shared editing.");
};

$("loginForm").onsubmit=async e=>{
  e.preventDefault();
  $("loginError").textContent="";
  const {data,error}=await supabase.auth.signInWithPassword({
    email:$("loginEmail").value,password:$("loginPassword").value
  });
  if(error){$("loginError").textContent=error.message;return}
  const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",data.user.id).single();
  if(!profile?.is_admin){
    await supabase.auth.signOut();
    $("loginError").textContent="This account is not authorized as an administrator.";
    return;
  }
  isAdmin=true; $("loginModal").classList.add("hidden"); openAdmin();
};

async function openAdmin(){
  $("adminModal").classList.remove("hidden");
  renderAdminList();
  await refreshDocumentTypeControls();
  startNewEntry();
}

$("logoutButton").onclick=async()=>{
  if(configured) await supabase.auth.signOut();
  isAdmin=false; $("adminModal").classList.add("hidden");
};

function renderAdminList(){
  $("adminEntryList").innerHTML=entries.map(e=>`
    <div class="admin-entry-item ${selectedEntry?.id===e.id?'selected':''}">
      <button data-edit="${e.id}">
        <span class="admin-entry-code">${escapeHtml(e.code)}</span>
        <span class="admin-entry-title">${escapeHtml(e.title)}</span>
      </button>
    </div>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editEntry(b.dataset.edit));
}

function addNoteRow(value=""){
  const container=$("notesRows");
  const row=document.createElement("div");
  row.className="note-row";

  const input=document.createElement("input");
  input.type="text";
  input.className="note-input";
  input.maxLength=500;
  input.placeholder="Enter instruction...";
  input.value=value;

  const remove=document.createElement("button");
  remove.type="button";
  remove.className="remove-note";
  remove.title="Remove instruction";
  remove.textContent="×";
  remove.onclick=()=>row.remove();

  row.appendChild(input);
  row.appendChild(remove);
  container.appendChild(row);
}

function setNotes(notes){
  const container=$("notesRows");
  container.innerHTML="";
  const lines=String(notes || "")
    .split(/\r?\n/)
    .map(line=>line.trim())
    .filter(Boolean);

  if(lines.length) lines.forEach(line=>addNoteRow(line));
  else addNoteRow();
}

function getNotes(){
  return [...document.querySelectorAll("#notesRows .note-input")]
    .map(input=>input.value.trim())
    .filter(Boolean)
    .join("\n");
}

$("addNoteRow").onclick=()=>addNoteRow();

function setSubmissionType(type){
  const value=type === "For CF4" ? "For CF4" : "Direct Submit";
  document.querySelectorAll("#submissionToggle .submission-option").forEach(btn=>{
    const active=btn.dataset.submission===value;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function getSubmissionType(){
  const active=document.querySelector("#submissionToggle .submission-option.active");
  return active?.dataset.submission || "Direct Submit";
}

document.querySelectorAll("#submissionToggle .submission-option").forEach(btn=>{
  btn.onclick=()=>setSubmissionType(btn.dataset.submission);
});

function startNewEntry(){
  $("editorHeading").textContent="Add a reference";
  $("editorHint").textContent="Create a new code and attach documents.";
  $("editEntryId").value="";
  $("entryCode").value="";
  $("entryTitle").value="";
  $("entryPdx").value="";
  $("entrySdx").value="";
  setSubmissionType("Direct Submit");
  $("notesRows").innerHTML="";
  addNoteRow();
  $("deleteEntryButton").classList.add("hidden");
  $("adminAttachments").innerHTML="";
  addAttachmentRow();
  $("saveError").textContent="";
}
$("newEntryButton").onclick=startNewEntry;

function editEntry(id){
  const e=entries.find(x=>String(x.id)===String(id)); if(!e)return;
  $("editorHeading").textContent="Edit reference";
  $("editorHint").textContent="Update the code, title or attachments.";
  $("editEntryId").value=e.id;
  $("entryCode").value=e.code;
  $("entryTitle").value=e.title;
  $("entryPdx").value=e.pdx || "";
  $("entrySdx").value=e.sdx || "";
  setSubmissionType(e.submission_type || "Direct Submit");
  setNotes(e.notes || "");
  $("deleteEntryButton").classList.remove("hidden");
  $("adminAttachments").innerHTML="";
  (e.attachments||[]).forEach(a=>{
    addAttachmentRow(a);
    const row=$("adminAttachments").lastElementChild;
    row.dataset.attachmentId=a.id;
  });
  if(!(e.attachments||[]).length)addAttachmentRow();
  $("saveError").textContent="";
}

function addAttachmentRow(a=null){
  const row=document.createElement("div");
  row.className="admin-attachment-row";
  const currentType=String(a?.type||"");
  const options=[`<option value="">Select document type</option>`,
    ...documentTypes.map(t=>`<option value="${escapeAttr(t.name)}"${currentType===String(t.name)?" selected":""}>${escapeHtml(t.name)}</option>`)];
  if(currentType && !documentTypes.some(t=>String(t.name)===currentType))
    options.push(`<option value="${escapeAttr(currentType)}" selected>${escapeHtml(currentType)} (existing)</option>`);
  row.innerHTML=`
    <label>Attachment label<input class="a-label" required value="${escapeAttr(a?.label||"")}" placeholder=""></label>
    <label>Document type<select class="a-type">${options.join("")}</select></label>
    <button type="button" class="remove-row" title="Remove attachment">×</button>
    <label class="file-field">File ${a?.url?`<small class="muted">Current file: ${escapeHtml(a.file_name||"uploaded document")}</small>`:""}
      <input class="a-file" type="file" accept=".pdf,image/*">
    </label>`;
  row.querySelector(".remove-row").onclick=()=>row.remove();
  $("adminAttachments").appendChild(row);
}
$("addAttachmentRow").onclick=()=>addAttachmentRow();

async function refreshDocumentTypeControls(){
  await loadDocumentTypes();
  document.querySelectorAll(".admin-attachment-row .a-type").forEach(select=>{
    const current=select.value;
    const options=[`<option value="">Select document type</option>`,
      ...documentTypes.map(t=>`<option value="${escapeAttr(t.name)}">${escapeHtml(t.name)}</option>`)];
    if(current && !documentTypes.some(t=>String(t.name)===String(current)))
      options.push(`<option value="${escapeAttr(current)}" selected>${escapeHtml(current)} (existing)</option>`);
    select.innerHTML=options.join("");
    if(current) select.value=current;
  });
  renderDocumentTypeEditor();
}

function renderDocumentTypeEditor(){
  const box=$("documentTypeList");
  if(!box)return;
  box.innerHTML=documentTypes.length ? documentTypes.map(t=>`
    <div class="document-type-admin-row">
      <span>${escapeHtml(t.name)}</span>
      <div class="document-type-actions">
        <button type="button" class="secondary-btn compact" data-edit-doctype="${escapeAttr(t.id)}">Edit</button>
        <button type="button" class="danger-btn compact" data-delete-doctype="${escapeAttr(t.id)}">Delete</button>
      </div>
    </div>`).join("") : `<div class="muted document-type-empty">No document types added yet.</div>`;

  document.querySelectorAll("[data-edit-doctype]").forEach(btn=>{
    btn.onclick=async()=>{
      const item=documentTypes.find(x=>String(x.id)===String(btn.dataset.editDoctype));
      if(!item)return;
      const name=prompt("Edit document type:",item.name);
      if(name===null)return;
      const clean=name.trim();
      if(!clean)return alert("Document type cannot be blank.");
      if(documentTypes.some(x=>String(x.id)!==String(item.id)&&String(x.name).toLowerCase()===clean.toLowerCase()))
        return alert("That document type already exists.");
      const {error}=await supabase.from("document_types").update({name:clean}).eq("id",item.id);
      if(error)return alert(error.message);
      await refreshDocumentTypeControls();
    };
  });

  document.querySelectorAll("[data-delete-doctype]").forEach(btn=>{
    btn.onclick=async()=>{
      const item=documentTypes.find(x=>String(x.id)===String(btn.dataset.deleteDoctype));
      if(!item)return;
      if(!confirm(`Delete document type "${item.name}"?`))return;
      const {error}=await supabase.from("document_types").delete().eq("id",item.id);
      if(error)return alert(error.message);
      await refreshDocumentTypeControls();
    };
  });
}

$("documentTypeEditorButton").onclick=async()=>{
  if(!isAdmin)return;
  $("documentTypeModal").classList.remove("hidden");
  $("documentTypeEditorError").textContent="";
  $("newDocumentType").value="";
  await refreshDocumentTypeControls();
};

$("addDocumentTypeButton").onclick=async()=>{
  const input=$("newDocumentType");
  const name=input.value.trim();
  if(!name)return;
  if(documentTypes.some(x=>String(x.name).toLowerCase()===name.toLowerCase()))
    return alert("That document type already exists.");
  const {error}=await supabase.from("document_types").insert({name,sort_order:documentTypes.length+1});
  if(error)return alert(error.message);
  input.value="";
  await refreshDocumentTypeControls();
};

$("entryForm").onsubmit=async e=>{
  e.preventDefault();
  $("saveError").textContent="";
  if(!configured){$("saveError").textContent="Configure Supabase first. Changes cannot be saved until Supabase is configured.";return}
  if(!isAdmin)return;
  const id=$("editEntryId").value;
  const payload={
    code:$("entryCode").value.trim(),
    title:$("entryTitle").value.trim(),
    pdx:$("entryPdx").value.trim(),
    sdx:$("entrySdx").value.trim(),
    submission_type:getSubmissionType(),
    notes:getNotes()
  };
  if(!payload.code||!payload.title){$("saveError").textContent="Code and title are required.";return}
  try{
    let entryId=id;
    if(id){
      const {error}=await supabase.from("entries").update(payload).eq("id",id);
      if(error)throw error;
    }else{
      const {data,error}=await supabase.from("entries").insert({...payload,sort_order:entries.length+1}).select().single();
      if(error)throw error; entryId=data.id;
    }

    const existing=(entries.find(x=>String(x.id)===String(entryId))?.attachments||[]);
    const rows=[...document.querySelectorAll(".admin-attachment-row")];
    const keepIds=[];
    for(const row of rows){
      const label=row.querySelector(".a-label").value.trim();
      const type=row.querySelector(".a-type").value.trim();
      const file=row.querySelector(".a-file").files[0];
      const existingUrl = row.dataset.attachmentId ? existing.find(x=>String(x.id)===String(row.dataset.attachmentId))?.url : null;
      if(!label)continue;
      if(row.dataset.attachmentId){
        const aid=row.dataset.attachmentId; keepIds.push(aid);
        let update={label,type};
        if(file){const uploaded=await uploadFile(entryId,file); update={...update,...uploaded};}
        const {error}=await supabase.from("attachments").update(update).eq("id",aid); if(error)throw error;
      }else if(file){
        const uploaded=await uploadFile(entryId,file);
        const {error}=await supabase.from("attachments").insert({entry_id:entryId,label,type,...uploaded});
        if(error)throw error;
      }else{
        // New attachment rows need a file. Ignore blank file rows.
      }
    }
    // Remove existing attachments that were removed from the editor.
    if(id){
      for(const a of existing){
        if(!keepIds.includes(String(a.id))){
          await supabase.from("attachments").delete().eq("id",a.id);
          if(a.storage_path) await supabase.storage.from("attachments").remove([a.storage_path]);
        }
      }
    }
    await loadEntries();
    renderAdminList();
    editEntry(entryId);
    alert("Saved successfully.");
  }catch(err){
    console.error(err); $("saveError").textContent=err.message || String(err);
  }
};

async function uploadFile(entryId,file){
  const ext=file.name.split(".").pop().toLowerCase();
  const path=`${entryId}/${crypto.randomUUID()}.${ext}`;
  const {error}=await supabase.storage.from("attachments").upload(path,file,{upsert:false});
  if(error)throw error;
  const {data}=supabase.storage.from("attachments").getPublicUrl(path);
  return {url:data.publicUrl,kind:file.type==="application/pdf"?"pdf":"image",file_name:file.name,storage_path:path};
}

$("deleteEntryButton").onclick=async()=>{
  const id=$("editEntryId").value;
  if(!id||!confirm("Delete this reference and its attachments?"))return;
  try{
    const e=entries.find(x=>String(x.id)===String(id));
    const paths=(e?.attachments||[]).map(a=>a.storage_path).filter(Boolean);
    if(paths.length)await supabase.storage.from("attachments").remove(paths);
    const {error}=await supabase.from("entries").delete().eq("id",id);
    if(error)throw error;
    await loadEntries();
    renderAdminList();
    startNewEntry();
  }catch(err){$("saveError").textContent=err.message}
};

$("cancelEditButton").onclick=startNewEntry;

// Preserve existing attachment ids when editing.
const observer=new MutationObserver(()=>{
  document.querySelectorAll("#adminAttachments .admin-attachment-row").forEach(row=>{
    if(row.dataset.initialized)return;
    const input=row.querySelector(".a-label");
    // Rows created from existing records are assigned by editEntry below through a lightweight lookup.
    row.dataset.initialized="1";
  });
});
observer.observe($("adminAttachments"),{childList:true});

// Patch addAttachmentRow so existing records carry their id.
const originalAdd=addAttachmentRow;
// Rebind the function behavior by assigning dataset after creation is easiest via editEntry's loop:
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(s){return escapeHtml(s)}

window.addEventListener("resize",()=>{
  if(pdfDocument && selectedAttachment){
    renderPdfPage(currentPage,$("pdfCanvas"),"main");
    if(!$("magnifierModal").classList.contains("hidden"))
      renderPdfPage(currentPage,$("magnifierCanvas"),"magnifier");
  }
});

loadEntries();
