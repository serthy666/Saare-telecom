/* Boutique BIMAK Store : vitrine et espace gérant.
   Les produits viennent de donnees/produits.json, écrit dans le dépôt GitHub par la fonction /api/gerant. */
var API="/api/gerant";

/* Illustrations provisoires pour les produits sans photo */
var DESSINS={
  portable:'<path d="M70 70h100v66H70z" fill="none" stroke="#111" stroke-width="7" stroke-linejoin="round"/><path d="M50 150h140l-12-14H62z" fill="#111"/>',
  telephone:'<rect x="86" y="44" width="68" height="132" rx="12" fill="none" stroke="#111" stroke-width="7"/><path d="M110 160h20" stroke="#111" stroke-width="7" stroke-linecap="round"/>',
  tablette:'<rect x="66" y="52" width="108" height="140" rx="14" fill="none" stroke="#111" stroke-width="7"/><circle cx="120" cy="178" r="4" fill="#111"/>',
  machine:'<rect x="70" y="44" width="100" height="140" rx="12" fill="none" stroke="#111" stroke-width="7"/><path d="M70 72h100" stroke="#111" stroke-width="6"/><circle cx="120" cy="126" r="32" fill="none" stroke="#111" stroke-width="7"/>',
  chargeur:'<rect x="84" y="54" width="72" height="72" rx="14" fill="none" stroke="#111" stroke-width="7"/><path d="M106 40v16M134 40v16M120 126v24c0 16 30 16 30 34" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>'
};
function dessin(nom){var c=["#FFE15A","#F2A900"];
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><circle cx="60" cy="40" r="90" fill="#fff" opacity=".3"/>'+DESSINS[nom]+'<text x="120" y="214" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#111" opacity=".75">Photo à venir</text></svg>';
  return"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg)}

var RAYONS={
  tel:{nom:"Smartphones",long:"Smartphones & téléphones",hash:"smartphones",ico:"ico-tel",cats:["Smartphones","Téléphones simples"]},
  tab:{nom:"Tablettes",long:"Tablettes",hash:"tablettes",ico:"ico-tablette",cats:["Tablettes","Liseuses"]},
  pc:{nom:"Ordinateurs",long:"Ordinateurs",hash:"ordinateurs",ico:"ico-pc",cats:["Portables","Ordinateurs de bureau","Écrans & imprimantes","Stockage"]},
  autres:{nom:"Accessoires",long:"Accessoires & autres",hash:"accessoires",ico:"ico-autres",cats:["Chargeurs & câbles","Écouteurs & audio","Montres connectées","Autres appareils"]},
  menager:{nom:"Électroménager",long:"Électroménager",hash:"electromenager",ico:"ico-menager",cats:["Machines à laver","Réfrigérateurs & congélateurs","Télévisions","Climatiseurs & ventilateurs","Cuisine & petit électroménager"]}
};
var ETATS={neuf:"Neuf",occasion:"Occasion",pieces:"Pièces détachées"};
var OFFRES={promo:"Promo",flash:"Vente flash",bf:"Black Friday"};
var WA_DEFAUT="237696300200",MAIL_DEFAUT="saaretelecom.shop@gmail.com";

function finDuJour(){var d=new Date();d.setHours(23,59,0,0);return locale(d)}
function locale(d){var p=function(n){return String(n).padStart(2,"0")};return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes())}
function nouvelId(){return"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function P(o){return Object.assign({id:nouvelId(),nom:"",marque:"",rayon:"tel",categorie:"Smartphones",etat:"neuf",details:"",garantie:"",prix:0,prixPromo:0,offre:"promo",fin:"",nouveau:false,stock:"ok",visible:true,photos:[]},o)}
function vide(){return{config:{whatsapp:WA_DEFAUT,gmail:MAIL_DEFAUT,evenement:"",evenementFin:""},produits:[]}}
function completer(d){d=d&&typeof d==="object"?d:vide();d.config=Object.assign(vide().config,d.config||{});d.produits=(d.produits||[]).map(P).map(ranger);return d}
// Les tablettes ont leur propre boutique depuis qu'elles sont séparées des smartphones
function ranger(p){if(p.rayon==="tel"&&p.categorie==="Tablettes")p.rayon="tab";if(!RAYONS[p.rayon])p.rayon="tel";return p}

var etat=vide();            // ce que la page affiche (le brouillon du gérant quand il modifie)
var publie=JSON.stringify(etat); // dernière version enregistrée
var version=null;            // version du fichier produits.json sur laquelle le gérant travaille
var nouvellesPhotos={};      // photos prises mais pas encore enregistrées : chemin -> image
var gerant=null;             // {jeton,email,proprietaire,expire}
var comptes=[],proprio="";
try{gerant=JSON.parse(sessionStorage.getItem("saare-gerant"))}catch(e){}
if(gerant&&!(gerant.expire>Date.now()/1000))gerant=null;

function fcfa(n){return Math.round(n).toLocaleString("fr-FR").replace(/[\s\u00a0\u202f]/g,"\u00a0")+"\u00a0FCFA"}
function photo(p,i){var k=p.photos[i||0];if(!k)return dessin({pc:"portable",tel:"telephone",tab:"tablette",menager:"machine"}[p.rayon]||"chargeur");return nouvellesPhotos[k]||k}
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

/* Langue : français par défaut, anglais d'un geste. L'espace gérant reste en français. */
function lire(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null||typeof v!==typeof d||Array.isArray(v)!==Array.isArray(d)?d:v}catch(e){return d}}
function ecrire(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var LANG=lire("saare-langue","fr")==="en"?"en":"fr";
function L(fr,en){return LANG==="en"?en:fr}
var EN={slogan:"The best phones at the best prices!",ev_fin:"ends in",h1:"The best phones, <em>at the best prices!</em>",
  heros:"Smartphones, tablets, computers, accessories and home appliances: new or used, tested in front of you. Pick, then order in one WhatsApp message.",
  voir_promos:"See the deals",btn_pc:"Computer shop",g1:"Pay on delivery",g2:"Mobile Money",g3:"Shop warranty",
  contact_titre:"Contact us",contact_wa:"The fastest: a photo, a price, an answer within minutes.",ouvrir_wa:"Open WhatsApp",copier:"Copy",
  contact_mail:"For bulk quotes, invoices or after-sales service.",ecrire_mail:"Send an e-mail",pied:"© BIMAK Store · Prices in CFA francs (FCFA).",
  tab_boutique:"Shop",tab_promos:"Deals",tab_contact:"Contact",tab_gerant:"Manager",tri:"Sort",recents:"Recently viewed",
  inst_titre:"Install the BIMAK Store app",inst_texte:"One tap to come back, even on 3G.",inst_oui:"Install",
  recherche:"Search: iPhone, HP, 150000…"};
var RAYONS_EN={tel:["Smartphones","Smartphones & phones"],tab:["Tablets","Tablets"],pc:["Computers","Computers"],autres:["Accessories","Accessories & more"],menager:["Home appliances","Home appliances"]};
var ETATS_EN={neuf:"New",occasion:"Used",pieces:"Spare parts"};
var OFFRES_EN={promo:"Sale",flash:"Flash sale",bf:"Black Friday"};
var CATS_EN={"Smartphones":"Smartphones","Tablettes":"Tablets","Liseuses":"E-readers","Machines à laver":"Washing machines","Réfrigérateurs & congélateurs":"Fridges & freezers","Télévisions":"TVs","Climatiseurs & ventilateurs":"Air conditioners & fans","Cuisine & petit électroménager":"Kitchen & small appliances","Téléphones simples":"Basic phones","Portables":"Laptops","Ordinateurs de bureau":"Desktops","Écrans & imprimantes":"Screens & printers","Stockage":"Storage",
  "Chargeurs & câbles":"Chargers & cables","Écouteurs & audio":"Earphones & audio","Montres connectées":"Smartwatches","Autres appareils":"Other devices"};
var EVENEMENTS_EN={"Soldes de fin d'année":"Year-end sale","Fête de la Saint-Valentin":"Valentine's Day","Rentrée scolaire":"Back to school"};
function nomRayon(k,long){return LANG==="en"?RAYONS_EN[k][long?1:0]:RAYONS[k][long?"long":"nom"]}
function nomEtat(k){return LANG==="en"?ETATS_EN[k]:ETATS[k]}
function nomOffre(k){return LANG==="en"?OFFRES_EN[k]:OFFRES[k]}
function nomCat(c){return LANG==="en"&&CATS_EN[c]||c}
function nArticles(n){return n+" "+L("article","item")+(n>1||(LANG==="en"&&n===0)?"s":"")}
function prixTexte(p){return p.prix?fcfa(prixFinal(p)):L("Prix sur demande","Price on request")}
function traduire(){document.documentElement.lang=LANG;
  document.querySelectorAll("[data-t],[data-th],[data-tp]").forEach(function(el){
    var k=el.getAttribute("data-t"),h=el.getAttribute("data-th"),pl=el.getAttribute("data-tp");
    if(k){if(el._fr==null)el._fr=el.textContent;el.textContent=LANG==="en"?EN[k]:el._fr}
    if(h){if(el._fr==null)el._fr=el.innerHTML;el.innerHTML=LANG==="en"?EN[h]:el._fr}
    if(pl){if(el._fr==null)el._fr=el.placeholder;el.placeholder=LANG==="en"?EN[pl]:el._fr}});
  var b=document.getElementById("langue");b.textContent=LANG==="en"?"FR":"EN";b.setAttribute("aria-label",LANG==="en"?"Passer en français":"Switch to English");
  document.getElementById("installer-non").setAttribute("aria-label",L("Plus tard","Later"));
  rendreTri()}

/* Ce que le client garde sur son téléphone : favoris, articles vus, demandes de rappel */
var favoris=lire("saare-favoris",[]),vus=lire("saare-vus",[]),alertes=lire("saare-alertes",{});
var client=lire("saare-client",{nom:""});
client={nom:String(client.nom||"")};
function trouver(id){return etat.produits.find(function(p){return p.id===id})}
var toastMin;function toast(txt,action){var el=document.getElementById("toast");el.textContent=txt;el.hidden=false;el.style.animation="none";void el.offsetWidth;el.style.animation="";
  el.onclick=action?function(){el.hidden=true;action()}:null;el.style.cursor=action?"pointer":"";clearTimeout(toastMin);toastMin=setTimeout(function(){el.hidden=true},action?4500:2600)}
function vibrer(){try{if(navigator.vibrate)navigator.vibrate(12)}catch(e){}}

/* Chargement du catalogue publié */
var charge=false;
function chargerBoutique(){var recu=false;
  return fetch("donnees/produits.json?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()})
    .then(function(d){if(gerant&&modifie())return;etat=completer(d);publie=JSON.stringify(etat);recu=true})
    .catch(function(){})
    .then(function(){charge=true;
      if(recu)verifierRetours()
      rendreBoutique();lienProduit()})}

/* Recherche : sans accents, avec synonymes, et un budget (« 150000 », « 150k », « moins de 100 000 ») */
function plat(s){return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")}
var GROUPES=[["telephone","phone","smartphone","mobile","tel","cellulaire","android"],["machine","lave","laver","washing","washer","electromenager","appliance"],["frigo","refrigerateur","fridge","congelateur","freezer"],["tele","television","tv"],["climatiseur","clim","ventilateur","fan"],["ordinateur","computer","laptop","pc","notebook","macbook"],
  ["ecouteur","casque","headphone","earphone","earbud","airpods","audio","enceinte","speaker"],["chargeur","charger","cable","usb"],["montre","watch"],
  ["tablette","tablet","ipad"],["occasion","used","seconde"],["neuf","new"],["piece","parts","ecran","screen","batterie","battery"]];
var VIDES=["de","du","des","le","la","les","un","une","pour","a","moins","max","maximum","under","less","than","the","for","fcfa","cfa","f","prix","price","budget","jusqu","jusqua","to","up"];
function analyser(q){var mots=[],budget=0;
  q=plat(q).replace(/\b\d{1,3}(?:[ .,]\d{3})*[ .,](?:000|500)\b/g,function(m){return m.replace(/[ .,]/g,"")});
  q.split(/[^a-z0-9]+/).forEach(function(m){if(!m)return;var b=m.match(/^(\d+)(k|f|fcfa)?$/);
    if(b&&(b[2]==="k"||+b[1]>=1000)){budget=+b[1]*(b[2]==="k"?1000:1);return}
    if(VIDES.indexOf(m)<0)mots.push(m)});
  return{mots:mots,budget:budget}}
function texteProduit(p){return plat([p.nom,p.marque,p.categorie,CATS_EN[p.categorie],RAYONS[p.rayon].long,RAYONS_EN[p.rayon][1],ETATS[p.etat],ETATS_EN[p.etat],p.details,enPromo(p)?"promo sale "+OFFRES[p.offre]+" "+OFFRES_EN[p.offre]:""].join(" "))}
function motTrouve(m,txt){if(txt.indexOf(m)>=0||(m.length>3&&/s$/.test(m)&&txt.indexOf(m.slice(0,-1))>=0))return true;
  return GROUPES.some(function(g){return g.some(function(w){return w===m||(m.length>=3&&w.indexOf(m)===0)||(w.length>=4&&m.indexOf(w)===0)})&&g.some(function(w){return txt.indexOf(w)>=0})})}
function correspond(p,a){if(a.budget&&!(p.prix>0&&prixFinal(p)<=a.budget))return false;var txt=texteProduit(p);return a.mots.every(function(m){return motTrouve(m,txt)})}
function surligner(nom,mots){var b=plat(nom);if(b.length!==nom.length||!mots.length)return esc(nom);var marque=[];
  mots.forEach(function(m){var i=b.indexOf(m);if(i>=0)for(var j=i;j<i+m.length;j++)marque[j]=1});
  var h="",dans=false;for(var i=0;i<nom.length;i++){if(marque[i]&&!dans){h+="<mark>";dans=true}if(!marque[i]&&dans){h+="</mark>";dans=false}h+=esc(nom[i])}return h+(dans?"</mark>":"")}
var requete="",analyse=analyser("");
function rendreSuggestions(){var z=document.getElementById("suggestions"),q=requete.trim();
  if(!q||document.activeElement!==document.getElementById("recherche")){z.hidden=true;return}
  var l=visibles().filter(function(p){return correspond(p,analyse)}).slice(0,4);
  z.innerHTML=l.map(function(p){return'<button type="button" data-fiche="'+esc(p.id)+'"><img src="'+esc(photo(p))+'" alt=""><span><b>'+surligner(p.nom,analyse.mots)+"</b><small>"+esc(nomRayon(p.rayon)+" · "+nomEtat(p.etat))+(p.stock==="epuise"?" · "+L("épuisé","sold out"):"")+'</small></span><span class="p">'+prixTexte(p)+"</span></button>"}).join("")+
    '<button type="button" class="demande" data-demander><span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-wa"/></svg></span><span><b>'+(l.length?L("Pas ce que vous cherchez ?","Not what you need?"):L("Demander « ","Ask for “")+esc(q)+L(" » au vendeur","” from the seller"))+"</b><small>"+L("Le vendeur vous répond sur WhatsApp","The seller answers you on WhatsApp")+"</small></span></button>";
  z.hidden=false}

/* Boutique */
var rayon="tous",etatFiltre="tous",filtre="tous",tri="reco";
function visibles(){return etat.produits.filter(function(p){return p.visible})}
function rendreRayons(){var v=visibles();
  var items=[["tous",L("Tout voir","See all"),"ico-tout",v.length]].concat(Object.keys(RAYONS).map(function(k){return[k,nomRayon(k),RAYONS[k].ico,v.filter(function(p){return p.rayon===k}).length]}));
  var zone=document.getElementById("rayons"),deja=zone.querySelectorAll("[data-rayon]");
  // Mise à jour sur place : la plaque touchée garde son rebond
  if(deja.length===items.length){items.forEach(function(r,i){deja[i].setAttribute("aria-pressed",rayon===r[0]);deja[i].querySelector("b").textContent=r[1];deja[i].querySelector("small").textContent=nArticles(r[3])});return}
  zone.innerHTML=items.map(function(r){return'<button type="button" class="rayon verre" data-rayon="'+r[0]+'" aria-pressed="'+(rayon===r[0])+'"><svg aria-hidden="true"><use href="#'+r[2]+'"/></svg><span><b>'+r[1]+"</b><small>"+nArticles(r[3])+"</small></span></button>"}).join("")}
function favorisVisibles(){return favoris.filter(function(id){var p=trouver(id);return p&&p.visible})}
function rendreFiltres(){
  document.getElementById("etats").innerHTML=[["tous",L("Tous états","Any condition")]].concat(Object.keys(ETATS).map(function(k){return[k,nomEtat(k)]})).map(function(f){return'<button type="button" data-etat="'+f[0]+'" aria-pressed="'+(etatFiltre===f[0])+'">'+f[1]+"</button>"}).join("");
  var marques=[];visibles().forEach(function(p){if((rayon==="tous"||p.rayon===rayon)&&p.marque&&marques.indexOf(p.marque)<0)marques.push(p.marque)});
  var nf=favorisVisibles().length;
  if(filtre==="favoris"&&!nf)filtre="tous";
  if(["tous","offres","flash","favoris"].indexOf(filtre)<0&&marques.indexOf(filtre)<0)filtre="tous";
  var f=[["tous",L("Tout","All")]].concat(nf?[["favoris","♥ "+L("Favoris","Favorites")+" ("+nf+")"]]:[],[["offres",L("Promos","Deals")],["flash",L("Vente flash","Flash sale")]],marques.sort().map(function(m){return[m,m]}));
  document.getElementById("filtres").innerHTML=f.map(function(x){return'<button type="button" data-f="'+esc(x[0])+'" aria-pressed="'+(filtre===x[0])+'">'+esc(x[1])+"</button>"}).join("")}
function rendreTri(){document.getElementById("tri").innerHTML=options([["reco",L("Recommandés","Recommended")],["prix-asc",L("Prix croissant","Price: low to high")],["prix-desc",L("Prix décroissant","Price: high to low")],["remise",L("Meilleures remises","Biggest discounts")],["nouveau",L("Nouveautés","Newest")]],tri)}
function trier(l){var dispo=function(p){return p.stock==="epuise"?1:0};
  var cle={"prix-asc":function(p){return p.prix?prixFinal(p):Infinity},"prix-desc":function(p){return p.prix?-prixFinal(p):Infinity},remise:function(p){return enPromo(p)?-remise(p):0},nouveau:function(p){return p.nouveau?0:1}}[tri]||function(){return 0};
  return l.map(function(p,i){return[p,i]}).sort(function(a,b){return(dispo(a[0])-dispo(b[0]))||(cle(a[0])-cle(b[0]))||(a[1]-b[1])}).map(function(x){return x[0]})}
function garde(p){if(!p.visible)return false;if(rayon!=="tous"&&p.rayon!==rayon)return false;if(etatFiltre!=="tous"&&p.etat!==etatFiltre)return false;
  if(requete.trim()&&!correspond(p,analyse))return false;
  if(filtre==="favoris")return favoris.indexOf(p.id)>=0;
  if(filtre==="offres")return enPromo(p);if(filtre==="flash")return enPromo(p)&&p.offre==="flash";if(filtre==="tous")return true;return p.marque===filtre}
function ligneStock(p){var c=p.stock==="epuise"?"epuise":p.stock==="peu"?"peu":"";
  return'<p class="stock '+c+'">'+(c==="epuise"?L("Épuisé pour le moment","Sold out for now"):c==="peu"?L("Dernières pièces","Last items"):L("En stock","In stock"))+"</p>"}
function textePrevenir(id,large){return alertes[id]?(large?L("Demande envoyée","Request sent"):L("Demandé","Requested")):(large?L("Me prévenir quand il revient","Notify me when it's back"):L("Me prévenir","Notify me"))}
function boutonPrevenir(p,large){return'<button class="bouton prevenir'+(alertes[p.id]?" fait":"")+'" type="button" data-prevenir="'+esc(p.id)+'"'+(large?' data-large="1"':"")+'><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-cloche"/></svg><span class="txt">'+textePrevenir(p.id,large)+"</span></button>"}
function lienCommande(p){return'<a class="bouton commander" target="_blank" rel="noopener" href="'+lienWa(messageCommande(p))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-wa"/></svg><span class="txt">'+L("Commander","Order")+"</span></a>"}
function carte(p){var r=enPromo(p),ep=p.stock==="epuise",o=ep?"epuise":r?p.offre:(p.nouveau?"nouveau":"");
  var badge=o?'<span class="badge '+o+'">'+(o==="epuise"?L("Épuisé","Sold out"):o==="nouveau"?L("Nouveau","New"):nomOffre(o))+"</span>":"";
  var rem=r&&!ep?'<span class="remise">-'+remise(p)+"%</span>":"";
  var mins=r&&p.offre==="flash"&&p.fin?'<p class="minuteur" data-fin="'+esc(p.fin)+'"></p>':"";
  return'<article class="produit verre'+(ep?" epuise":"")+'"><div class="photo"><button class="ouvrir" type="button" data-fiche="'+esc(p.id)+'" aria-label="'+L("Voir ","See ")+esc(p.nom)+'"><img src="'+esc(photo(p))+'" alt="'+esc(p.nom)+'" loading="lazy"></button>'+badge+rem+"</div>"+
   '<button class="coeur" type="button" data-coeur="'+esc(p.id)+'" aria-pressed="'+(favoris.indexOf(p.id)>=0)+'" aria-label="'+L("Favori","Favorite")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-coeur"/></svg></button>'+
   '<div class="corps"><h3>'+esc(p.nom)+'</h3><p class="etat"><span class="e-'+p.etat+'">'+nomEtat(p.etat)+"</span>"+(p.garantie?"<em>"+L("Garantie ","Warranty ")+esc(p.garantie)+"</em>":"")+'</p><p class="details">'+esc(p.details)+"</p>"+mins+blocPrix(p)+ligneStock(p)+
   '<div class="actions">'+(ep?boutonPrevenir(p):lienCommande(p))+"</div></div></article>"}
function details(p){return nomEtat(p.etat)+(p.details?", "+p.details:"")}
function messageCommande(p){return L("Bonjour BIMAK Store, je souhaite commander : ","Hello BIMAK Store, I would like to order: ")+p.nom+" ("+details(p)+")"+(p.prix?L(" au prix de "," at ")+fcfa(prixFinal(p)):"")+L(". Est-il disponible ?",". Is it available?")}
function videBoutique(){
  if(!charge)return'<p style="color:var(--texte-3)">'+L("Chargement des articles…","Loading items…")+"</p>";
  if(!visibles().length)return'<div class="admin-intro verre" style="grid-column:1/-1">'+L("Les articles arrivent très bientôt. En attendant, dites-nous ce que vous cherchez sur WhatsApp : nous vous répondons en quelques minutes.","Items are coming very soon. Meanwhile, tell us what you are looking for on WhatsApp: we answer within minutes.")+"</div>";
  var q=requete.trim();
  if(q)return'<div class="admin-intro verre" style="grid-column:1/-1"><p style="margin:0 0 12px">'+L("Nous n'avons pas « ","We don't have “")+esc(q)+L(" » en ligne pour le moment. Le vendeur peut souvent le trouver : envoyez-lui la demande, il vous répond sur WhatsApp.","” online right now. The seller can often find it: send the request and they will answer on WhatsApp.")+
    '</p><button class="bouton rouge" type="button" data-demander><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-cloche"/></svg>'+L("Demander au vendeur","Ask the seller")+"</button></div>";
  return'<p style="color:var(--texte-3)">'+L("Aucun article dans cette sélection pour le moment.","No items in this selection yet.")+"</p>"}
function rendreBoutique(){
  rendreRayons();rendreFiltres();
  var liste=trier(etat.produits.filter(garde)),q=requete.trim();
  document.getElementById("titre-catalogue").textContent=q?L("Résultats pour « ","Results for “")+q+L(" »","”"):rayon==="tous"?L("Nos boutiques","Our shops"):LANG==="en"?nomRayon(rayon,true):"Boutique "+RAYONS[rayon].long.toLowerCase();
  var bu=document.getElementById("budget");bu.hidden=!analyse.budget;if(analyse.budget)bu.textContent=L("Budget : jusqu'à ","Budget: up to ")+fcfa(analyse.budget);
  document.getElementById("grille").innerHTML=liste.length?liste.map(carte).join(""):videBoutique();
  document.getElementById("compte-produits").textContent=nArticles(liste.length);
  var c=etat.config,num=chiffres(c.whatsapp)||WA_DEFAUT,mail=(c.gmail||"").trim()||MAIL_DEFAUT;
  document.getElementById("wa-numero").textContent="+"+num.replace(/^(\d{3})(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/,"$1 $2 $3 $4 $5 $6");
  document.getElementById("wa-a-remplir").hidden=true;
  document.getElementById("mail-adresse").textContent=mail;
  document.getElementById("mail-a-remplir").hidden=true;
  document.getElementById("mail-lien").href="mailto:"+mail+"?subject="+encodeURIComponent(L("Demande BIMAK Store","BIMAK Store request"));
  var bonjour=lienWa(L("Bonjour BIMAK Store, je cherche un appareil.","Hello BIMAK Store, I am looking for a device."));
  ["wa-heros","wa-contact","wa-flottant"].forEach(function(id){document.getElementById(id).href=bonjour});
  var meilleure=visibles().filter(function(p){return enPromo(p)&&p.stock!=="epuise"}).sort(function(a,b){return remise(b)-remise(a)})[0];
  var pa=document.getElementById("pastille");
  if(meilleure){pa.hidden=false;pa.innerHTML="<small>"+esc(meilleure.nom)+"</small>"+fcfa(meilleure.prixPromo)}else pa.hidden=true;
  rendreRecents();tic()}
function tic(){
  var c=etat.config,ev=document.getElementById("evenement"),r=c.evenement&&c.evenementFin?restant(c.evenementFin):null;
  ev.hidden=!r;
  if(r){var mots=(LANG==="en"&&EVENEMENTS_EN[c.evenement]||c.evenement).split(" "),der=mots.pop();document.getElementById("ev-nom").innerHTML=esc(mots.join(" "))+(mots.length?" ":"")+"<em>"+esc(der)+"</em>";
    document.getElementById("ev-compte").innerHTML=[[r.j,L("jours","days")],[r.h,"h"],[r.m,"min"],[r.s,"s"]].map(function(x){return"<span>"+deux(x[0])+"<small>"+x[1]+"</small></span>"}).join("")}
  var perime=false;
  document.querySelectorAll(".minuteur").forEach(function(el){var t=restant(el.getAttribute("data-fin"));if(!t){perime=true;return}
    el.textContent=L("Fin de la vente flash dans ","Flash sale ends in ")+(t.j?t.j+L(" j "," d "):"")+deux(t.h)+":"+deux(t.m)+":"+deux(t.s)});
  if(perime)rendreBoutique()}
setInterval(tic,1000);

/* Feuilles de verre : fiche produit, demande de rappel */
var voile=document.getElementById("voile"),feuille=null;
function afficher(html,quoi,garderPlace){var f=voile.querySelector(".fiche"),haut=garderPlace&&f&&feuille===quoi?f.scrollTop:0;
  voile.innerHTML=html;voile.hidden=false;feuille=quoi;document.getElementById("toast").hidden=true;
  if(haut)voile.querySelector(".fiche").scrollTop=haut;else{var b=document.getElementById("fermer");if(b)b.focus({preventScroll:true})}}
function fermer(){voile.hidden=true;feuille=null}
function coque(titre,html){return'<div class="fiche verre" role="dialog" aria-modal="true" aria-label="'+esc(titre)+'"><div class="feuille-titre"><h3>'+esc(titre)+'</h3><button class="fermer" type="button" aria-label="'+L("Fermer","Close")+'" id="fermer">×</button></div>'+html+"</div>"}
function mini(p){return'<button class="mini verre" type="button" data-fiche="'+esc(p.id)+'"><img src="'+esc(photo(p))+'" alt="" loading="lazy"><b>'+esc(p.nom)+"</b><span"+(enPromo(p)?' class="reduit"':"")+">"+prixTexte(p)+"</span></button>"}
function similaires(p){var ref=prixFinal(p);
  return visibles().filter(function(x){return x.id!==p.id&&x.rayon===p.rayon&&x.stock!=="epuise"})
    .sort(function(a,b){return((a.categorie===p.categorie?0:1)-(b.categorie===p.categorie?0:1))||(Math.abs(prixFinal(a)-ref)-Math.abs(prixFinal(b)-ref))}).slice(0,8)}
function ouvrirFiche(id){var p=trouver(id);if(!p)return;var n=Math.max(1,p.photos.length),ep=p.stock==="epuise",sim=similaires(p);
  document.getElementById("suggestions").hidden=true;
  afficher('<div class="fiche verre" role="dialog" aria-modal="true" aria-label="'+esc(p.nom)+'"><button class="fermer" type="button" aria-label="'+L("Fermer","Close")+'" id="fermer">×</button>'+
   '<div class="galerie">'+Array.from({length:n},function(_,i){return'<img src="'+esc(photo(p,i))+'" alt="'+esc(p.nom)+" photo "+(i+1)+'">'}).join("")+"</div>"+
   (n>1?'<p style="color:var(--texte-3);font-size:13px;margin:6px 0 0">'+L("Glissez pour voir les "+n+" photos","Swipe to see the "+n+" photos")+"</p>":"")+
   "<h3>"+esc(p.nom)+'</h3><p class="etat"><span class="e-'+p.etat+'">'+nomEtat(p.etat)+"</span><em>"+esc(nomRayon(p.rayon)+" · "+nomCat(p.categorie))+(p.garantie?" · "+L("Garantie ","Warranty ")+esc(p.garantie):"")+'</em></p><p class="details" style="color:var(--texte-2)">'+esc(p.details)+"</p>"+blocPrix(p)+ligneStock(p)+
   '<div class="rangee-actions">'+(ep?boutonPrevenir(p,true):'<a class="bouton commander" target="_blank" rel="noopener" href="'+lienWa(messageCommande(p))+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-wa"/></svg>'+L("Commander sur WhatsApp","Order on WhatsApp")+"</a>")+"</div>"+
   '<div class="petits"><button class="bouton leger coeur-fiche" type="button" data-coeur="'+esc(p.id)+'" aria-pressed="'+(favoris.indexOf(p.id)>=0)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-coeur"/></svg>'+L("Favori","Favorite")+"</button></div>"+
   (sim.length?"<h4>"+(ep?L("Disponibles maintenant","Available now"):L("Articles similaires","Similar items"))+'</h4><div class="defile">'+sim.map(mini).join("")+"</div>":"")+
   '<button class="bouton leger" type="button" style="width:100%;margin-top:16px" data-partager="'+esc(p.id)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-partager"/></svg>'+L("Partager cet article","Share this item")+"</button></div>","fiche");
  noterVu(p.id)}
function noterVu(id){vus=[id].concat(vus.filter(function(x){return x!==id})).slice(0,12);ecrire("saare-vus",vus);rendreRecents()}
function rendreRecents(){var l=vus.map(trouver).filter(function(p){return p&&p.visible});
  document.getElementById("recents").hidden=!l.length;document.getElementById("recents-liste").innerHTML=l.map(mini).join("")}
function lienProduit(){var m=location.hash.match(/^#p=(.+)$/);if(!m||!charge)return;history.replaceState(null,"","#catalogue");ouvrirFiche(decodeURIComponent(m[1]))}
window.addEventListener("hashchange",lienProduit);
function partager(p){if(!p)return;var url=location.origin+"/#p="+encodeURIComponent(p.id),txt=p.nom+" · "+prixTexte(p)+" · BIMAK Store";
  if(navigator.share){navigator.share({title:p.nom,text:txt,url:url}).catch(function(){});return}
  var wa=function(){window.open("https://wa.me/?text="+encodeURIComponent(txt+" "+url),"_blank","noopener")};
  try{navigator.clipboard.writeText(txt+" "+url).then(function(){toast(L("Lien copié : collez-le où vous voulez","Link copied: paste it anywhere"))},wa)}catch(e){wa()}}

/* Favoris */
function basculerFavori(id,bouton){var i=favoris.indexOf(id),oui=i<0;if(oui)favoris.unshift(id);else favoris.splice(i,1);ecrire("saare-favoris",favoris);vibrer();
  document.querySelectorAll('[data-coeur="'+CSS.escape(id)+'"]').forEach(function(b){b.setAttribute("aria-pressed",oui)});
  bouton.classList.remove("bat");void bouton.offsetWidth;bouton.classList.add("bat");
  toast(oui?L("Ajouté aux favoris ♥","Added to favorites ♥"):L("Retiré des favoris","Removed from favorites"));
  if(filtre==="favoris"&&!oui)rendreBoutique();else rendreFiltres()}

function majBoutons(){
  document.querySelectorAll("[data-prevenir]").forEach(function(b){var id=b.getAttribute("data-prevenir");b.classList.toggle("fait",!!alertes[id]);b.querySelector(".txt").textContent=textePrevenir(id,b.hasAttribute("data-large"))})}

/* Article épuisé ou introuvable : le client demande au vendeur de le prévenir */
var demande=null;
function messageAlerte(){var p=demande.p;return L("Bonjour BIMAK Store, pouvez-vous me prévenir quand cet article sera disponible : ","Hello BIMAK Store, could you let me know when this item is available: ")+(p?p.nom+" ("+details(p)+")":demande.q)+L(" ?","?")+
  (client.nom.trim()?"\n"+L("Nom : ","Name: ")+client.nom.trim():"")+"\n"+L("Merci !","Thank you!")}
function ouvrirAlerte(id,q){var p=id?trouver(id):null;if(!p&&!q)return;demande={p:p,q:q,cle:p?p.id:"q:"+plat(q)};
  document.getElementById("suggestions").hidden=true;var sim=p?similaires(p):[];
  afficher(coque(p?L("Être prévenu du retour","Get notified"):L("Demander au vendeur","Ask the seller"),
    (p?'<div class="ligne-alerte"><img src="'+esc(photo(p))+'" alt=""><div><b>'+esc(p.nom)+"</b><small>"+esc(details(p))+"</small>"+ligneStock(p)+"</div></div>":"")+
    '<p style="color:var(--texte-2)">'+(p?L("Touchez le bouton : le message part tout prêt vers le vendeur sur WhatsApp, et il vous écrit dès que l'article revient.","Tap the button: a ready-made message goes to the seller on WhatsApp, and they write to you as soon as the item is back."):
      L("Vous cherchez « ","Looking for “")+esc(q)+L(" » ? Le vendeur peut souvent le trouver. Touchez le bouton : le message part tout prêt sur WhatsApp.","”? The seller can often find it. Tap the button: a ready-made message goes out on WhatsApp."))+"</p>"+
    '<div class="champ"><label for="cl-nom">'+L("Votre nom (facultatif)","Your name (optional)")+'</label><input id="cl-nom" autocomplete="given-name" maxlength="60" value="'+esc(client.nom)+'"></div>'+
    '<a class="bouton" style="width:100%;margin-top:14px" id="envoyer-alerte" target="_blank" rel="noopener" href="'+lienWa(messageAlerte())+'"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-cloche"/></svg>'+(p?L("Me prévenir sur WhatsApp","Notify me on WhatsApp"):L("Envoyer la demande","Send the request"))+"</a>"+
    (sim.length?"<h4>"+L("Disponibles maintenant","Available now")+'</h4><div class="defile">'+sim.map(mini).join("")+"</div>":"")),"alerte")}
function verifierRetours(){var revenu=null;
  Object.keys(alertes).forEach(function(k){if(Date.now()-alertes[k].t>60*864e5){delete alertes[k];return}var p=trouver(k);if(p&&p.visible&&p.stock!=="epuise"){delete alertes[k];revenu=p}});
  ecrire("saare-alertes",alertes);
  if(revenu)toast(L("Bonne nouvelle : ","Good news: ")+revenu.nom+L(" est de retour !"," is back in stock!"),function(){ouvrirFiche(revenu.id)})}

voile.addEventListener("click",function(e){if(e.target===voile||e.target.id==="fermer")fermer()});
voile.addEventListener("input",function(e){if(e.target.id!=="cl-nom")return;client.nom=e.target.value;ecrire("saare-client",client);
  var b=document.getElementById("envoyer-alerte");if(b)b.href=lienWa(messageAlerte())});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){fermer();document.getElementById("suggestions").hidden=true}});

document.addEventListener("click",function(e){var x;
  if((x=e.target.closest("[data-coeur]"))){basculerFavori(x.getAttribute("data-coeur"),x);return}
  if((x=e.target.closest("[data-prevenir]"))){ouvrirAlerte(x.getAttribute("data-prevenir"));return}
  if((x=e.target.closest("[data-demander]"))){ouvrirAlerte(null,requete.trim()||L("un appareil","a device"));return}
  if((x=e.target.closest("[data-partager]"))){partager(trouver(x.getAttribute("data-partager")));return}
  if(e.target.closest("[data-fermer]")){fermer();return}
  if(e.target.closest("#envoyer-alerte")){alertes[demande.cle]={nom:demande.p?demande.p.nom:demande.q,t:Date.now()};ecrire("saare-alertes",alertes);majBoutons();
    setTimeout(function(){fermer();toast(demande.p?L("Demande envoyée : on vous prévient dès son retour","Request sent: we'll let you know when it's back"):L("Demande envoyée au vendeur","Request sent to the seller"))},300);return}
  var r=e.target.closest("[data-rayon]");if(r){choisirRayon(r.getAttribute("data-rayon"));return}
  var et=e.target.closest("[data-etat]");if(et){etatFiltre=et.getAttribute("data-etat");rendreBoutique();return}
  var f=e.target.closest("[data-f]");if(f){filtre=f.getAttribute("data-f");rendreBoutique();onglet();return}
  var fi=e.target.closest("[data-fiche]");if(fi){ouvrirFiche(fi.getAttribute("data-fiche"));return}
  var cp=e.target.closest("[data-copier]");if(cp){var t=document.getElementById(cp.getAttribute("data-copier")).textContent,admin=!!cp.closest("#vue-admin");
    var ok=function(){cp.textContent=admin?"Copié":L("Copié","Copied")};var non=function(){var rg=document.createRange();rg.selectNodeContents(document.getElementById(cp.getAttribute("data-copier")));var s=getSelection();s.removeAllRanges();s.addRange(rg);cp.textContent=admin?"Sélectionné":L("Sélectionné","Selected")};
    try{navigator.clipboard.writeText(t).then(ok,non)}catch(err){non()}setTimeout(function(){cp.textContent=admin?"Copier":L("Copier","Copy")},1800)}
});
function choisirRayon(k){rayon=k;filtre="tous";var h=k==="tous"?"#catalogue":"#"+RAYONS[k].hash;if(location.hash!==h)history.replaceState(null,"",h);rendreBoutique();onglet()}
["voir-promos","lien-promos"].forEach(function(id){document.getElementById(id).addEventListener("click",function(){filtre="offres";rendreBoutique();onglet()})});
document.getElementById("tri").addEventListener("change",function(e){tri=e.target.value;rendreBoutique()});

var champ=document.getElementById("recherche");
champ.addEventListener("input",function(){var avant=requete.trim();requete=champ.value;analyse=analyser(requete);
  // Première lettre tapée : on cherche dans toute la boutique
  if(!avant&&requete.trim()){rayon="tous";etatFiltre="tous";if(filtre!=="favoris")filtre="tous"}
  document.getElementById("effacer-recherche").hidden=!requete;rendreBoutique();rendreSuggestions()});
champ.addEventListener("focus",rendreSuggestions);
champ.addEventListener("keydown",function(e){if(e.key!=="Enter")return;e.preventDefault();champ.blur();document.getElementById("suggestions").hidden=true;
  var b=document.getElementById("grille").getBoundingClientRect();scrollBy({top:b.top-90,behavior:calme?"auto":"smooth"})});
document.getElementById("effacer-recherche").addEventListener("click",function(){champ.value="";champ.dispatchEvent(new Event("input"));champ.focus()});
document.addEventListener("pointerdown",function(e){if(!e.target.closest(".zone-recherche"))document.getElementById("suggestions").hidden=true},{passive:true});

document.getElementById("langue").addEventListener("click",function(){LANG=LANG==="en"?"fr":"en";ecrire("saare-langue",LANG);traduire();rendreBoutique();
  if(feuille)fermer();toast(L("Version française","English version"))});

/* Invitation à installer l'appli (raccourci sur l'écran d'accueil) */
var invite=null,estIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var visites=lire("saare-visites",0)+1;ecrire("saare-visites",visites);
function installee(){return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}
var bandeau=document.getElementById("installer"),attenteInstall;
function proposer(delai){if(installee()||Date.now()-lire("saare-install-plus-tard",0)<14*864e5)return;
  clearTimeout(attenteInstall);attenteInstall=setTimeout(function(){if(location.hash==="#admin"||!voile.hidden){proposer(10000);return}bandeau.hidden=false},delai)}
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();invite=e;proposer(visites>1?4000:15000)});
window.addEventListener("appinstalled",function(){bandeau.hidden=true;invite=null;toast(L("Appli installée : retrouvez-la sur l'écran d'accueil","App installed: find it on your home screen"))});
if(estIOS)proposer(visites>1?4000:15000);
document.getElementById("installer-non").addEventListener("click",function(){bandeau.hidden=true;ecrire("saare-install-plus-tard",Date.now())});
document.getElementById("installer-oui").addEventListener("click",function(){bandeau.hidden=true;
  if(invite){invite.prompt();invite.userChoice.then(function(r){if(r.outcome!=="accepted")ecrire("saare-install-plus-tard",Date.now())},function(){});invite=null;return}
  afficher(coque(L("Installer l'appli","Install the app"),'<ol class="etapes"><li>'+L("Touchez <b>Partager</b>","Tap <b>Share</b>")+' <svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;vertical-align:-3px"><use href="#ico-partager"/></svg> '+L("en bas de Safari.","at the bottom of Safari.")+"</li><li>"+
    L("Choisissez <b>Sur l'écran d'accueil</b>.","Choose <b>Add to Home Screen</b>.")+"</li><li>"+L("Touchez <b>Ajouter</b> : l'icône BIMAK Store rejoint vos applis.","Tap <b>Add</b>: the BIMAK Store icon joins your apps.")+"</li></ol>"),"installer")});
if("serviceWorker" in navigator)addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})});

