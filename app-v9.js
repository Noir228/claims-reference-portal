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

const demoData = [
  {
    id:"demo-99460", code:"99460", title:"NEWBORN CARE PACKAGE",
    attachments:[
      {id:"demo-cf2", label:"CF2", type:"CF2", url:"demo-document.png", kind:"image"},
      {id:"demo-csf", label:"CSF", type:"CSF", url:"demo-document.png", kind:"image"},
      {id:"demo-pbef", label:"PBEF OR POSCERTFI", type:"CERTIFICATE OF ELIGIBILITY OR OTHERS", url:"demo-document.png", kind:"image"},
      {id:"demo-pmrf", label:"PMRF", type:"PMRF", url:"demo-document.png", kind:"image"},
      {id:"demo-bc", label:"BCNEWBORN", type:"PATIENT'S BIRTH CERTIFICATE", url:"demo-document.png", kind:"image"},
      {id:"demo-hearing", label:"HEARING TEST", type:"DIAGNOSTIC TEST RESULT", url:"demo-document.png", kind:"image"}
    ]
  },
  {id:"demo-nsd",code:"NSD01",title:"NORMAL SPONTANEOUS DELIVERY",attachments:[]},
  {id:"demo-90935",code:"90935",title:"HEMODIALYSIS SERVICE",attachments:[]},
  {id:"demo-acr",code:"ACR",title:"REFERENCE ITEM",attachments:[]},
  {id:"demo-59513",code:"59513",title:"CESAREAN DELIVERY",attachments:[]},
  {id:"demo-59514",code:"59514",title:"CESAREAN DELIVERY WITH ADDITIONAL SERVICE",attachments:[]}
];

let entries = [];
let selectedEntry = null;
let selectedAttachment = null;
let currentPage = 1;
let totalPages = 1;
let pdfDocument = null;
let zoom = 1;
let isAdmin = false;
let selectedAdminEntryId = null;

const $ = id => document.getElementById(id);

function setStatus(text, good=true){
  $("connectionStatus").textContent = text;
  $("connectionStatus").style.background = good ? "#e9fff2" : "#fff4e5";
  $("connectionStatus").style.color = good ? "#087443" : "#9a5a00";
}

