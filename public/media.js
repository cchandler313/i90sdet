(()=>{
"use strict";
const $=id=>document.getElementById(id);
const videoDialog=$("videos-dialog"),historyDialog=$("history-dialog"),eventDialog=$("event-dialog");
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
let videos=[],history=[],events=[],selection=0;
function setPlayer(index){
 selection=index;
 const v=videos[index];if(!v)return;
 const frame=$("vault-player");frame.replaceChildren();
 const src=v.playlist?"https://www.youtube-nocookie.com/embed/videoseries?list="+v.playlist:"https://www.youtube-nocookie.com/embed/"+v.id;
 frame.append(node("iframe",{src,title:v.title||"Band performance",loading:"lazy",allow:"accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",allowfullscreen:"",referrerpolicy:"strict-origin-when-cross-origin"}));
 $("vault-nowplaying").textContent=v.title||"Live with Interstate 90's";
 $("vault-youtube").href=v.playlist?"https://www.youtube.com/playlist?list="+v.playlist:"https://www.youtube.com/watch?v="+v.id;
 document.querySelectorAll(".vault-choice").forEach(e=>e.setAttribute("aria-current",String(Number(e.dataset.index)===index)));
}
function videoPicker(query=""){
 const list=$("vault-video-list");list.replaceChildren();
 let matches=0;
 for(let i=0;i<videos.length;i++){
  const v=videos[i];
  if(query&&!v.title.toLowerCase().includes(query.toLowerCase())&&!v.playlist)continue;
  matches++;
  const button=node("button",{type:"button",class:"vault-choice","data-index":String(i),"aria-current":String(i===selection)});
  if(v.playlist)button.append(node("span",{class:"playlist-graphic"},"ALL"));
  else button.append(node("img",{src:"https://i.ytimg.com/vi/"+v.id+"/mqdefault.jpg",alt:"",loading:"lazy"}));
  const label=node("span");label.append(node("strong",{},v.title),node("small",{},v.playlist?"Browse every public upload using YouTube's playlist controls":"Play this featured video"));
  button.append(label);
  button.addEventListener("click",()=>setPlayer(i));list.append(button);
 }
 if(!matches)list.append(node("p",{},"No featured clips match your search."));
}
function openVideo(startIndex=0){
 if(!videos.length)return;
 $("video-filter").value="";
 videoPicker();
 videoDialog.showModal();
 setPlayer(startIndex);
}
function renderVideoSection(){
 const grid=$("video-grid");grid.replaceChildren();
 const open=$("open-videos");
 if(!videos.length){
   grid.append(node("p",{},"New performance videos coming soon."));
   open.disabled=true;return;
 }
 const clips=videos.filter(v=>v.id);
 open.textContent="BROWSE ALL "+clips.length+" VIDEOS ↗";
 const featured=videos.find(v=>v.id)||videos.find(v=>v.playlist);
 if(!featured)return;
 const card=node("article",{class:"latest-video-card"});
 const heading=node("div",{class:"latest-video-heading"});
 heading.append(node("span",{class:"latest-video-label"},"LATEST FEATURED VIDEO"),node("strong",{},featured.title||"Interstate 90's live"));
 const frame=node("div",{class:"latest-video-embed"});
 const src=featured.id?"https://www.youtube-nocookie.com/embed/"+featured.id:"https://www.youtube-nocookie.com/embed/videoseries?list="+featured.playlist;
 frame.append(node("iframe",{src,title:"Featured video: "+(featured.title||"Interstate 90's live"),loading:"lazy",allow:"accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share",allowfullscreen:"",referrerpolicy:"strict-origin-when-cross-origin"}));
 const foot=node("div",{class:"latest-video-footer"});
 const all=node("button",{type:"button",class:"latest-video-all"},"WATCH ALL "+clips.length+" VIDEOS ↗");
 all.addEventListener("click",()=>openVideo(videos.indexOf(featured)));
 foot.append(all);
 card.append(frame,heading,foot);
 grid.append(card);
}
function showEvent(index){
 const item=events[index];
 if(!item)return;
 const body=$("event-dialog-body");body.replaceChildren();
 const details=item.details||{};
 const header=node("div",{class:"event-feature-info"});
 header.append(node("div",{class:"event-eyebrow"},"INTERSTATE 90'S DETROIT · LIVE SHOW"));
 header.append(node("h3",{class:"event-heading"},details.title||item.venue));
 if(details.subtitle)header.append(node("p",{class:"event-subtitle"},details.subtitle));
 const badges=node("div",{class:"event-badges"});
 badges.append(node("span",{},"📅 "+formatDate(item.date)));
 if(item.time)badges.append(node("span",{},"⏰ "+item.time));
 if(item.admission)badges.append(node("span",{},"🎟 "+item.admission));
 header.append(badges);
 const layout=node("div",{class:"event-layout"});
 const main=node("div",{class:"event-story"});
 const photo=item.image||"";
 if(photo){
   let src="";
   try{const u=new URL(photo);if(u.protocol==="https:")src=u.href}catch{}
   if(src){
     const figure=node("figure",{class:"event-poster"});
     const photoURL=item.imageKey?"/event-media/"+encodeURIComponent(item.imageKey):src;
     const img=node("img",{src:photoURL,alt:item.imageAlt||"Interstate 90's show announcement",loading:"lazy",decoding:"async"});
     img.addEventListener("error",()=>{if(img.src!==src&&img.dataset.fallback!=="used"){img.dataset.fallback="used";img.src=src}});
     figure.append(img,node("figcaption",{},"Original event artwork · Interstate 90's Detroit"));
     main.append(figure);
   }
 }
 const copy=node("div",{class:"event-copy"});
 let paragraphs=Array.isArray(details.paragraphs)?details.paragraphs.filter(p=>typeof p==="string"&&p.trim()):[];
 if(item.description)copy.append(node("p",{class:"event-lede"},item.description));
 if(!paragraphs.length&&!item.description)paragraphs=["Join Interstate 90's Detroit for an evening of live music and all your favorite songs. Check the show details and come out!"];
 for(const paragraph of paragraphs)copy.append(node("p",{},paragraph));
 main.append(copy);
 const sidebar=node("aside",{class:"event-sidebar"});
 sidebar.append(node("span",{class:"event-aside-label"},"SHOW INFORMATION"));
 const facts=Array.isArray(details.facts)&&details.facts.length?details.facts:[
  ["DATE",formatDate(item.date)],["TIME",item.time||"Time to be announced"],["VENUE",item.venue],["LOCATION",item.location]
 ];
 for(const pair of facts){if(!Array.isArray(pair)||pair.length<2)continue;const row=node("div",{class:"event-fact"});row.append(node("small",{},String(pair[0])),node("strong",{},String(pair[1])));sidebar.append(row)}
 const share=node("button",{type:"button",class:"event-share"},"COPY SHOW LINK ↗");
 share.addEventListener("click",async()=>{
  const link=location.origin+location.pathname+"#shows";
  try{await navigator.clipboard.writeText(link);share.textContent="LINK COPIED ✓"}catch{share.textContent="Share the shows section: "+link}
 });
 sidebar.append(share);
 const ticket=item.ticketUrl||(typeof item.url==="string"&&!item.url.includes("interstate90sdet.com/")?item.url:"");
 if(ticket){try{const url=new URL(ticket);if(url.protocol==="https:")sidebar.append(node("a",{href:url.href,target:"_blank",rel:"noopener noreferrer",class:"event-ticket"},"TICKETS / EVENT PAGE ↗"))}catch{}}
 layout.append(main,sidebar);body.append(header,layout);
 eventDialog.showModal();
}
function bindEvents(data){
 const date=new Date();const today=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
 events=(data.upcomingShows||[]).filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
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
  // Individual clips are shown first; the full uploads playlist remains the last choice.
  videos=[...videos.filter(v=>v.id),...videos.filter(v=>v.playlist&&!v.id)];
  renderVideoSection();setHistory(content);bindEvents(content);
 }catch(e){
  $("video-grid").replaceChildren(node("p",{},"Video library temporarily unavailable."));
  $("open-videos").disabled=true;
  $("open-history").textContent="HISTORY TEMPORARILY UNAVAILABLE";
 }
}
document.querySelector("#upcoming").addEventListener("click",event=>{
 const button=event.target.closest("button[data-event-index]");
 if(button)showEvent(Number(button.dataset.eventIndex));
});
$("open-videos").addEventListener("click",openVideo);
$("open-history").addEventListener("click",()=>historyDialog.showModal());
$("video-filter").addEventListener("input",e=>videoPicker(e.target.value));
$("archive-search").addEventListener("input",renderArchive);
$("archive-year").addEventListener("change",renderArchive);
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
for(const dialog of [videoDialog,historyDialog,eventDialog]){
 dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
}
videoDialog.addEventListener("close",()=>$("vault-player").replaceChildren());
load();
})();
