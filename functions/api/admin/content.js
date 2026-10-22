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
  const allowlist=["cchandler313@gmail.com","schembrivicki@gmail.com"];
  let email=typeof claims.email==="string"?claims.email.trim().toLowerCase():"";
  // Check the Cloudflare identity record as well when JWT email is absent or differs.
  // Do not let a caller supply the email through query params, request headers, or form data.
  if(!allowlist.includes(email)){
    try{
      const idResponse=await fetch(issuer+"/cdn-cgi/access/get-identity",{
        headers:{"cookie":"CF_Authorization="+token,"accept":"application/json"},
        redirect:"error"
      });
      if(idResponse.ok){
        const identity=await idResponse.json();
        if(typeof identity.email==="string"&&identity.email.trim())email=identity.email.trim().toLowerCase();
      }
    }catch{}
  }
  if(!email)return "Verified Access login has no email identity. Use the Switch account link and sign in through One-Time PIN.";
  if(!allowlist.includes(email)){
    // This runs only after Cloudflare Access JWT signature verification.
    // The signed-in visitor sees only their own verified email, never the allowlist.
    return "Cloudflare verified your login as "+email+", but that address is not on the admin allowlist. Check which address received the OTP, or use Switch account.";
  }
  return null;
 }catch{return "Unable to validate Cloudflare Access token. Check Worker settings."}
}
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
async function snapshot(env){
 if(!env.BAND_CONTENT||!env.ASSETS)throw Error("Cloudflare storage is not deployed. Check Durable Object binding and static assets.");
 const store=env.BAND_CONTENT.getByName("interstate90s-content");
 let current=await store.getSnapshot();
 if(!current){
   const seed=await env.ASSETS.fetch(new Request("https://assets.local/content.json"));
   if(!seed.ok)throw Error("The original content file could not be loaded.");
   current=await store.initialize(await seed.json());
 }
 return {store,current};
}
export async function onRequest({request,env}){
 const authError=await authorized(request,env);
 if(authError)return fail(authError,401);
 const url=new URL(request.url);
 if(request.method==="PUT"&&request.headers.get("Origin")!==url.origin)return fail("Publishing must originate from the band admin website.",403);
 try{
   if(request.method==="GET"){
     const {current}=await snapshot(env);
     return json({sha:current.sha,data:current.data});
   }
   if(request.method==="PUT"){
     if(Number(request.headers.get("content-length")||0)>100000)return fail("Content is too large.",413);
     let raw=await request.text();
     if(raw.length>100000)return fail("Content is too large.",413);
     let input;try{input=JSON.parse(raw)}catch{return fail("Invalid JSON payload.",400)}
     if(!input||typeof input.sha!=="string"||!input.sha||!input.data)return fail("Missing content version or data.",400);
     try{validate(input.data)}catch(e){return fail(e.message,400)}
     const {store}=await snapshot(env);
     const result=await store.save(input.sha,input.data);
     if(result.error)return fail(result.error,409);
     return json({ok:true,sha:result.sha});
   }
   return fail("Method not allowed.",405);
 }catch(e){return fail("Content storage unavailable. Check Worker deployment and logs.",503)}
}