/* Relief 3D : les plaques de verre s'inclinent et le reflet suit le doigt ou la souris.
   Sur téléphone, le doigt fait pencher la plaque, puis elle revient avec un petit rebond ;
   l'affiche d'accueil suit aussi l'inclinaison du téléphone. */
var calme=matchMedia("(prefers-reduced-motion: reduce)").matches;
var RELIEF=".produit,.rayon,.tuile,.canal,.connexion,.evenement,.mini";
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
   '<div class="champ"><label for="stk-'+i+'">Stock</label><select id="stk-'+i+'" data-champ="stock">'+options([["ok","En stock"],["peu","Dernières pièces"],["epuise","Épuisé"]],p.stock)+"</select></div>"+
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
    var t="Bonjour, vous êtes invité comme administrateur de la boutique BIMAK Store. Ouvrez "+lienBoutique()+"#admin et connectez-vous avec votre compte Google "+m+".";
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
  if(admin)bandeau.hidden=true;
  if(admin&&!gerant)preparerGoogle();
  if(admin&&gerant&&!adminCharge&&!chargementAdmin){chargerAdmin();return}
  ["tuiles","bloc-produits","bloc-comptes"].forEach(function(id){document.getElementById(id).hidden=!adminCharge});
  document.querySelectorAll("#vue-admin .admin-bloc").forEach(function(b){b.hidden=!adminCharge});
  onglet();if(admin&&gerant&&adminCharge)rendreAdmin();else barre()}
function onglet(){var h=location.hash,cur=h==="#admin"?"lien-admin":h==="#contact"?"lien-contact":filtre==="offres"?"lien-promos":"lien-boutique";
  ["lien-boutique","lien-promos","lien-contact","lien-admin"].forEach(function(id){document.getElementById(id).setAttribute("aria-current",id===cur?"page":"false")})}
window.addEventListener("hashchange",route);
traduire();rendreBoutique();chargerBoutique();route();
