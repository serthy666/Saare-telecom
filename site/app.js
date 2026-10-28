/* Boutique Saaré Télécom : vitrine et espace gérant.
   Les produits viennent de donnees/produits.json, écrit dans le dépôt GitHub par la fonction /api/gerant. */
var API="/api/gerant";

/* Illustrations provisoires pour les produits sans photo */
var DESSINS={
  portable:'<path d="M70 70h100v66H70z" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/><path d="M50 150h140l-12-14H62z" fill="#fff"/>',
  telephone:'<rect x="86" y="44" width="68" height="132" rx="12" fill="none" stroke="#fff" stroke-width="7"/><path d="M110 160h20" stroke="#fff" stroke-width="7" stroke-linecap="round"/>',
  chargeur:'<rect x="84" y="54" width="72" height="72" rx="14" fill="none" stroke="#fff" stroke-width="7"/><path d="M106 40v16M134 40v16M120 126v24c0 16 30 16 30 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>'
};
function dessin(nom){var c=["#2F6FDB","#0B2559"];
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="60" cy="40" r="90" fill="#fff" opacity=".12"/>'+DESSINS[nom]+'<text x="120" y="214" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#fff" opacity=".8">Photo à venir</text></svg>';
  return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)}

var RAYONS={
  tel:{nom:"Téléphones",long:"Téléphones & tablettes",hash:"telephones",ico:"ico-tel",cats:["Smartphones","Tablettes","Téléphones simples"]},
  pc:{nom:"Ordinateurs",long:"Ordinateurs",hash:"ordinateurs",ico:"ico-pc",cats:["Portables","Ordinateurs de bureau","Écrans & imprimantes","Stockage"]},
  autres:{nom:"Accessoires",long:"Accessoires & autres",hash:"accessoires",ico:"ico-autres",cats:["Chargeurs & câbles","Écouteurs & audio","Montres connectées","Autres appareils"]}
};
var ETATS={neuf:"Neuf",occasion:"Occasion",pieces:"Pièces détachées"};
var OFFRES={promo:"Promo",flash:"Vente flash",bf:"Black Friday"};
var WA_DEFAUT="237696300200",MAIL_DEFAUT="saaretelecom.shop@gmail.com";

