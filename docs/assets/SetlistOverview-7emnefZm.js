import{_ as y}from"./Backbutton.vuevuetypescriptsetuptruelang-CCoPn2qf.js";import{_ as x}from"./SongListItem.vuevuetypescriptsetuptruelang-BnpWjxWf.js";import{g as b}from"./helpers-CvCymQbz.js";import{_ as w}from"./AppLayout.vuevuetypescriptsetuptruelang-BFnKO5W5.js";import{d as C,ab as $,aa as D,u as S,v as j,c as p,w as r,ad as k,s as B,a as E,r as u,o as d,b as s,e as m,j as _,af as O,t as z,f as I,g as N,h as T,F as V}from"./index-BZk8rAf-.js";import{_ as F}from"./plugin-vueexport-helper-DlAUqK2U.js";import"./auth-oVDKJtbJ.js";const H={class:"d-flex"},L={style:{flex:"1"}},M={class:"w-100 d-flex justify-center"},R=C({__name:"SetlistOverview",setup(W){const v=k().params.id,a=$(D(B,v)),h=S(E),f=j(()=>{var t;return(((t=a.data.value)==null?void 0:t.songs)||[]).map(e=>h.value.find(n=>n.id==e)).filter(e=>e)});function g(){var e,n,i,o;const t=document.createElement("iframe");t.style.display="none",document.body.appendChild(t),t.contentDocument&&(t.contentDocument.body.innerHTML=`
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
  `),(i=t.contentWindow)==null||i.focus(),(o=t.contentWindow)==null||o.print(),document.body.removeChild(t)}return(t,e)=>{const n=u("v-btn"),i=u("v-list");return d(),p(w,null,{default:r(()=>{var o;return[s("h2",H,[s("div",null,[m(y,{to:_(O)},null,8,["to"])]),s("div",L,z((o=_(a))==null?void 0:o.name),1),s("div",null,[m(n,{color:"primary",onClick:g,class:"ms-2"},{default:r(()=>[I("Print")]),_:1})])]),s("div",M,[m(i,{density:"compact"},{default:r(()=>[(d(!0),N(V,null,T(f.value,(l,c)=>(d(),p(x,{index:c+1,song:l},null,8,["index","song"]))),256))]),_:1})])]}),_:1})}}}),X=F(R,[["__scopeId","data-v-f207534f"]]);export{X as default};
