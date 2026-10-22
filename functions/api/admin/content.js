const REPO="cchandler313/i90sdet", PATH="content.json";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const fail=(message,status)=>json({error:message},status);
function base64urlDecode(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(b+"=".repeat((4-b.length%4)%4)),c=>c.charCodeAt(0))}
async function authorized(request,env){
 const domain=String(env.CF_ACCESS_TEAM_DOMAIN||"").trim().replace(/\/$/,"");
 const audience=String(env.CF_ACCESS_AUD||"").trim();
 if(!domain||!audience||!/^https:\/\/[a-z0-9.-]+$/i.test(domain))return false;
 const token=request.headers.get("Cf-Access-Jwt-Assertion");
 if(!token)return false;
 try{
  const parts=token.split(".");if(parts.length!==3)return false;
  const header=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
  if(header.alg!=="RS256"||!header.kid||!Array.isArray(claims.aud)||!claims.aud.includes(audience)||claims.iss!==domain||typeof claims.exp!=="number"||claims.exp<=Date.now()/1000||typeof claims.nbf==="number"&&claims.nbf>Date.now()/1000||!claims.email)return false;
  const response=await fetch(domain+"/cdn-cgi/access/certs");if(!response.ok)return false;
  const keys=await response.json();const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256"));if(!jwk)return false;
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const msg=new TextEncoder().encode(parts[0]+"."+parts[1]);
  return await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64urlDecode(parts[2]),msg);
 }catch{return false}
}
async function github(env,method="GET",body,sha){
 if(!env.GITHUB_TOKEN)throw Error("GitHub token is not configured");
 const url="https://api.github.com/repos/"+REPO+"/contents/"+PATH;
 const r=await fetch(url,{method,headers:{"accept":"application/vnd.github+json","authorization":"Bearer "+env.GITHUB_TOKEN,"x-github-api-version":"2022-11-28","user-agent":"i90sdet-admin","content-type":"application/json"},body:body?JSON.stringify(body):undefined});
 if(!r.ok){if(r.status===409||r.status===422)throw new Error("Content changed since you opened it. Reload before publishing.");throw new Error("GitHub returned "+r.status)}
 return r.json();
}
const decode=s=>{let x=atob(s.replace(/\s/g,""));return new TextDecoder().decode(Uint8Array.from(x,c=>c.charCodeAt(0)))};
const encode=s=>{const bytes=new TextEncoder().encode(s);let b="";for(let i=0;i<bytes.length;i++)b+=String.fromCharCode(bytes[i]);return btoa(b)};
function validate(data){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid data");
 for(const field of ["upcomingShows","recentShows","artists","videos"])if(!Array.isArray(data[field])||data[field].length>300)throw Error("Invalid "+field);
 const text=(v,max=180)=>typeof v==="string"&&v.length<=max;
 for(const e of [...data.upcomingShows,...data.recentShows])if(!e||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date+"T12:00:00Z"))||!text(e.venue)||!e.venue.trim()||!text(e.location)||!text(e.time,60)||!(e.url===undefined||e.url===""||validHttps(e.url)))throw Error("Invalid event fields");
 for(const v of data.videos)if(!v||!text(v.title)||!v.title.trim()||!text(v.url,600)||!validYoutube(v.url))throw Error("Invalid YouTube entry");
 for(const a of data.artists)if(!text(a,100))throw Error("Invalid artist");
}
function validHttps(s){try{return typeof s==="string"&&s.length<=600&&new URL(s).protocol==="https:"}catch{return false}}
function validYoutube(s){try{const u=new URL(s);if(!["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtube-nocookie.com"].includes(u.hostname))return false;if((u.hostname==="youtube.com"||u.hostname==="www.youtube.com")&&/^\/channel\/UC[a-zA-Z0-9_-]{22}\/?$/.test(u.pathname))return true;let id=u.hostname==="youtu.be"?u.pathname.slice(1):u.pathname.startsWith("/shorts/")?u.pathname.split("/")[2]:u.searchParams.get("v");return /^[a-zA-Z0-9_-]{11}$/.test(id||"")}catch{return false}}
export async function onRequest({request,env}){
 if(!await authorized(request,env))return fail("Unauthorized. Sign in through Cloudflare Access.",401);
 if(!env.GITHUB_TOKEN)return fail("Missing GITHUB_TOKEN secret.",503);
 try{
 if(request.method==="GET"){
  const f=await github(env);return json({sha:f.sha,data:JSON.parse(decode(f.content))});
 }
 if(request.method==="PUT"){
  if(Number(request.headers.get("content-length")||0)>100000)return fail("Payload too large",413);
  let input=await request.json();if(!input||typeof input.sha!=="string"||!input.sha||!input.data)return fail("Missing version or content",400);
  validate(input.data);
  const f=await github(env,"PUT",{message:"Update shows and YouTube videos via band admin",content:encode(JSON.stringify(input.data,null,2)+"\n"),sha:input.sha,branch:"main"});
  return json({ok:true,sha:f.content.sha,commit:f.commit.sha});
 }
 return fail("Method not allowed",405);
 }catch(e){return fail(e.message==="Content changed since you opened it. Reload before publishing."?e.message:"Publishing failed: "+e.message,e.message?.startsWith("Invalid")?400:409)}
}