async function loadEntries(){
  if(!configured){
    entries = [];
    setStatus("Not connected", false);
    renderAll();
    return;
  }
  try {
    const {data,error} = await supabase.from("entries").select("*, attachments(*)").order("sort_order").order("code");
    if(error) throw error;
    entries = data || [];
  } catch(error) {
    console.error("Database load failed:", error);
    entries = [];
    setStatus("Database error", false);
    renderAll();
    return;
  }
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
  $("notesContent").textContent = selectedEntry.notes?.trim() || "No notes or instructions added.";
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
  $("attachmentRows").innerHTML="";
  $("notesContent").textContent="No notes or instructions added.";
  $("emptyState").classList.remove("hidden");
  resetViewer();
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

async function renderPdfPage(pageNum, canvas, options={}){
  if(!pdfDocument) return;
  const page=await pdfDocument.getPage(pageNum);
  const base=page.getViewport({scale:1});
  const isMagnifier=options.magnifier===true;
  const stage=$(isMagnifier ? 'magnifierStage' : 'viewerStage');

  // Normal preview fits the document to the panel. The magnifier renders
  // at substantially higher native resolution so zoom does not stretch
  // an already-small canvas.
  let cssScale;
  if(isMagnifier){
    const fitScale=Math.min(2, Math.max(.8, Math.min(
      Math.max(500, stage.clientWidth-40)/base.width,
      Math.max(500, stage.clientHeight-40)/base.height
    )));
    cssScale=fitScale*zoom;
  }else{
    const maxWidth=Math.max(320, stage.clientWidth-30);
    const maxHeight=Math.max(320, stage.clientHeight-30);
    const fitScale=Math.min(maxWidth/base.width,maxHeight/base.height);
    cssScale=Math.min(1.55,Math.max(.25,fitScale));
  }

  const deviceScale=isMagnifier
    ? Math.min(2.5, Math.max(2, window.devicePixelRatio || 1))
    : Math.min(2, window.devicePixelRatio || 1);
  let renderScale=cssScale*deviceScale;

  // Keep the canvas within a safe memory limit on long scanned documents.
  const MAX_PIXELS=isMagnifier ? 24000000 : 12000000;
  const wantedPixels=(base.width*renderScale)*(base.height*renderScale);
  if(wantedPixels>MAX_PIXELS){
    renderScale*=Math.sqrt(MAX_PIXELS/wantedPixels);
  }

  const viewport=page.getViewport({scale:cssScale});
  const renderViewport=page.getViewport({scale:renderScale});
  canvas.width=Math.ceil(renderViewport.width);
  canvas.height=Math.ceil(renderViewport.height);
  canvas.style.width=viewport.width+'px';
  canvas.style.height=viewport.height+'px';
  canvas.style.transform='none';
  canvas.style.imageRendering='auto';

  const ctx=canvas.getContext('2d', {alpha:false});
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
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
  if(pdfDocument) await renderPdfPage(currentPage,$("pdfCanvas"));
  if($("magnifierModal").classList.contains("hidden")===false && pdfDocument)
    await renderPdfPage(currentPage,$("magnifierCanvas"),{magnifier:true});
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
    await renderPdfPage(currentPage,$("magnifierCanvas"),{magnifier:true});
    $("zoomLabel").textContent="100%";
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

function applyZoom(){
  $("zoomLabel").textContent=Math.round(zoom*100)+"%";
  if(!pdfDocument){
    $("magnifierImage").style.transform=`scale(${zoom})`;
    $("magnifierFrame").style.transform='none';
  }
}
async function setZoom(nextZoom){
  zoom=Math.min(3,Math.max(.5,nextZoom));
  $("zoomLabel").textContent=Math.round(zoom*100)+"%";
  if(pdfDocument && $("magnifierModal").classList.contains("hidden")===false){
    await renderPdfPage(currentPage,$("magnifierCanvas"),{magnifier:true});
  } else {
    applyZoom();
  }
}
$("zoomIn").onclick=()=>setZoom(zoom+.25);
$("zoomOut").onclick=()=>setZoom(zoom-.25);

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
  else alert("This downloadable demo is in Demo mode. Configure Supabase using README.md to enable administrator login and shared editing.");
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

function openAdmin(){
  $("adminModal").classList.remove("hidden");
  renderAdminList();
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

function startNewEntry(){
  $("editorHeading").textContent="Add a reference";
  $("editorHint").textContent="Create a new code and attach documents.";
  $("editEntryId").value="";
  $("entryCode").value="";
  $("entryTitle").value="";
  $("entryNotes").value="";
  $("deleteEntryButton").classList.add("hidden");
  selectedAdminEntryId=null;
  $("adminAttachments").innerHTML="";
  addAttachmentRow();
  $("saveError").textContent="";
}
$("newEntryButton").type="button";
$("newEntryButton").addEventListener("click", (ev)=>{ ev.preventDefault(); ev.stopPropagation(); startNewEntry(); });

function editEntry(id){
  selectedAdminEntryId=id;
  const e=entries.find(x=>String(x.id)===String(id)); if(!e)return;
  $("editorHeading").textContent="Edit reference";
  $("editorHint").textContent="Update the code, title or attachments.";
  $("editEntryId").value=e.id;
  $("entryCode").value=e.code;
  $("entryTitle").value=e.title;
  $("entryNotes").value=e.notes || "";
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
  row.innerHTML=`
    <label>Attachment label<input class="a-label" required value="${escapeAttr(a?.label||"")}" placeholder="CF2"></label>
    <label>Document type<input class="a-type" value="${escapeAttr(a?.type||"")}" placeholder="CF2"></label>
    <button type="button" class="remove-row" title="Remove attachment">×</button>
    <label class="file-field">File ${a?.url?`<small class="muted">Current file: ${escapeHtml(a.file_name||"uploaded document")}</small>`:""}
      <input class="a-file" type="file" accept=".pdf,image/*">
    </label>`;
  row.querySelector(".remove-row").onclick=()=>row.remove();
  $("adminAttachments").appendChild(row);
}
$("addAttachmentRow").type="button";
$("addAttachmentRow").addEventListener("click", (ev)=>{ ev.preventDefault(); ev.stopPropagation(); addAttachmentRow(); });

function addStandardNewbornAttachments(){
  const standard=[
    ["CF2","CF2"],
    ["CSF","CSF"],
    ["PBEF","PBEF"],
    ["PMRF","PMRF"],
    ["BCNEWBORN","PATIENT'S BIRTH CERTIFICATE"],
    ["HEARING TEST","DIAGNOSTIC TEST RESULT"]
  ];
  const existing=[...document.querySelectorAll("#adminAttachments .admin-attachment-row")].map(row=>
    row.querySelector(".a-label")?.value.trim().toUpperCase()
  );
  for(const [label,type] of standard){
    if(!existing.includes(label.toUpperCase())) addAttachmentRow({label,type});
  }
}
const standardNewbornButton = $("standardNewbornAttachments");
if (standardNewbornButton) {
  standardNewbornButton.onclick = addStandardNewbornAttachments;
  standardNewbornButton.classList.add("hidden");
}

$("entryForm").onsubmit=async e=>{
  e.preventDefault();
  $("saveError").textContent="";
  if(!configured){$("saveError").textContent="Configure Supabase first. Demo mode does not save changes.";return}
  if(!isAdmin)return;
  const id=$("editEntryId").value;
  const payload={
    code:$("entryCode").value.trim(),
    title:$("entryTitle").value.trim(),
    notes:$("entryNotes").value.trim()
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
    await loadEntries(); startNewEntry();
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
  if(pdfDocument && selectedAttachment) renderPdfPage(currentPage,$("pdfCanvas"));
});

loadEntries();
