(()=>{
"use strict";
const $=id=>document.getElementById(id);
const videoDialog=$("videos-dialog"),historyDialog=$("history-dialog");
const parseYouTube=url=>{
 try{
  const u=new URL(url);
  if(u.hostname==="youtu.be"&&/^[\w-]{11}$/.test(u.pathname.slice(1)))return {id:u.pathname.slice(1)};
  if(["www.youtube.com","youtube.com","m.youtube.com","www.youtube-nocookie.com"].includes(u.hostname)){
   const channel=u.pathname.match(/^\/channel\/(UC[\w-]{22})\/?$/);
   if(channel)return {playlist:"UU"+channel[1].slice(2)};
   const id=u.pathname.startsWith("/shorts/")||u.pathname.startsWith("/embed/")?u.pathname.split("/")[2]:u.searchParams.get("v");
   if(/^[\w-]{11}$/.test(id||""))return {id};
  }
 }catch{}
 return null;
};
const node=(tag,attrs={},txt)=>{
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){if(k==="class")e.className=v;else e.setAttribute(k,v)}
 if(txt!==undefined)e.textContent=txt;
 return e;
};
const formatDate=s=>{const d=new Date(s+"T12:00:00");return Number.isFinite(d.getTime())?d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"Date not listed"};
let videos=[],history=[],selection=0;
function setPlayer(index){
 selection=index;
 const v=videos[index];if(!v)return;
 const frame=$("vault-player");frame.replaceChildren();
 const src=v.playlist?"https://www.youtube-nocookie.com/embed/videoseries?list="+v.playlist:"https://www.youtube-nocookie.com/embed/"+v.id;
 frame.append(node("iframe",{src,title:v.title||"Band performance",loading:"lazy",allow:"accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",allowfullscreen:"",referrerpolicy:"strict-origin-when-cross-origin"}));
 $("vault-nowplaying").textContent=v.title||"Live with Interstate 90's";
 $("vault-youtube").href=v.playlist?"https://www.youtube.com/playlist?list="+v.playlist:"https://www.youtube.com/watch?v="+v.id;
 document.querySelectorAll(".vault-choice").forEach((e,i)=>e.setAttribute("aria-current",String(i===index)));
}
function videoPicker(query=""){
 const list=$("vault-video-list");list.replaceChildren();
 let matches=0;
 for(let i=0;i<videos.length;i++){
  const v=videos[i];
  if(query&&!v.title.toLowerCase().includes(query.toLowerCase())&&!v.playlist)continue;
  matches++;
  const button=node("button",{type:"button",class:"vault-choice","aria-current":String(i===selection)});
  if(v.playlist)button.append(node("span",{class:"playlist-graphic"},"ALL"));
  else button.append(node("img",{src:"https://i.ytimg.com/vi/"+v.id+"/mqdefault.jpg",alt:"",loading:"lazy"}));
  const label=node("span");label.append(node("strong",{},v.title),node("small",{},v.playlist?"Browse every public upload using YouTube's playlist controls":"Play this featured video"));
  button.append(label);
  button.addEventListener("click",()=>setPlayer(i));list.append(button);
 }
 if(!matches)list.append(node("p",{},"No featured clips match your search."));
}
function openVideo(){
 if(!videos.length)return;
 videoPicker($("video-filter").value);
 setPlayer(0);
 videoDialog.showModal();
}
function renderVideoSection(){
 const grid=$("video-grid");grid.replaceChildren();
 if(!videos.length){grid.append(node("p",{},"New performance videos coming soon."));$("open-videos").disabled=true;return}
 const archive=videos.find(v=>v.playlist);
 const button=node("button",{type:"button",class:"video-teaser-action"});
 button.append(node("span",{},archive?"COMPLETE YOUTUBE ARCHIVE":"VIDEO COLLECTION"),node("strong",{},archive?"Browse all public uploads in one place":"Watch our live performance videos"));
 button.onclick=openVideo;grid.append(button);
 const individual=videos.find(v=>v.id);
 if(individual){
  const clip=node("button",{type:"button",class:"video-teaser-action"});
  clip.append(node("span",{},"FEATURED PERFORMANCE"),node("strong",{},individual.title));
  clip.onclick=()=>{openVideo();setPlayer(videos.indexOf(individual))};grid.append(clip);
 }
}
function renderArchive(){
 const q=$("archive-search").value.toLowerCase().trim(),year=$("archive-year").value,root=$("archive-list");
 const items=history.filter(x=>(year==="all"||x.date.startsWith(year))&&(!q||(x.title+" "+x.summary+" "+x.date).toLowerCase().includes(q)));
 root.replaceChildren();$("archive-count").textContent=items.length+" historical record"+(items.length!==1?"s":"")+(q?" matching your search":"");
 if(!items.length)root.append(node("p",{},"No matching shows found."));
 for(const x of items.slice(0,450)){
  const card=node("article",{class:"archive-entry"});
  card.append(node("small",{},(x.post?"ARCHIVE POSTED ":"SHOW DATE ")+formatDate(x.date)));
  card.append(node("h3",{},x.title));
  if(x.summary)card.append(node("p",{},x.summary));
  root.append(card);
 }
}
function setHistory(data){
 history=[...(data.recentShows||[]).filter(v=>v.date&&v.venue).map(v=>({title:v.venue+(v.location?" · "+v.location:""),summary:v.time||"",date:v.date,post:false})),...(data.archivePosts||[]).filter(v=>v.published&&v.title).map(v=>({title:v.title,summary:v.summary||"",date:v.published,post:true}))];
 history.sort((a,b)=>b.date.localeCompare(a.date));
 const years=[...new Set(history.map(v=>v.date.slice(0,4)))].sort().reverse();
 const picker=$("archive-year");picker.replaceChildren(node("option",{value:"all"},"All years"));
 for(const year of years)picker.append(node("option",{value:year},year));
 renderArchive();
 const open=$("open-history");open.textContent="BROWSE "+history.length+" HISTORICAL RECORDS ↗";
}
async function load(){
 try{
  const response=await fetch("/content.json",{cache:"no-store"});if(!response.ok)throw Error("Could not load site content");
  const content=await response.json();
  videos=(content.videos||[]).map(v=>({...v,...parseYouTube(v.url)})).filter(v=>v.id||v.playlist);
  const playlistIndex=videos.findIndex(v=>v.playlist);
  if(playlistIndex>0)videos.unshift(...videos.splice(playlistIndex,1));
  renderVideoSection();setHistory(content);
 }catch(e){
  $("video-grid").replaceChildren(node("p",{},"Video library temporarily unavailable."));
  $("open-videos").disabled=true;
  $("open-history").textContent="HISTORY TEMPORARILY UNAVAILABLE";
 }
}
$("open-videos").addEventListener("click",openVideo);
$("open-history").addEventListener("click",()=>historyDialog.showModal());
$("video-filter").addEventListener("input",e=>videoPicker(e.target.value));
$("archive-search").addEventListener("input",renderArchive);
$("archive-year").addEventListener("change",renderArchive);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
for(const dialog of [videoDialog,historyDialog]){
 dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
}
videoDialog.addEventListener("close",()=>$("vault-player").replaceChildren());
load();
})();
