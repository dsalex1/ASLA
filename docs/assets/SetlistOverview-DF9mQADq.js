import{_ as y}from"./Backbutton.vuevuetypescriptsetuptruelang-CcNjVkjf.js";import{_ as g}from"./SongListItem.vuevuetypescriptsetuptruelang-BxbiVbwy.js";import{g as w}from"./helpers-r6LUHQxN.js";import{_ as b}from"./AppLayout.vuevuetypescriptsetuptruelang-DBENaDrJ.js";import{d as C,ab as $,aa as D,u as S,v as j,c as p,w as r,ad as k,s as B,a as E,r as u,o as d,b as a,e as m,j as _,af as O,t as z,f as I,g as N,h as T,F as V}from"./index-CWS3yXl0.js";import{_ as F}from"./plugin-vueexport-helper-DlAUqK2U.js";import"./auth-D9ZpjP5c.js";const H={class:"d-flex"},L={style:{flex:"1"}},M={class:"w-100 d-flex justify-center"},R=C({__name:"SetlistOverview",setup(W){const v=k().params.id,i=$(D(B,v)),h=S(E),f=j(()=>{var t;return(((t=i.data.value)==null?void 0:t.songs)||[]).map(n=>typeof n=="string"?h.value.find(s=>s.id==n):n).filter(n=>n)});function x(){var n,s,l,o;const t=document.createElement("iframe");t.style.display="none",document.body.appendChild(t),t.contentDocument&&(t.contentDocument.body.innerHTML=`
    <html>
      <head>
        <title>${(n=i.data.value)==null?void 0:n.name}</title>
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
        <div style="height: 100%;display: flex; flex-direction: column;justify-content: center;">
          <h1>${(s=i.data.value)==null?void 0:s.name} - Setlist</h1>
          <div class="song-list" style="height:0;flex:1;">
            ${f.value.map((e,c)=>`<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${c+1}.
                      </span>
                      ${"name"in e?e.name:"title"in e?e.title:""}
                      <span style="font-size: 16px;font-weight:normal">
                        ${"name"in e?w(e):"title"in e?e.description:""}
                      </span>
                  </div>`).join("")}
          </div>
        </div>
      </body>
    </html>
  `),(l=t.contentWindow)==null||l.focus(),(o=t.contentWindow)==null||o.print()}return(t,n)=>{const s=u("v-btn"),l=u("v-list");return d(),p(b,null,{default:r(()=>{var o;return[a("h2",H,[a("div",null,[m(y,{to:_(O)},null,8,["to"])]),a("div",L,z((o=_(i))==null?void 0:o.name),1),a("div",null,[m(s,{color:"primary",onClick:x,class:"ms-2"},{default:r(()=>[I("Print")]),_:1})])]),a("div",M,[m(l,{density:"compact"},{default:r(()=>[(d(!0),N(V,null,T(f.value,(e,c)=>(d(),p(g,{index:c+1,song:e},null,8,["index","song"]))),256))]),_:1})])]}),_:1})}}}),X=F(R,[["__scopeId","data-v-411c31fd"]]);export{X as default};
