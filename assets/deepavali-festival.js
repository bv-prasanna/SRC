/* SRC festive animations: decorative, bounded, non-interactive, respects accessibility preferences. */
(()=>{"use strict";
const media=window.matchMedia("(prefers-reduced-motion: reduce)");
const palette=["#ffd485","#ffae4a","#ffb8a2","#ebadfb","#fff4d4"];
let stopHandle=0;
function makeLayer(host){
 let layer=host.querySelector(".src-festival-layer");
 if(layer)return layer;
 layer=document.createElement("div");
 layer.className="src-festival-layer";
 layer.setAttribute("aria-hidden","true");
 layer.setAttribute("inert","");
 // Stable decorative positions avoid layout shifts and keep the center headline legible.
 const points=[
 [9,23,0],[20,41,370],[82,23,190],[90,46,750],[13,69,860],
 [85,68,1120],[25,16,1450],[77,15,1600],[7,57,1850],[94,58,2000],
 [18,25,215],[85,31,510],[28,72,970],[73,76,1470]
 ];
 for(let i=0;i<points.length;i++){
  const [x,y,delay]=points[i],node=document.createElement("span");
  node.className=i%3===0?"fest-burst":"fest-glimmer";
  node.style.setProperty("--x",x+"%");
  node.style.setProperty("--y",y+"%");
  node.style.setProperty("--delay",delay+"ms");
  node.style.setProperty("--spark",palette[i%palette.length]);
  layer.appendChild(node);
 }
 host.insertBefore(layer,host.firstChild);
 return layer;
}
function stop(host){if(host)host.classList.remove("fest-playing");}
function activate(kind){
 const host=kind==="crackers"?document.getElementById("deptBanner"):kind==="scheme"?document.querySelector("#scheme .scheme-page-hero"):null;
 if(!host)return;
 const other=kind==="crackers"?document.querySelector("#scheme .scheme-page-hero"):document.getElementById("deptBanner");
 stop(other);window.clearTimeout(stopHandle);
 if(media.matches||document.visibilityState==="hidden"){stop(host);return;}
 makeLayer(host);
 // Retrigger only for route entry, not on every slide or keystroke.
 host.classList.remove("fest-playing");void host.offsetWidth;host.classList.add("fest-playing");
 stopHandle=window.setTimeout(()=>stop(host),4400);
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){window.clearTimeout(stopHandle);stop(document.querySelector("#scheme .scheme-page-hero"));stop(document.getElementById("deptBanner"));}});
window.addEventListener("pagehide",()=>window.clearTimeout(stopHandle));
window.SRCFestival={activate};
})();