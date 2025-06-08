import{_ as w}from"./Backbutton.vuevuetypescriptsetuptruelang-C3DdJKk9.js";import{_ as $}from"./SongListItem.vuevuetypescriptsetuptruelang-D2pg6-x2.js";import{_ as C}from"./AppLayout.vuevuetypescriptsetuptruelang-BoqE6I_v.js";import{d as g,ab as j,aa as D,u as S,v as k,c as f,w as r,ad as B,s as E,a as O,r as p,o as c,b as i,e as d,j as u,af as z,f as _,t as M,g as N,h as T,F as V}from"./index-DuNkWvgb.js";import{_ as F}from"./plugin-vueexport-helper-DlAUqK2U.js";import"./auth-LI-BiQ8h.js";const H={class:"d-flex justify-space-between"},I={class:"w-100 d-flex justify-center"},L=g({__name:"SetlistOverview",setup(R){const v=B().params.id,o=j(D(E,v)),h=S(O),m=k(()=>{var t;return(((t=o.data.value)==null?void 0:t.songs)||[]).map(a=>h.value.find(n=>n.id==a)).filter(a=>a)});function y(t){return t?`${Math.floor(t/60)}:${(t%60).toString().padStart(2,"0")}`:""}function x(){var a,n,s;const t=document.createElement("iframe");t.style.display="none",document.body.appendChild(t),t.contentDocument&&(t.contentDocument.body.innerHTML=`
    <html>
      <head>
        <title>${(a=o.data.value)==null?void 0:a.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
          }
          h1 {
            text-align: center;
            margin-bottom: 40px;
          }
          .song-list div {
            text-align: center;
            font-size: 22px;
            line-height: 2.5;
            font-weight: bold;
          }
          .song-list {
            display: flex;
            flex-direction: column;
            flex-wrap: wrap;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div style="height: 100vh;display: flex; flex-direction: column;justify-content: center;">
          <h1>${(n=o.data.value)==null?void 0:n.name} - Setlist</h1>
          <div class="song-list" style="height:0;flex:1;">
            ${m.value.map((e,l)=>`<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${l+1}.
                      </span>
                      ${e.name}
                      <span style="font-size: 16px;font-weight:normal">
                        ${[e==null?void 0:e.key_signature,(e==null?void 0:e.bpm)&&`${e==null?void 0:e.bpm} bpm`,y(e.duration)].filter(Boolean).join(" - ")}
                      </span>
                  </div>`).join("")}
          </div>
        </div>
      </body>
    </html>
  `),(s=t.contentWindow)==null||s.print(),document.body.removeChild(t)}return(t,a)=>{const n=p("v-btn"),s=p("v-list");return c(),f(C,null,{default:r(()=>{var e;return[i("h2",H,[i("div",null,[d(w,{to:u(z)},null,8,["to"]),_(" "+M((e=u(o))==null?void 0:e.name),1)]),i("div",null,[d(n,{color:"primary",onClick:x,class:"ms-2"},{default:r(()=>[_(" Print ")]),_:1})])]),i("div",I,[d(s,{density:"compact"},{default:r(()=>[(c(!0),N(V,null,T(m.value,(l,b)=>(c(),f($,{index:b+1,song:l},null,8,["index","song"]))),256))]),_:1})])]}),_:1})}}}),K=F(L,[["__scopeId","data-v-8b651202"]]);export{K as default};