function finDuJour(){var d=new Date();d.setHours(23,59,0,0);return locale(d)}
function locale(d){var p=function(n){return String(n).padStart(2,"0")};return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes())}
function nouvelId(){return"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function P(o){return Object.assign({id:nouvelId(),nom:"",marque:"",rayon:"tel",categorie:"Smartphones",etat:"neuf",details:"",garantie:"",prix:0,prixPromo:0,offre:"promo",fin:"",nouveau:false,stock:"ok",visible:true,photos:[]},o)}
function vide(){return{config:{whatsapp:WA_DEFAUT,gmail:MAIL_DEFAUT,evenement:"",evenementFin:""},produits:[]}}
function completer(d){d=d&&typeof d==="object"?d:vide();d.config=Object.assign(vide().config,d.config||{});d.produits=(d.produits||[]).map(P);return d}

var etat=vide();            // ce que la page affiche (le brouillon du gérant quand il modifie)
var publie=JSON.stringify(etat); // dernière version enregistrée
var version=null;            // version du fichier produits.json sur laquelle le gérant travaille
var nouvellesPhotos={};      // photos prises mais pas encore enregistrées : chemin -> image
var gerant=null;             // {jeton,email,proprietaire,expire}
var comptes=[],proprio="";
try{gerant=JSON.parse(sessionStorage.getItem("saare-gerant"))}catch(e){}
if(gerant&&!(gerant.expire>Date.now()/1000))gerant=null;

function fcfa(n){return Math.round(n).toLocaleString("fr-FR").replace(/[\s\u00a0\u202f]/g,"\u00a0")+"\u00a0FCFA"}
function photo(p,i){var k=p.photos[i||0];if(!k)return dessin(p.rayon==="pc"?"portable":p.rayon==="tel"?"telephone":"chargeur");return nouvellesPhotos[k]||k}
function expire(p){return p.offre==="flash"&&p.fin&&new Date(p.fin)<new Date()}
function enPromo(p){if(!(p.prixPromo>0&&p.prixPromo<p.prix))return false;if(expire(p))return false;if(p.offre==="bf"&&!etat.config.evenement)return false;return true}
function prixFinal(p){return enPromo(p)?p.prixPromo:p.prix}
function remise(p){return Math.round((1-p.prixPromo/p.prix)*100)}
function chiffres(n){return String(n||"").replace(/\D/g,"")}
function lienWa(texte){var n=chiffres(etat.config.whatsapp)||WA_DEFAUT;return"https://wa.me/"+n+"?text="+encodeURIComponent(texte)}
function restant(fin){var ms=new Date(fin)-new Date();if(ms<=0)return null;var s=Math.floor(ms/1000);return{j:Math.floor(s/86400),h:Math.floor(s%86400/3600),m:Math.floor(s%3600/60),s:s%60}}
function deux(n){return String(n).padStart(2,"0")}
function esc(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function blocPrix(p){var r=enPromo(p);return'<div class="prix">'+(r?"<s>"+fcfa(p.prix)+"</s>":"")+'<b class="'+(r?"reduit":"")+'">'+(p.prix?fcfa(prixFinal(p)):"Prix sur demande")+"</b></div>"}
var minuterie;function montrer(t,long){var el=document.getElementById("enregistre");el.textContent=t;clearTimeout(minuterie);minuterie=setTimeout(function(){el.textContent=""},long?6000:2200)}

/* Chargement du catalogue publié */
var charge=false;
function chargerBoutique(){
  return fetch("donnees/produits.json?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(d){if(gerant&&modifie())return;etat=completer(d);publie=JSON.stringify(etat)})
    .catch(function(){})
    .then(function(){charge=true;rendreBoutique()})}

/* Boutique */
var rayon="tous",etatFiltre="tous",filtre="tous";
function visibles(){return etat.produits.filter(function(p){return p.visible})}
function rendreRayons(){var v=visibles();
  var items=[["tous","Tout voir","ico-tout",v.length]].concat(Object.keys(RAYONS).map(function(k){return[k,RAYONS[k].nom,RAYONS[k].ico,v.filter(function(p){return p.rayon===k}).length]}));
  var zone=document.getElementById("rayons"),deja=zone.querySelectorAll("[data-rayon]");
  // Mise à jour sur place : la plaque touchée garde son rebond
  if(deja.length===items.length){items.forEach(function(r,i){deja[i].setAttribute("aria-pressed",rayon===r[0]);deja[i].querySelector("small").textContent=r[3]+" article"+(r[3]>1?"s":"")});return}
  zone.innerHTML=items.map(function(r){return'<button type="button" class="rayon verre" data-rayon="'+r[0]+'" aria-pressed="'+(rayon===r[0])+'"><svg aria-hidden="true"><use href="#'+r[2]+'"/></svg><span><b>'+r[1]+"</b><small>"+r[3]+" article"+(r[3]>1?"s":"")+"</small></span></button>"}).join("")}
function rendreFiltres(){
  document.getElementById("etats").innerHTML=[["tous","Tous états"]].concat(Object.keys(ETATS).map(function(k){return[k,ETATS[k]]})).map(function(f){return'<button type="button" data-etat="'+f[0]+'" aria-pressed="'+(etatFiltre===f[0])+'">'+f[1]+"</button>"}).join("");
  var marques=[];visibles().forEach(function(p){if((rayon==="tous"||p.rayon===rayon)&&p.marque&&marques.indexOf(p.marque)<0)marques.push(p.marque)});
  if(filtre!=="tous"&&filtre!=="offres"&&filtre!=="flash"&&marques.indexOf(filtre)<0)filtre="tous";
  var f=[["tous","Tout"],["offres","Promos"],["flash","Vente flash"]].concat(marques.sort().map(function(m){return[m,m]}));
  document.getElementById("filtres").innerHTML=f.map(function(x){return'<button type="button" data-f="'+esc(x[0])+'" aria-pressed="'+(filtre===x[0])+'">'+esc(x[1])+"</button>"}).join("")}
function garde(p){if(!p.visible)return false;if(rayon!=="tous"&&p.rayon!==rayon)return false;if(etatFiltre!=="tous"&&p.etat!==etatFiltre)return false;
  if(filtre==="offres")return enPromo(p);if(filtre==="flash")return enPromo(p)&&p.offre==="flash";if(filtre==="tous")return true;return p.marque===filtre}
function carte(p){var r=enPromo(p),o=r?p.offre:(p.nouveau?"nouveau":"");
  var badge=o?'<span class="badge '+o+'">'+(o==="nouveau"?"Nouveau":OFFRES[o])+"</span>":"";
  var rem=r?'<span class="remise">-'+remise(p)+"%</span>":"";
  var mins=r&&p.offre==="flash"&&p.fin?'<p class="minuteur" data-fin="'+esc(p.fin)+'"></p>':"";
  return'<article class="produit verre"><button class="photo" type="button" data-fiche="'+esc(p.id)+'" aria-label="Voir '+esc(p.nom)+'"><img src="'+esc(photo(p))+'" alt="'+esc(p.nom)+'" loading="lazy">'+badge+rem+"</button>"+
   '<div class="corps"><h3>'+esc(p.nom)+'</h3><p class="etat"><span class="e-'+p.etat+'">'+ETATS[p.etat]+"</span>"+(p.garantie?"<em>Garantie "+esc(p.garantie)+"</em>":"")+'</p><p class="details">'+esc(p.details)+"</p>"+mins+blocPrix(p)+
   '<p class="stock '+(p.stock==="peu"?"peu":"")+'">'+(p.stock==="peu"?"Dernières pièces":"En stock")+"</p>"+
   '<a class="bouton" target="_blank" rel="noopener" href="'+lienWa(messageCommande(p))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-wa"/></svg>Commander</a></div></article>'}
function messageCommande(p){return"Bonjour Saaré Télécom, je souhaite commander : "+p.nom+" ("+ETATS[p.etat]+(p.details?", "+p.details:"")+")"+(p.prix?" au prix de "+fcfa(prixFinal(p)):"")+". Est-il disponible ?"}
function videBoutique(){
  if(!charge)return'<p style="color:var(--texte-3)">Chargement des articles…</p>';
  if(!visibles().length)return'<div class="admin-intro verre" style="grid-column:1/-1">Les articles arrivent très bientôt. En attendant, dites-nous ce que vous cherchez sur WhatsApp : nous vous répondons en quelques minutes.</div>';
  return'<p style="color:var(--texte-3)">Aucun article dans cette sélection pour le moment.</p>'}
function rendreBoutique(){
  rendreRayons();rendreFiltres();
  var liste=etat.produits.filter(garde);
  document.getElementById("titre-catalogue").textContent=rayon==="tous"?"Nos boutiques":"Boutique "+RAYONS[rayon].long.toLowerCase();
  document.getElementById("grille").innerHTML=liste.length?liste.map(carte).join(""):videBoutique();
  document.getElementById("compte-produits").textContent=liste.length+" article"+(liste.length>1?"s":"");
  var c=etat.config,num=chiffres(c.whatsapp)||WA_DEFAUT,mail=(c.gmail||"").trim()||MAIL_DEFAUT;
  document.getElementById("wa-numero").textContent="+"+num.replace(/^(\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/,"$1 $2 $3 $4 $5 $6");
  document.getElementById("wa-a-remplir").hidden=true;
  document.getElementById("mail-adresse").textContent=mail;
  document.getElementById("mail-a-remplir").hidden=true;
  document.getElementById("mail-lien").href="mailto:"+mail+"?subject="+encodeURIComponent("Demande Saaré Télécom");
  var bonjour=lienWa("Bonjour Saaré Télécom, je cherche un appareil.");
  ["wa-heros","wa-contact","wa-flottant"].forEach(function(id){document.getElementById(id).href=bonjour});
  var meilleure=visibles().filter(enPromo).sort(function(a,b){return remise(b)-remise(a)})[0];
  var pa=document.getElementById("pastille");
  if(meilleure){pa.hidden=false;pa.innerHTML="<small>"+esc(meilleure.nom)+"</small>"+fcfa(meilleure.prixPromo)}else pa.hidden=true;
  tic()}
function tic(){
  var c=etat.config,ev=document.getElementById("evenement"),r=c.evenement&&c.evenementFin?restant(c.evenementFin):null;
  ev.hidden=!r;
  if(r){var mots=c.evenement.split(" "),der=mots.pop();document.getElementById("ev-nom").innerHTML=esc(mots.join(" "))+(mots.length?" ":"")+"<em>"+esc(der)+"</em>";
    document.getElementById("ev-compte").innerHTML=[[r.j,"jours"],[r.h,"h"],[r.m,"min"],[r.s,"s"]].map(function(x){return"<span>"+deux(x[0])+"<small>"+x[1]+"</small></span>"}).join("")}
  var perime=false;
  document.querySelectorAll(".minuteur").forEach(function(el){var t=restant(el.getAttribute("data-fin"));if(!t){perime=true;return}
    el.textContent="Fin de la vente flash dans "+(t.j?t.j+" j ":"")+deux(t.h)+":"+deux(t.m)+":"+deux(t.s)});
  if(perime)rendreBoutique()}
setInterval(tic,1000);

/* Fiche produit */
var voile=document.getElementById("voile");
function ouvrirFiche(id){var p=etat.produits.find(function(x){return x.id===id});if(!p)return;var n=Math.max(1,p.photos.length);
  voile.innerHTML='<div class="fiche verre" role="dialog" aria-modal="true" aria-label="'+esc(p.nom)+'"><button class="fermer" type="button" aria-label="Fermer" id="fermer">×</button>'+
   '<div class="galerie">'+Array.from({length:n},function(_,i){return'<img src="'+esc(photo(p,i))+'" alt="'+esc(p.nom)+" photo "+(i+1)+'">'}).join("")+"</div>"+
   (n>1?'<p style="color:var(--texte-3);font-size:13px;margin:6px 0 0">Glissez pour voir les '+n+" photos</p>":"")+
   "<h3>"+esc(p.nom)+'</h3><p class="etat"><span class="e-'+p.etat+'">'+ETATS[p.etat]+"</span><em>"+esc(RAYONS[p.rayon].nom+" · "+p.categorie)+(p.garantie?" · Garantie "+esc(p.garantie):"")+'</em></p><p class="details" style="color:var(--texte-2)">'+esc(p.details)+"</p>"+blocPrix(p)+
   '<a class="bouton" style="width:100%;margin-top:14px" target="_blank" rel="noopener" href="'+lienWa(messageCommande(p))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-wa"/></svg>Commander sur WhatsApp</a></div>';
  voile.hidden=false;document.getElementById("fermer").focus()}
voile.addEventListener("click",function(e){if(e.target===voile||e.target.id==="fermer")voile.hidden=true});
document.addEventListener("keydown",function(e){if(e.key==="Escape")voile.hidden=true});

document.addEventListener("click",function(e){
  var r=e.target.closest("[data-rayon]");if(r){choisirRayon(r.getAttribute("data-rayon"));return}
  var et=e.target.closest("[data-etat]");if(et){etatFiltre=et.getAttribute("data-etat");rendreBoutique();return}
  var f=e.target.closest("[data-f]");if(f){filtre=f.getAttribute("data-f");rendreBoutique();onglet();return}
  var fi=e.target.closest("[data-fiche]");if(fi){ouvrirFiche(fi.getAttribute("data-fiche"));return}
  var cp=e.target.closest("[data-copier]");if(cp){var t=document.getElementById(cp.getAttribute("data-copier")).textContent;
    var ok=function(){cp.textContent="Copié"};var non=function(){var rg=document.createRange();rg.selectNodeContents(document.getElementById(cp.getAttribute("data-copier")));var s=getSelection();s.removeAllRanges();s.addRange(rg);cp.textContent="Sélectionné"};
    try{navigator.clipboard.writeText(t).then(ok,non)}catch(err){non()}setTimeout(function(){cp.textContent="Copier"},1800)}
});
function choisirRayon(k){rayon=k;filtre="tous";var h=k==="tous"?"#catalogue":"#"+RAYONS[k].hash;if(location.hash!==h)history.replaceState(null,"",h);rendreBoutique();onglet()}
["voir-promos","lien-promos"].forEach(function(id){document.getElementById(id).addEventListener("click",function(){filtre="offres";rendreBoutique();onglet()})});

/* Relief 3D : les plaques de verre s'inclinent et le reflet suit le doigt ou la souris.
   Sur téléphone, le doigt fait pencher la plaque, puis elle revient avec un petit rebond ;
   l'affiche d'accueil suit aussi l'inclinaison du téléphone. */
var calme=matchMedia("(prefers-reduced-motion: reduce)").matches;
var RELIEF=".produit,.rayon,.tuile,.canal,.connexion,.evenement";
function incliner(el,x,y,fort){var b=el.getBoundingClientRect(),px=Math.min(1,Math.max(0,(x-b.left)/b.width)),py=Math.min(1,Math.max(0,(y-b.top)/b.height)),k=el.classList.contains("produit")?1:.45;
  el.style.transform="rotateX("+((.5-py)*14*k).toFixed(2)+"deg) rotateY("+((px-.5)*16*k).toFixed(2)+"deg) translateZ(6px)"+(fort?" scale(.975)":"");
  el.style.setProperty("--mx",(px*100).toFixed(1)+"%");el.style.setProperty("--my",(py*100).toFixed(1)+"%")}
function relacher(el){el.classList.add("rebond");el.style.transform="";el.style.setProperty("--mx","30%");el.style.setProperty("--my","0%");
  clearTimeout(el._rebond);el._rebond=setTimeout(function(){el.classList.remove("rebond")},650)}
if(!calme){
  var appui=null;
  document.addEventListener("pointerdown",function(e){var c=e.target.closest(RELIEF);if(!c)return;appui=c;c.classList.remove("rebond");c.classList.add("appui");incliner(c,e.clientX,e.clientY,true)},{passive:true});
  document.addEventListener("pointermove",function(e){
    if(appui){incliner(appui,e.clientX,e.clientY,true);return}
    if(e.pointerType!=="mouse")return;
    var c=e.target.closest(RELIEF);if(c)incliner(c,e.clientX,e.clientY,false)},{passive:true});
  function fin(){if(appui){appui.classList.remove("appui");relacher(appui);appui=null}}
  ["pointerup","pointercancel"].forEach(function(t){document.addEventListener(t,fin,{passive:true})});
  document.addEventListener("pointerout",function(e){if(e.pointerType!=="mouse")return;var c=e.target.closest(RELIEF);if(c&&!c.contains(e.relatedTarget)&&c!==appui)relacher(c)},{passive:true});
  // Affiche d'accueil : suit la souris, le doigt, ou l'inclinaison du téléphone
  var aff=document.getElementById("affiche"),scene=aff.parentNode,gyro=false;
  function pencher(ry,rx){aff.style.transform="rotateY("+ry.toFixed(1)+"deg) rotateX("+rx.toFixed(1)+"deg)"}
  scene.addEventListener("pointermove",function(e){var b=scene.getBoundingClientRect();pencher(((e.clientX-b.left)/b.width-.5)*28,(.5-(e.clientY-b.top)/b.height)*18)});
  scene.addEventListener("pointerdown",function(e){var b=scene.getBoundingClientRect();pencher(((e.clientX-b.left)/b.width-.5)*34,(.5-(e.clientY-b.top)/b.height)*22)});
  scene.addEventListener("pointerleave",function(){if(!gyro)aff.style.transform=""});
  scene.addEventListener("pointerup",function(){if(!gyro){aff.style.transform="";aff.classList.add("rebond");setTimeout(function(){aff.classList.remove("rebond")},650)}});
  window.addEventListener("deviceorientation",function(e){if(e.gamma==null||e.beta==null)return;gyro=true;
    var g=Math.max(-30,Math.min(30,e.gamma)),bt=Math.max(-30,Math.min(30,e.beta-45));pencher(-14+g*.9,6-bt*.5)},{passive:true});
}

/* Appels à la fonction gérant */
function appel(methode,corps,action){
  var h={"content-type":"application/json"};if(gerant)h.authorization="Bearer "+gerant.jeton;
  return fetch(API+(action?"?action="+action:""),{method:methode,headers:h,body:corps?JSON.stringify(corps):undefined})
    .then(function(r){return r.json().catch(function(){return{}}).then(function(d){if(!r.ok){var e=new Error(d.erreur||"Le serveur ne répond pas, réessayez.");e.statut=r.status;throw e}return d})},
          function(){var e=new Error("Pas de connexion internet. Vérifiez le réseau puis réessayez.");e.statut=0;throw e})}
function sessionPerdue(e){if(e.statut===401||e.statut===403){deconnecter();var rf=document.getElementById("refus");rf.hidden=false;rf.textContent=e.message;return true}return false}

/* Connexion du gérant avec Google */
var googlePret=false;
function preparerGoogle(){
  if(googlePret)return;googlePret=true;
  appel("GET",null,"config").then(function(c){
    var att=document.getElementById("google-attente");
    if(!c.clientId||!c.pret){att.textContent="L'espace gérant n'est pas encore configuré.";return}
    var s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
    s.onload=function(){google.accounts.id.initialize({client_id:c.clientId,callback:function(rep){connexion(rep.credential)},ux_mode:"popup",auto_select:false});
      att.remove();google.accounts.id.renderButton(document.getElementById("btn-google"),{theme:"filled_blue",size:"large",shape:"pill",text:"signin_with",locale:"fr",width:280})};
    s.onerror=function(){googlePret=false;att.textContent="Impossible de joindre Google. Vérifiez la connexion internet, puis rechargez la page."};
    document.head.appendChild(s)
  }).catch(function(e){googlePret=false;document.getElementById("google-attente").textContent=e.message})}
function connexion(credential){
  var rf=document.getElementById("refus");rf.hidden=true;
  appel("POST",{action:"connexion",credential:credential}).then(function(g){
    gerant=g;try{sessionStorage.setItem("saare-gerant",JSON.stringify(g))}catch(e){}
    chargerAdmin()
  }).catch(function(e){rf.hidden=false;rf.textContent=e.message})}
function deconnecter(){gerant=null;version=null;adminCharge=false;document.getElementById("chargement").hidden=true;try{sessionStorage.removeItem("saare-gerant")}catch(e){}
  if(window.google&&google.accounts)google.accounts.id.disableAutoSelect();nouvellesPhotos={};route();chargerBoutique()}
document.getElementById("deconnexion").addEventListener("click",function(){
  if(modifie()&&!confirmerAbandon){confirmerAbandon=true;this.textContent="Abandonner les changements ?";var b=this;setTimeout(function(){confirmerAbandon=false;b.textContent="Se déconnecter"},3000);return}
  confirmerAbandon=false;this.textContent="Se déconnecter";etat=JSON.parse(publie);deconnecter()});
var confirmerAbandon=false;

/* Espace gérant */
var ouvert=null,rayonAdmin="tous",adminCharge=false,chargementAdmin=false;
function chargerAdmin(){
  adminCharge=false;chargementAdmin=true;route();var ch=document.getElementById("chargement");ch.hidden=false;ch.textContent="Chargement du tableau de bord…";
  return appel("GET",null,"donnees").then(function(d){chargementAdmin=false;
    if(!modifie()||version===null){etat=completer(d.donnees);publie=JSON.stringify(etat);version=d.version}
    comptes=d.comptes||[];proprio=d.proprietaire;gerant.email=d.moi;
    adminCharge=true;document.getElementById("chargement").hidden=true;route();rendreBoutique()
  }).catch(function(e){chargementAdmin=false;document.getElementById("chargement").textContent=e.message;sessionPerdue(e)})}
function estProprio(){return!!gerant&&gerant.email===proprio}
function modifie(){return JSON.stringify(etat)!==publie}
function options(liste,val){return liste.map(function(x){return'<option value="'+esc(x[0])+'"'+(x[0]===val?" selected":"")+">"+esc(x[1])+"</option>"}).join("")}
function rendreAdmin(){
  document.getElementById("qui").textContent=gerant.email+(estProprio()?" (propriétaire)":"");
  var c=etat.config;
  document.getElementById("cfg-wa").value=c.whatsapp||"";document.getElementById("cfg-mail").value=c.gmail||"";
  document.getElementById("cfg-ev").value=c.evenement||"";document.getElementById("cfg-ev-fin").value=c.evenementFin||"";
  document.getElementById("admin-rayon").innerHTML=options([["tous","Toutes les boutiques"]].concat(Object.keys(RAYONS).map(function(k){return[k,RAYONS[k].long]})),rayonAdmin);
  var rs=[["tous","Toutes les boutiques"]].concat(Object.keys(RAYONS).map(function(k){return[k,RAYONS[k].long]})),pr=document.getElementById("pr-rayon"),pe=document.getElementById("pr-etat"),v1=pr.value||rayonAdmin,v2=pe.value||"tous";
  pr.innerHTML=options(rs,v1);pe.innerHTML=options([["tous","Tous les états"]].concat(Object.keys(ETATS).map(function(k){return[k,ETATS[k]]})),v2);
  if(!document.getElementById("pr-fin").value)document.getElementById("pr-fin").value=finDuJour();
  rendreTuiles();rendreComptes();rendreListeAdmin();apercuPromo();barre()}
function rendreListeAdmin(){if(document.getElementById("tuiles").childElementCount)rendreTuiles();
  var l=etat.produits.map(function(p,i){return[p,i]}).filter(function(x){return rayonAdmin==="tous"||x[0].rayon===rayonAdmin});
  document.getElementById("admin-compte").textContent=l.length+" article"+(l.length>1?"s":"");
  document.getElementById("admin-liste").innerHTML=l.length?l.map(function(x){return ligneAdmin(x[0],x[1])}).join(""):'<p class="note-demo">Aucun produit pour l\'instant. Touchez « + Ajouter un produit », prenez une photo, entrez le prix, puis « Enregistrer ».</p>';
  barre()}
function resume(p){var r=enPromo(p);return(r?"<s>"+fcfa(p.prix)+"</s><em>"+fcfa(p.prixPromo)+"</em>":fcfa(p.prix))}
function ligneAdmin(p,i){
  var cats=RAYONS[p.rayon].cats.map(function(c){return[c,c]});
  if(cats.every(function(c){return c[0]!==p.categorie})&&p.categorie)cats.push([p.categorie,p.categorie]);
  return'<details class="fiche-admin" data-i="'+i+'"'+(ouvert===p.id?" open":"")+"><summary><img src=\""+esc(photo(p))+'" alt=""><span><b>'+esc(p.nom||"Sans nom")+"</b><small>"+esc(RAYONS[p.rayon].nom+" · "+ETATS[p.etat])+(p.visible?"":" · masqué")+'</small></span><span class="p" id="res-'+i+'">'+resume(p)+"</span></summary>"+
   '<div class="editeur"><div class="photos">'+p.photos.map(function(k,j){return'<figure><img src="'+esc(photo(p,j))+'" alt="Photo '+(j+1)+'"><button type="button" data-retirer="'+j+'" aria-label="Retirer la photo '+(j+1)+'">×</button></figure>'}).join("")+
   '<label class="ajout-photo">Prendre une photo<input type="file" accept="image/*" capture="environment" data-champ="photos" id="cam-'+i+'"></label>'+
   '<label class="ajout-photo">+ Galerie<input type="file" accept="image/*" multiple data-champ="photos" id="ph-'+i+'"></label></div>'+
   '<div class="champs">'+
   '<div class="champ large"><label for="nom-'+i+'">Nom du produit</label><input id="nom-'+i+'" data-champ="nom" value="'+esc(p.nom)+'" maxlength="120"></div>'+
   '<div class="champ"><label for="ray-'+i+'">Boutique</label><select id="ray-'+i+'" data-champ="rayon">'+options(Object.keys(RAYONS).map(function(k){return[k,RAYONS[k].long]}),p.rayon)+"</select></div>"+
   '<div class="champ"><label for="cat-'+i+'">Catégorie</label><select id="cat-'+i+'" data-champ="categorie">'+options(cats,p.categorie)+"</select></div>"+
   '<div class="champ"><label for="eta-'+i+'">État</label><select id="eta-'+i+'" data-champ="etat">'+options(Object.keys(ETATS).map(function(k){return[k,ETATS[k]]}),p.etat)+"</select></div>"+
   '<div class="champ"><label for="mar-'+i+'">Marque</label><input id="mar-'+i+'" data-champ="marque" value="'+esc(p.marque)+'" maxlength="40"></div>'+
   '<div class="champ large"><label for="det-'+i+'">Caractéristiques</label><input id="det-'+i+'" data-champ="details" value="'+esc(p.details)+'" placeholder="Stockage · RAM · couleur" maxlength="300"></div>'+
   '<div class="champ"><label for="gar-'+i+'">Garantie</label><input id="gar-'+i+'" data-champ="garantie" value="'+esc(p.garantie)+'" placeholder="12 mois" maxlength="40"></div>'+
   '<div class="champ"><label for="prix-'+i+'">Prix normal (FCFA)</label><input id="prix-'+i+'" data-champ="prix" type="number" inputmode="numeric" step="500" min="0" value="'+(p.prix||"")+'"></div>'+
   '<div class="champ promo-zone"><label for="pp-'+i+'">Promotion</label><div class="champs">'+
     '<div class="champ"><label for="pp-'+i+'">Prix promo (FCFA)</label><input id="pp-'+i+'" data-champ="prixPromo" type="number" inputmode="numeric" step="500" min="0" value="'+(p.prixPromo||"")+'" placeholder="vide = pas de promo"></div>'+
     '<div class="champ"><label for="off-'+i+'">Type</label><select id="off-'+i+'" data-champ="offre">'+options(Object.keys(OFFRES).map(function(k){return[k,OFFRES[k]]}),p.offre)+"</select></div>"+
     '<div class="champ"'+(p.offre==="flash"?"":" hidden")+'><label for="fin-'+i+'">Fin de la vente flash</label><input id="fin-'+i+'" data-champ="fin" type="datetime-local" value="'+esc(p.fin)+'"></div>'+
     '<p class="apercu-prix" id="ap-'+i+'">'+apercu(p)+"</p></div></div>"+
   '<div class="champ"><label for="stk-'+i+'">Stock</label><select id="stk-'+i+'" data-champ="stock">'+options([["ok","En stock"],["peu","Dernières pièces"]],p.stock)+"</select></div>"+
   '<div class="champ"><label for="nv-'+i+'">Badge « Nouveau »</label><input id="nv-'+i+'" data-champ="nouveau" type="checkbox"'+(p.nouveau?" checked":"")+"></div>"+
   '<div class="champ"><label for="vis-'+i+'">Afficher en boutique</label><input id="vis-'+i+'" data-champ="visible" type="checkbox"'+(p.visible?" checked":"")+"></div>"+
   '</div><button class="danger" type="button" data-supprimer="'+i+'">Supprimer ce produit</button></div></details>'}
function apercu(p){if(enPromo(p))return"En boutique : <s>"+fcfa(p.prix)+"</s> puis <b>"+fcfa(p.prixPromo)+"</b> (-"+remise(p)+" %)";
  if(p.prixPromo>0&&p.prixPromo>=p.prix)return"Le prix promo doit être plus bas que le prix normal.";
  if(expire(p))return"Vente flash terminée : prix normal <b>"+fcfa(p.prix)+"</b>";
  if(p.prixPromo>0&&p.offre==="bf"&&!etat.config.evenement)return"Promo Black Friday en attente : activez l'événement plus bas.";
  return"Pas de promo : <b>"+fcfa(p.prix)+"</b>"}
function changer(){barre();rendreBoutique()}
function majConfig(){var c=etat.config;c.whatsapp=document.getElementById("cfg-wa").value;c.gmail=document.getElementById("cfg-mail").value;
  c.evenement=document.getElementById("cfg-ev").value;c.evenementFin=document.getElementById("cfg-ev-fin").value;
  if(c.evenement&&!c.evenementFin){c.evenementFin=locale(new Date(Date.now()+7*864e5));document.getElementById("cfg-ev-fin").value=c.evenementFin}
  changer();rendreListeAdmin()}
["cfg-wa","cfg-mail","cfg-ev","cfg-ev-fin"].forEach(function(id){document.getElementById(id).addEventListener("input",majConfig)});
document.getElementById("admin-rayon").addEventListener("change",function(e){rayonAdmin=e.target.value;rendreTuiles();rendreListeAdmin()});
var liste=document.getElementById("admin-liste");
liste.addEventListener("toggle",function(e){var d=e.target,p=etat.produits[+d.getAttribute("data-i")];if(!p)return;if(d.open)ouvert=p.id;else if(ouvert===p.id)ouvert=null},true);
liste.addEventListener("input",function(e){var el=e.target,ch=el.getAttribute("data-champ");if(!ch||ch==="photos")return;
  var i=+el.closest(".fiche-admin").getAttribute("data-i"),p=etat.produits[i];
  if(ch==="prix"||ch==="prixPromo")p[ch]=Math.max(0,Math.round(+el.value||0));else if(ch==="visible"||ch==="nouveau")p[ch]=el.checked;else p[ch]=el.value;
  if(ch==="rayon"){p.categorie=RAYONS[p.rayon].cats[0]}
  if(ch==="offre"&&el.value==="flash"&&!p.fin)p.fin=finDuJour();
  if(ch==="rayon"||ch==="offre"||ch==="etat"||ch==="visible"){rendreListeAdmin();changer();return}
  document.getElementById("ap-"+i).innerHTML=apercu(p);document.getElementById("res-"+i).innerHTML=resume(p);
  if(ch==="nom"){el.closest(".fiche-admin").querySelector("summary b").textContent=p.nom||"Sans nom"}
  rendreTuiles();changer()});
// Le téléphone réduit chaque photo à 700 px (carré) avant l'envoi : elle passe même en 3G
function reduire(fichier,fin){var lecteur=new FileReader();lecteur.onload=function(){var img=new Image();img.onload=function(){var t=700,cv=document.createElement("canvas"),s=Math.min(img.width,img.height);cv.width=cv.height=t;
  cv.getContext("2d").drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,t,t);fin(cv.toDataURL("image/jpeg",.8))};img.onerror=function(){fin(null)};img.src=lecteur.result};lecteur.onerror=function(){fin(null)};lecteur.readAsDataURL(fichier)}
function cheminPhoto(p){return"photos/"+String(p.id).toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,40)+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)+".jpg"}
liste.addEventListener("change",function(e){var el=e.target;if(el.getAttribute("data-champ")!=="photos"||!el.files.length)return;
  var i=+el.closest(".fiche-admin").getAttribute("data-i"),p=etat.produits[i],fichiers=Array.from(el.files),reste=fichiers.length;
  fichiers.forEach(function(f){reduire(f,function(url){if(url){var ch=cheminPhoto(p);nouvellesPhotos[ch]=url;p.photos.push(ch)}else montrer("Une photo n'a pas pu être lue",true);
    if(--reste===0){rendreListeAdmin();changer()}})})});
var aSupprimer=null;
liste.addEventListener("click",function(e){
  var rt=e.target.closest("[data-retirer]");if(rt){var i=+rt.closest(".fiche-admin").getAttribute("data-i");etat.produits[i].photos.splice(+rt.getAttribute("data-retirer"),1);rendreListeAdmin();changer();return}
  var sp=e.target.closest("[data-supprimer]");if(sp){var j=+sp.getAttribute("data-supprimer");
    if(aSupprimer!==j){aSupprimer=j;sp.textContent="Confirmer la suppression";setTimeout(function(){if(aSupprimer===j){aSupprimer=null;sp.textContent="Supprimer ce produit"}},3000);return}
    aSupprimer=null;etat.produits.splice(j,1);rendreListeAdmin();changer()}});
document.getElementById("ajouter").addEventListener("click",function(){
  var r=rayonAdmin==="tous"?"tel":rayonAdmin,p=P({nom:"Nouveau produit",rayon:r,categorie:RAYONS[r].cats[0]});
  etat.produits.unshift(p);ouvert=p.id;rendreListeAdmin();changer();var n=document.getElementById("nom-0");if(n){n.focus();n.select()}});

/* Enregistrer : tous les changements partent d'un coup */
function nbChangements(){var avant=JSON.parse(publie),n=0,m={};avant.produits.forEach(function(p){m[p.id]=JSON.stringify(p)});
  etat.produits.forEach(function(p){if(m[p.id]!==JSON.stringify(p))n++;delete m[p.id]});n+=Object.keys(m).length;
  if(JSON.stringify(avant.config)!==JSON.stringify(etat.config))n++;return n}
var enCours=false;
function barre(){var b=document.getElementById("sauvegarde"),admin=location.hash==="#admin"&&!!gerant&&adminCharge;
  if(!admin||(!modifie()&&!enCours)){b.hidden=true;return}
  b.hidden=false;b.classList.remove("erreur-sv");var n=nbChangements();
  document.getElementById("sv-texte").innerHTML=enCours?"Enregistrement…":n+" changement"+(n>1?"s":"")+'<i class="sv-plus"> à enregistrer</i>';
  document.getElementById("enregistrer").disabled=enCours;document.getElementById("annuler").hidden=enCours}
document.getElementById("annuler").addEventListener("click",function(){etat=JSON.parse(publie);nouvellesPhotos={};ouvert=null;rendreAdmin();rendreBoutique()});
document.getElementById("enregistrer").addEventListener("click",function(){
  if(enCours)return;
  var faux=etat.produits.filter(function(p){return p.prixPromo>0&&p.prixPromo>=p.prix});
  if(faux.length){montrer("Corrigez d'abord le prix promo de « "+(faux[0].nom||"Sans nom")+" » : il doit être plus bas que le prix normal.",true);return}
  enCours=true;barre();
  var utilisees={};etat.produits.forEach(function(p){p.photos.forEach(function(k){utilisees[k]=1})});
  var photos=Object.keys(nouvellesPhotos).filter(function(k){return utilisees[k]}).map(function(k){return{chemin:k,data:nouvellesPhotos[k]}});
  var envoye=JSON.stringify(etat);
  appel("POST",{action:"enregistrer",donnees:etat,version:version,photos:photos}).then(function(r){
    enCours=false;version=r.version;publie=envoye;
    montrer("Enregistré. Les clients le verront dans une minute environ.",true);barre();rendreTuiles()
  }).catch(function(e){enCours=false;barre();
    if(sessionPerdue(e))return;
    var b=document.getElementById("sauvegarde");b.classList.add("erreur-sv");document.getElementById("sv-texte").textContent=e.statut===409?"Conflit : rechargez":"Échec, réessayez";
    montrer(e.message,true)})});
window.addEventListener("beforeunload",function(e){if(gerant&&modifie()){e.preventDefault();e.returnValue=""}});

/* Administrateurs : seul le propriétaire invite ou retire */
function rendreComptes(){var p=estProprio();
  document.getElementById("comptes").innerHTML='<li><span>'+esc(proprio)+'</span><span class="droite"><span class="statut proprio">Propriétaire</span></span></li>'+comptes.map(function(x){return"<li><span>"+esc(x.email)+'</span><span class="droite"><span class="statut '+(x.statut==="actif"?"actif":"invite")+'">'+(x.statut==="actif"?"Actif":"Invité")+"</span>"+(p?'<button class="lien-bouton" type="button" data-retirer-compte="'+esc(x.email)+'">Retirer</button>':"")+"</span></li>"}).join("");
  document.getElementById("zone-ajout-compte").hidden=!p;document.getElementById("note-comptes").hidden=p}
function lienBoutique(){return location.origin+"/"}
document.getElementById("ajouter-compte").addEventListener("click",function(){var ip=document.getElementById("nouveau-compte"),m=ip.value.trim().toLowerCase(),er=document.getElementById("erreur-compte"),bt=this;
  if(!/^[^\s@]+@(gmail|googlemail)\.com$/.test(m)){er.hidden=false;er.textContent="Entrez une adresse Gmail complète, par exemple prenom.nom@gmail.com.";return}
  if(m===proprio||comptes.some(function(c){return c.email===m})){er.hidden=false;er.textContent="Ce compte est déjà administrateur.";return}
  er.hidden=true;bt.disabled=true;bt.textContent="Invitation…";
  appel("POST",{action:"inviter",email:m}).then(function(r){comptes=r.comptes;ip.value="";rendreComptes();
    var t="Bonjour, vous êtes invité comme administrateur de la boutique Saaré Télécom. Ouvrez "+lienBoutique()+"#admin et connectez-vous avec votre compte Google "+m+".";
    document.getElementById("texte-invit").textContent=t;document.getElementById("invit-wa").href="https://wa.me/?text="+encodeURIComponent(t);document.getElementById("invitation").hidden=false})
  .catch(function(e){if(!sessionPerdue(e)){er.hidden=false;er.textContent=e.message}})
  .then(function(){bt.disabled=false;bt.textContent="Inviter"})});
document.getElementById("comptes").addEventListener("click",function(e){var b=e.target.closest("[data-retirer-compte]");if(!b)return;
  var m=b.getAttribute("data-retirer-compte");
  if(b.getAttribute("data-confirmer")!=="1"){b.setAttribute("data-confirmer","1");b.textContent="Confirmer";setTimeout(function(){b.removeAttribute("data-confirmer");b.textContent="Retirer"},3000);return}
  b.disabled=true;b.textContent="Retrait…";
  appel("POST",{action:"retirer",email:m}).then(function(r){comptes=r.comptes;rendreComptes();montrer(m+" n'a plus accès")})
  .catch(function(e){if(!sessionPerdue(e)){montrer(e.message,true);rendreComptes()}})});

/* Tableau de bord : résumé de toutes les boutiques */
function rendreTuiles(){var t=[["tous","Toutes"]].concat(Object.keys(RAYONS).map(function(k){return[k,RAYONS[k].nom]}));
  document.getElementById("tuiles").innerHTML=t.map(function(x){var l=etat.produits.filter(function(p){return x[0]==="tous"||p.rayon===x[0]}),pr=l.filter(enPromo).length,fl=l.filter(function(p){return enPromo(p)&&p.offre==="flash"}).length,ms=l.filter(function(p){return!p.visible}).length;
    return'<button type="button" class="tuile verre" data-tuile="'+x[0]+'" aria-pressed="'+(rayonAdmin===x[0])+'"><small>'+x[1]+"</small><b>"+l.length+"</b><span>"+(pr?"<em>"+pr+" en promo</em>":"Aucune promo")+(fl?" · "+fl+" flash":"")+(ms?" · "+ms+" masqué"+(ms>1?"s":""):"")+"</span></button>"}).join("")}
document.getElementById("tuiles").addEventListener("click",function(e){var b=e.target.closest("[data-tuile]");if(!b)return;rayonAdmin=b.getAttribute("data-tuile");document.getElementById("admin-rayon").value=rayonAdmin;document.getElementById("pr-rayon").value=rayonAdmin;rendreTuiles();rendreListeAdmin();apercuPromo()});

/* Lancer une promotion sur une sélection */
function selectionPromo(){var r=document.getElementById("pr-rayon").value,e=document.getElementById("pr-etat").value;return etat.produits.filter(function(p){return(r==="tous"||p.rayon===r)&&(e==="tous"||p.etat===e)&&p.prix>0})}
function apercuPromo(){var l=selectionPromo(),rm=Math.min(90,Math.max(0,+document.getElementById("pr-remise").value||0)),t=document.getElementById("pr-type").value;
  document.getElementById("pr-fin-zone").hidden=t!=="flash";
  document.getElementById("pr-lancer").textContent="Lancer sur "+l.length+" article"+(l.length>1?"s":"");
  var ex=l[0];document.getElementById("pr-apercu").innerHTML=ex&&rm?"Exemple : "+esc(ex.nom)+" passe de <s>"+fcfa(ex.prix)+"</s> à <b>"+fcfa(Math.round(ex.prix*(1-rm/100)/500)*500)+"</b>.":""}
["pr-rayon","pr-etat","pr-type","pr-remise","pr-fin"].forEach(function(id){document.getElementById(id).addEventListener("input",apercuPromo)});
document.getElementById("pr-lancer").addEventListener("click",function(){var rm=Math.min(90,Math.max(1,+document.getElementById("pr-remise").value||0)),t=document.getElementById("pr-type").value,fin=document.getElementById("pr-fin").value||finDuJour(),l=selectionPromo();
  l.forEach(function(p){p.prixPromo=Math.round(p.prix*(1-rm/100)/500)*500;p.offre=t;if(t==="flash")p.fin=fin});
  if(t==="bf"&&!etat.config.evenement){etat.config.evenement="Black Friday";if(!etat.config.evenementFin)etat.config.evenementFin=new Date().getFullYear()+"-11-30T23:59"}
  rendreAdmin();rendreBoutique();montrer("Promo prête sur "+l.length+" article"+(l.length>1?"s":"")+" : touchez « Enregistrer »",true)});
document.getElementById("pr-arreter").addEventListener("click",function(){var l=selectionPromo();l.forEach(function(p){p.prixPromo=0});rendreAdmin();rendreBoutique();montrer("Promos retirées sur "+l.length+" article"+(l.length>1?"s":"")+" : touchez « Enregistrer »",true)});

/* Navigation : #boutique, #telephones, #ordinateurs, #accessoires, #contact, #admin */
function route(){var h=location.hash,admin=h==="#admin";
  Object.keys(RAYONS).forEach(function(k){if(h==="#"+RAYONS[k].hash){rayon=k;filtre="tous";rendreBoutique();setTimeout(function(){document.getElementById("catalogue").scrollIntoView()},0)}});
  if(h==="#boutique"&&(rayon!=="tous"||etatFiltre!=="tous")){rayon="tous";etatFiltre="tous";rendreBoutique()}
  document.getElementById("vue-boutique").hidden=admin;
  document.getElementById("vue-connexion").hidden=!(admin&&!gerant);
  document.getElementById("vue-admin").hidden=!(admin&&gerant);
  document.getElementById("wa-flottant").hidden=admin;
  if(admin&&!gerant)preparerGoogle();
  if(admin&&gerant&&!adminCharge&&!chargementAdmin){chargerAdmin();return}
  ["tuiles","bloc-produits","bloc-comptes"].forEach(function(id){document.getElementById(id).hidden=!adminCharge});
  document.querySelectorAll("#vue-admin .admin-bloc").forEach(function(b){b.hidden=!adminCharge});
  onglet();if(admin&&gerant&&adminCharge)rendreAdmin();else barre()}
function onglet(){var h=location.hash,cur=h==="#admin"?"lien-admin":h==="#contact"?"lien-contact":filtre==="offres"?"lien-promos":"lien-boutique";
  ["lien-boutique","lien-promos","lien-contact","lien-admin"].forEach(function(id){document.getElementById(id).setAttribute("aria-current",id===cur?"page":"false")})}
window.addEventListener("hashchange",route);
rendreBoutique();chargerBoutique();route();
