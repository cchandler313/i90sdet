import { authorized } from "./content.js";
const ORIGIN="https://interstate90sdet.com";
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const decodeEntities=s=>String(s||"").replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(?:x[0-9a-f]+|\d+));/gi,v=>{
 const simple={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" "};
 if(simple[v.toLowerCase()])return simple[v.toLowerCase()];
 try{const n=v[2].toLowerCase()==="x"?parseInt(v.slice(3,-1),16):parseInt(v.slice(2,-1),10);return String.fromCodePoint(n)}catch{return v}
});
const clean=s=>decodeEntities(String(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
const tag=(s,name)=>{const m=s.match(new RegExp("<"+name.replace(":","\\:")+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name.replace(":","\\:")+">","i"));return m?m[1]:""};
const parseDate=s=>{const d=new Date(s);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):""};
const trustedLink=s=>{try{const u=new URL(clean(s));return u.protocol==="https:"&&["interstate90sdet.com","www.interstate90sdet.com"].includes(u.hostname)?u.href:""}catch{return ""}};
function normalize(post){
 const title=clean(post.title).slice(0,230),url=trustedLink(post.url),published=parseDate(post.published),summary=clean(post.summary).slice(0,450);
 return title&&url&&published?{title,url,published,summary}:null;
}
async function attemptRest(){
 const found=new Map();
 for(let page=1;page<=5;page++){
   const url=ORIGIN+"/wp-json/wp/v2/posts?per_page=100&page="+page+"&_fields=date,link,title,excerpt";
   const response=await fetch(url,{headers:{"accept":"application/json"},redirect:"follow"});
   if(!response.ok){if(page===1)throw Error("REST endpoint unavailable");break}
   const list=await response.json();
   if(!Array.isArray(list)||!list.length)break;
   for(const p of list){
     const entry=normalize({title:p.title?.rendered,url:p.link,published:p.date,summary:p.excerpt?.rendered});
     if(entry)found.set(entry.url,entry);
   }
   if(list.length<100)break;
 }
 return [...found.values()];
}
function parseRss(xml){
 const posts=[];
 for(const item of xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)||[]){
   const entry=normalize({title:tag(item,"title"),url:tag(item,"link"),published:tag(item,"pubDate"),summary:tag(item,"description")||tag(item,"content:encoded")});
   if(entry)posts.push(entry);
 }
 return posts;
}
async function attemptRss(){
 const found=new Map();
 for(let page=1;page<=36;page++){
   const response=await fetch(ORIGIN+"/feed/?paged="+page,{headers:{"accept":"application/rss+xml, text/xml, application/xml"}});
   if(!response.ok){if(page===1)throw Error("RSS feed unavailable");break}
   const text=await response.text();
   const posts=parseRss(text);
   if(!posts.length)break;
   let n=0;
   for(const p of posts){if(!found.has(p.url)){found.set(p.url,p);n++}}
   if(n===0)break;
 }
 return [...found.values()];
}
function parseArchivePage(html){
 const results=[];
 const articleBlocks=html.match(/<article\b[^>]*>[\s\S]*?<\/article>/gi)||[];
 for(const article of articleBlocks){
   const head=article.match(/<h[1-4][^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>[\s\S]*?<\/h[1-4]>/i)||article.match(/<h[1-4][^>]*>[\s\S]*?<\/h[1-4]>/i);
   if(!head)continue;
   const link=head[0].match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
   if(!link)continue;
   const date=article.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)||article.match(/datetime=["']([^"']+)["']/i);
   const summary=article.match(/<(?:div|p)\b[^>]*class=["'][^"']*(?:entry-content|entry-summary)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p)>/i);
   const normalized=normalize({title:link[2],url:link[1],published:date?.[1],summary:summary?.[1]||""});
   if(normalized)results.push(normalized);
 }
 return results;
}
async function attemptHTML(){
 const found=new Map();
 for(let page=1;page<=36;page++){
   const url=ORIGIN+"/blog/"+(page===1?"":"page/"+page+"/");
   const response=await fetch(url,{headers:{"accept":"text/html"}});
   if(!response.ok){if(page===1)throw Error("Blog archive inaccessible");break}
   const posts=parseArchivePage(await response.text());
   if(!posts.length)break;
   let n=0;
   for(const p of posts){if(!found.has(p.url)){found.set(p.url,p);n++}}
   if(n===0)break;
 }
 return [...found.values()];
}
async function findLegacyYouTubeVideos(){
 try{
  const response=await fetch(ORIGIN+"/videos/",{headers:{"accept":"text/html"}});
  if(!response.ok)return [];
  let html=await response.text();
  html=html.replace(/&amp;/g,"&").replace(/\\u0026/gi,"&").replace(/\\\//g,"/");
  const found=new Set(),videos=[];
  const patterns=[
   /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([\w-]{11})/gi,
   /youtu\.be\/([\w-]{11})/gi,
   /youtube\.com\/watch\?[^"'<> ]*?v=([\w-]{11})/gi,
   /youtube\.com\/shorts\/([\w-]{11})/gi
  ];
  for(const pattern of patterns){
   for(const match of html.matchAll(pattern)){
     const id=match[1];
     if(found.has(id))continue;
     found.add(id);
     videos.push({title:"Classic Interstate 90's performance",url:"https://www.youtube.com/watch?v="+id});
   }
  }
  return videos;
 }catch{return []}
}
export async function onRequest({request,env}){
 const error=await authorized(request,env);
 if(error)return reply({error},401);
 if(request.method!=="POST")return reply({error:"Method not allowed"},405);
 if(request.headers.get("Origin")!==new URL(request.url).origin)return reply({error:"Not an authorized browser origin"},403);
 if(!env.BAND_CONTENT)return reply({error:"Cloudflare content storage binding missing"},503);
 try{
   const store=env.BAND_CONTENT.getByName("interstate90s-content");
   if(!await store.getSnapshot()){
     if(!env.ASSETS)return reply({error:"Site assets missing"},503);
     const seed=await env.ASSETS.fetch(new Request("https://assets.local/content.json"));
     if(!seed.ok)return reply({error:"Seed data missing"},503);
     await store.mergeSeed(await seed.json());
   }
   let posts=[],method="";
   for(const [name,fn] of [["WordPress REST",attemptRest],["WordPress RSS",attemptRss],["WordPress HTML archive",attemptHTML]]){
     try{posts=await fn();if(posts.length){method=name;break}}catch{}
   }
   if(!posts.length)return reply({error:"Could not retrieve any historical posts from the old WordPress site. Nothing was changed."},502);
   const result=await store.importArchive(posts);
   if(result.error)return reply({error:result.error},409);
   const legacyVideos=await findLegacyYouTubeVideos();
   const clipResult=legacyVideos.length?await store.importLegacyVideos(legacyVideos):{imported:0};
   return reply({ok:true,source:method,found:posts.length,imported:result.imported,total:result.total,videosImported:clipResult.imported||0});
 }catch{return reply({error:"History import failed. No existing events were deleted."},502)}
}
