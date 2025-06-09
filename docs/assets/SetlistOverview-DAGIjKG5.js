import{_ as x}from"./Backbutton.vuevuetypescriptsetuptruelang-8KzM6P20.js";import{_ as y}from"./SongListItem.vuevuetypescriptsetuptruelang-DVeuCLic.js";import{g as b}from"./helpers-CvCymQbz.js";import{_ as w}from"./AppLayout.vuevuetypescriptsetuptruelang-BPl6-rO-.js";import{d as C,ab as $,aa as D,u as S,v as j,c as p,w as r,ad as k,s as B,a as E,r as u,o as d,b as o,e as m,j as _,af as O,t as z,f as I,g as N,h as T,F as V}from"./index-Bm2saFmH.js";import{_ as F}from"./plugin-vueexport-helper-DlAUqK2U.js";import"./auth-CQm5ZTfi.js";const H={class:"d-flex"},L={style:{flex:"1"}},M={class:"w-100 d-flex justify-center"},R=C({__name:"SetlistOverview",setup(W){const v=k().params.id,a=$(D(B,v)),h=S(E),f=j(()=>{var t;return(((t=a.data.value)==null?void 0:t.songs)||[]).map(e=>h.value.find(n=>n.id==e)).filter(e=>e)});function g(){var e,n,i,s;const t=document.createElement("iframe");t.style.display="none",document.body.appendChild(t),t.contentDocument&&(t.contentDocument.body.innerHTML=`
    <html>
      <head>
        <title>${(e=a.data.value)==null?void 0:e.name}</title>
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
          <h1>${(n=a.data.value)==null?void 0:n.name} - Setlist</h1>
          <div class="song-list" style="height:0;flex:1;">
            ${f.value.map((l,c)=>`<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${c+1}.
                      </span>
                      ${l.name}
                      <span style="font-size: 16px;font-weight:normal">
                        ${b(l)}
                      </span>
                  </div>`).join("")}
          </div>
        </div>
      </body>
    </html>
  `),(i=t.contentWindow)==null||i.focus(),(s=t.contentWindow)==null||s.print()}return(t,e)=>{const n=u("v-btn"),i=u("v-list");return d(),p(w,null,{default:r(()=>{var s;return[o("h2",H,[o("div",null,[m(x,{to:_(O)},null,8,["to"])]),o("div",L,z((s=_(a))==null?void 0:s.name),1),o("div",null,[m(n,{color:"primary",onClick:g,class:"ms-2"},{default:r(()=>[I("Print")]),_:1})])]),o("div",M,[m(i,{density:"compact"},{default:r(()=>[(d(!0),N(V,null,T(f.value,(l,c)=>(d(),p(y,{index:c+1,song:l},null,8,["index","song"]))),256))]),_:1})])]}),_:1})}}}),X=F(R,[["__scopeId","data-v-b29356a9"]]);export{X as default};
