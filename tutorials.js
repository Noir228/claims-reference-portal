import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://mriecntgwcksczyfbhfc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0U_DQ0kK8ccTjFY0E2Wc2A_WU_Z0q8B";
const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let tutorials=[];
let selectedTutorial=null;
let isAdmin=false;
const $=id=>document.getElementById(id);

function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function escapeAttr(s){return escapeHtml(s)}
function setStatus(text,good=true){$("connectionStatus").textContent=text;$("connectionStatus").style.background=good?"#e9fff2":"#fff4e5";$("connectionStatus").style.color=good?"#087443":"#9a5a00"}

async function loadTutorials(){
  if(!configured){tutorials=[];setStatus("Not connected",false);renderAll();return;}
  const {data,error}=await supabase.from("tutorial_videos").select("*").order("created_at",{ascending:true});
  if(error){console.error(error);setStatus("Database error",false);tutorials=[];renderAll();return;}
  tutorials=data||[];setStatus("Connected");renderAll();
}

function renderAll(){
  $("tutorialCount").textContent=tutorials.length;
  $("tutorialList").innerHTML=tutorials.map(v=>`<button class="tutorial-button ${selectedTutorial?.id===v.id?'active':''}" data-id="${escapeAttr(v.id)}">${escapeHtml(v.title)}</button>`).join("");
  document.querySelectorAll(".tutorial-button").forEach(b=>b.onclick=()=>selectTutorial(b.dataset.id));
  if(!selectedTutorial || !tutorials.some(v=>v.id===selectedTutorial.id)){if(tutorials[0])selectTutorial(tutorials[0].id);else showEmpty();} else updatePlayer();
}

function selectTutorial(id){selectedTutorial=tutorials.find(v=>String(v.id)===String(id))||null;if(selectedTutorial)updatePlayer();else showEmpty();renderListActive();}
function renderListActive(){document.querySelectorAll(".tutorial-button").forEach(b=>b.classList.toggle("active",String(b.dataset.id)===String(selectedTutorial?.id)))}
function showEmpty(){selectedTutorial=null;$("tutorialVideo").pause();$("tutorialVideo").removeAttribute("src");$("tutorialVideo").load();$("tutorialVideo").classList.add("hidden");$("tutorialPlaceholder").classList.remove("hidden");$("tutorialPageTitle").textContent="Video Tutorials";$("tutorialFileName").textContent="Choose a tutorial to begin.";renderListActive()}
function updatePlayer(){
  if(!selectedTutorial)return;
  $("tutorialPageTitle").textContent=selectedTutorial.title;
  $("tutorialFileName").textContent=selectedTutorial.file_name||"Video tutorial";
  const video=$("tutorialVideo");
  video.src=selectedTutorial.url;video.classList.remove("hidden");$("tutorialPlaceholder").classList.add("hidden");video.load();renderListActive();
}

$("adminButton").onclick=async()=>{if(isAdmin)openAdmin();else if(configured)$("loginModal").classList.remove("hidden");else alert("Supabase is not configured.")};
$("loginForm").onsubmit=async e=>{
  e.preventDefault();$("loginError").textContent="";
  const {data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});
  if(error){$("loginError").textContent=error.message;return;}
  const {data:profile}=await supabase.from("profiles").select("is_admin").eq("id",data.user.id).single();
  if(!profile?.is_admin){await supabase.auth.signOut();$("loginError").textContent="This account is not authorized as an administrator.";return;}
  isAdmin=true;$("loginModal").classList.add("hidden");openAdmin();
};
async function openAdmin(){$("adminModal").classList.remove("hidden");renderAdminList();}
$("logoutButton").onclick=async()=>{if(configured)await supabase.auth.signOut();isAdmin=false;$("adminModal").classList.add("hidden")};

function renderAdminList(){
  $("adminVideoCount").textContent=tutorials.length;
  $("adminTutorialList").innerHTML=tutorials.length?tutorials.map(v=>`<div class="tutorial-admin-row"><div><strong>${escapeHtml(v.title)}</strong><small>${escapeHtml(v.file_name||"Video file")}</small></div><button type="button" class="danger-btn compact" data-delete-video="${escapeAttr(v.id)}">Delete</button></div>`).join(""): `<div class="muted">No videos uploaded yet.</div>`;
  document.querySelectorAll("[data-delete-video]").forEach(btn=>btn.onclick=()=>deleteTutorial(btn.dataset.deleteVideo));
}

$("videoForm").onsubmit=async e=>{
  e.preventDefault();$("videoUploadError").textContent="";
  const title=$("videoTitle").value.trim();const file=$("videoFile").files[0];
  if(!title||!file)return;
  const button=$("uploadVideoButton");button.disabled=true;button.textContent="Uploading...";
  try{
    const ext=(file.name.split(".").pop()||"mp4").toLowerCase();
    const path=`${crypto.randomUUID()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("tutorial-videos").upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(uploadError)throw uploadError;
    const {data:urlData}=supabase.storage.from("tutorial-videos").getPublicUrl(path);
    const {error:insertError}=await supabase.from("tutorial_videos").insert({title,storage_path:path,url:urlData.publicUrl,file_name:file.name});
    if(insertError){await supabase.storage.from("tutorial-videos").remove([path]);throw insertError;}
    $("videoTitle").value="";$("videoFile").value="";await loadTutorials();renderAdminList();alert("Video uploaded successfully.");
  }catch(err){console.error(err);$("videoUploadError").textContent=err.message||String(err);}
  finally{button.disabled=false;button.textContent="Upload video";}
};

async function deleteTutorial(id){
  const item=tutorials.find(v=>String(v.id)===String(id));if(!item)return;
  if(!confirm(`Delete video "${item.title}"?`))return;
  try{
    if(item.storage_path)await supabase.storage.from("tutorial-videos").remove([item.storage_path]);
    const {error}=await supabase.from("tutorial_videos").delete().eq("id",id);if(error)throw error;
    if(selectedTutorial?.id===item.id)selectedTutorial=null;
    await loadTutorials();renderAdminList();
  }catch(err){alert(err.message||String(err));}
}

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
loadTutorials();
