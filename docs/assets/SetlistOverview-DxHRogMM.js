import{_ as x}from"./Backbutton.vuevuetypescriptsetuptruelang-BqQnGKMv.js";import{_ as b}from"./SongListItem.vuevuetypescriptsetuptruelang-DTgtegHq.js";import{g as w}from"./helpers-CvCymQbz.js";import{_ as C}from"./AppLayout.vuevuetypescriptsetuptruelang-FErCvKrN.js";import{d as $,ab as j,aa as D,u as S,v as k,c as f,w as c,ad as B,s as E,a as O,r as p,o as r,b as i,e as d,j as u,af as z,f as _,t as I,g as N,h as T,F as V}from"./index-NCEE5lyU.js";import{_ as F}from"./plugin-vueexport-helper-DlAUqK2U.js";import"./auth-CnTrdyKR.js";const H={class:"d-flex justify-space-between"},L={class:"w-100 d-flex justify-center"},M=$({__name:"SetlistOverview",setup(R){const v=B().params.id,o=j(D(E,v)),h=S(O),m=k(()=>{var e;return(((e=o.data.value)==null?void 0:e.songs)||[]).map(t=>h.value.find(n=>n.id==t)).filter(t=>t)});function g(){var t,n,a;const e=document.createElement("iframe");e.style.display="none",document.body.appendChild(e),e.contentDocument&&(e.contentDocument.body.innerHTML=`
    <html>
      <head>
        <title>${(t=o.data.value)==null?void 0:t.name}</title>
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
            ${m.value.map((s,l)=>`<div>
                      <span style="font-size: 16px;font-weight:normal">
                      ${l+1}.
                      </span>
                      ${s.name}
                      <span style="font-size: 16px;font-weight:normal">
                        ${w(s)}
                      </span>
                  </div>`).join("")}
          </div>
        </div>
      </body>
    </html>
  `),(a=e.contentWindow)==null||a.print(),document.body.removeChild(e)}return(e,t)=>{const n=p("v-btn"),a=p("v-list");return r(),f(C,null,{default:c(()=>{var s;return[i("h2",H,[i("div",null,[d(x,{to:u(z)},null,8,["to"]),_(" "+I((s=u(o))==null?void 0:s.name),1)]),i("div",null,[d(n,{color:"primary",onClick:g,class:"ms-2"},{default:c(()=>[_(" Print ")]),_:1})])]),i("div",L,[d(a,{density:"compact"},{default:c(()=>[(r(!0),N(V,null,T(m.value,(l,y)=>(r(),f(b,{index:y+1,song:l},null,8,["index","song"]))),256))]),_:1})])]}),_:1})}}}),Q=F(M,[["__scopeId","data-v-4f421e68"]]);export{Q as default};
