const REPO="cchandler313/i90sdet", PATH="public/content.json";
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const fail=(message,status)=>json({error:message},status);
function base64urlDecode(s){let b=s.replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(b+"=".repeat((4-b.length%4)%4)),c=>c.charCodeAt(0))}
async function authorized(request,env){
 const domain=String(env.CF_ACCESS_TEAM_DOMAIN||"").trim().replace(/\/$/,"");
 const audience=String(env.CF_ACCESS_AUD||"").trim();
 const cookie=request.headers.get("Cookie")||"";
 const token=request.headers.get("Cf-Access-Jwt-Assertion")||cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith("CF_Authorization="))?.slice("CF_Authorization=".length);
 if(!token)return "No Cloudflare Access token reaches the API. Protect /api/admin/* in the Access application and sign in again.";
 try{
  const parts=token.split(".");if(parts.length!==3)return "Cloudflare Access token is malformed.";
  const header=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])));
  if(header.alg!=="RS256"||!header.kid)return "Invalid Access token signing method.";
  if(!Array.isArray(claims.aud)||!claims.aud.length||claims.aud.some(a=>typeof a!=="string"||!a))return "Invalid Access token audience.";
  // Access team hostname can be derived from the signed token when no explicit team is configured.
  // An explicit team and AUD still give stronger app-specific binding when provided.
  const issuer=claims.iss;
  if(typeof issuer!=="string"||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(issuer))return "Unrecognized Cloudflare Access issuer.";
  if(domain&&domain!==issuer)return "Access team domain mismatch.";
  if(audience&&!claims.aud.includes(audience))return "Access application audience mismatch.";
  if(typeof claims.exp!=="number"||claims.exp<=Date.now()/1000||typeof claims.nbf==="number"&&claims.nbf>Date.now()/1000)return "Cloudflare Access session expired. Sign in again.";
  const response=await fetch(issuer+"/cdn-cgi/access/certs");if(!response.ok)return "Cannot retrieve Access verification keys. Check the team domain setting.";
  const keys=await response.json();const jwk=keys.keys?.find(k=>k.kid===header.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256"));if(!jwk)return "Access signing key not recognized.";
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const msg=new TextEncoder().encode(parts[0]+"."+parts[1]);
  if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,base64urlDecode(parts[2]),msg))return "Cloudflare Access signature validation failed.";
  // Cloudflare normally embeds the login email in the signed application JWT.
  // When an IdP omits it, ask the same verified Cloudflare Access issuer for the user identity.
  let email=typeof claims.email==="string"?claims.email.trim().toLowerCase():"";
  if(!email){
    try{
      const idResponse=await fetch(issuer+"/cdn-cgi/access/get-identity",{
        headers:{"cookie":"CF_Authorization="+token,"accept":"application/json"}
      });
      if(idResponse.ok){
        const identity=await idResponse.json();
        if(typeof identity.email==="string")email=identity.email.trim().toLowerCase();
      }
    }catch{}
  }
  if(!email)return "Cloudflare accepted the OTP, but the session has no email identity. Sign out of Access and log in with one-time PIN again.";
  if(!["chandler313@gmail.com","schembrivicki@gmail.com"].includes(email)){
    const masked=email.replace(/^(.)([^@]*)(@.*)$/,(_m,first,middle,domain)=>first+"***"+domain);
    return "Cloudflare signed you in as "+masked+", not an approved band editor. Sign out of Access and log in with chandler313@gmail.com or schembrivicki@gmail.com.";
  }
  return null;
 }catch{return "Unable to validate Cloudflare Access token. Check Worker settings."}
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
 const authError=await authorized(request,env);if(authError)return fail(authError,401);
 if(request.method==="PUT"&&request.headers.get("Origin")!==new URL(request.url).origin)return fail("Publishing must originate from the band admin website.",403);
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