var Be=Object.defineProperty;var Fe=(e,t,s)=>t in e?Be(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var v=(e,t,s)=>Fe(e,typeof t!="symbol"?t+"":t,s);import{u as Re,_ as Ne}from"./sheetBaseDirectory-yiVXRHCi.js";import{p as te,j as De,m as Ue,k as se,l as U,n as $,q as ae,V as le,b as d,F as J,v as Oe,x as O,I as Ke,y as Ge,z as ze,A as We,B as He,C as je,D as de,E as Xe,G as Ye,H as qe,J as ce,K as ue,L as he,M as Je,N as Qe,O as Ze,P as et,h as tt,Q as st,R as it,S as rt,T as S,U as fe,W as nt,X as ot,Y as at,Z as ge,_ as lt,$ as dt,a0 as ct,a1 as Y,o as V,c as N,a2 as ut,g as ht,w,a3 as q,a4 as me,a5 as pe,f as xe,a6 as Ce,a7 as ft,a8 as gt,d as ke,r as R,i as T,e as K,t as Q,a as z,a9 as mt,aa as pt,ab as vt,ac as yt,ad as bt,s as ve,ae as wt,af as It,ag as ye,ah as Dt,ai as xt}from"./index-W8QkwKgP.js";import{u as Ct,m as kt,f as Tt}from"./helpers-D3WcONzF.js";import{_ as Et}from"./AppLayout.vue_vue_type_script_setup_true_lang-Mfg8mKmj.js";import{_ as St}from"./plugin-vue_export-helper-DlAUqK2U.js";import"./auth-8cKHBzK5.js";const $t=te({...De(Ue({collapseIcon:"$treeviewCollapse",expandIcon:"$treeviewExpand"}),["subgroup"])},"VTreeviewGroup"),be=se()({name:"VTreeviewGroup",props:$t(),setup(e,t){let{slots:s}=t;const i=U(),r=$(()=>{var a;return(a=i.value)!=null&&a.isOpen?e.collapseIcon:e.expandIcon}),o=$(()=>{var a;return{VTreeviewItem:{prependIcon:void 0,appendIcon:void 0,active:(a=i.value)==null?void 0:a.isOpen,toggleIcon:r.value}}});return ae(()=>{const a=le.filterProps(e);return d(le,O(a,{ref:i,class:["v-treeview-group",e.class],subgroup:!0}),{...s,activator:s.activator?n=>d(J,null,[d(Oe,{defaults:o.value},{default:()=>{var l;return[(l=s.activator)==null?void 0:l.call(s,n)]}})]):void 0})}),{}}}),Te=Symbol.for("vuetify:v-treeview"),_t=te({loading:Boolean,toggleIcon:Ke,...Ge({slim:!0})},"VTreeviewItem"),ne=se()({name:"VTreeviewItem",props:_t(),setup(e,t){let{attrs:s,slots:i,emit:r}=t;const o=ze(e,s),a=$(()=>e.value===void 0?o.href.value:e.value),n=U(),{activate:l,isActivated:u,select:y,isSelected:p,isIndeterminate:I,isGroupActivator:b,root:x,id:m}=We(a,!1),C=$(()=>x.activatable.value&&b),{densityClasses:k}=He(e,"v-list-item"),h=$(()=>({isActive:u.value,select:y,isSelected:p.value,isIndeterminate:I.value})),f=$(()=>{var D;return!e.disabled&&e.link!==!1&&(e.link||o.isClickable.value||e.value!=null&&!!((D=n.value)!=null&&D.list))});function g(D){var E,M;!f.value||!C.value&&b||x.activatable.value&&(C.value?l(!u.value,D):(M=n.value)==null||M.activate(!((E=n.value)!=null&&E.isActivated),D))}function _(D){(D.key==="Enter"||D.key===" ")&&(D.preventDefault(),g(D))}const P=je(Te,{visibleIds:U()}).visibleIds;return ae(()=>{var H;const D=i.title||e.title!=null,E=i.subtitle||e.subtitle!=null,M=de.filterProps(e),ie=i.prepend||e.toggleIcon;return C.value?Xe(d("div",{class:["v-list-item","v-list-item--one-line","v-treeview-item","v-treeview-item--activetable-group-activator",{"v-list-item--active":u.value||p.value,"v-treeview-item--filtered":P.value&&!P.value.has(m.value)},k.value,e.class],onClick:g},[d(J,null,[qe(u.value||p.value,"v-list-item"),e.toggleIcon&&d(ce,{start:!1},{default:()=>[d(ue,{density:"compact",icon:e.toggleIcon,loading:e.loading,variant:"text",onClick:e.onClick},{loader(){return d(he,{indeterminate:"disable-shrink",size:"20",width:"2"},null)}})]})]),d("div",{class:"v-list-item__content","data-no-activator":""},[D&&d(Je,{key:"title"},{default:()=>{var A;return[((A=i.title)==null?void 0:A.call(i,{title:e.title}))??e.title]}}),E&&d(Qe,{key:"subtitle"},{default:()=>{var A;return[((A=i.subtitle)==null?void 0:A.call(i,{subtitle:e.subtitle}))??e.subtitle]}}),(H=i.default)==null?void 0:H.call(i,h.value)])]),[[Ye("ripple"),f.value&&e.ripple]]):d(de,O({ref:n},M,{class:["v-treeview-item",{"v-treeview-item--filtered":P.value&&!P.value.has(m.value)},e.class],value:m.value,onClick:g,onKeydown:f.value&&_}),{...i,prepend:ie?A=>{var j;return d(J,null,[e.toggleIcon&&d(ce,{start:!1},{default:()=>[d(ue,{density:"compact",icon:e.toggleIcon,loading:e.loading,variant:"text"},{loader(){return d(he,{indeterminate:"disable-shrink",size:"20",width:"2"},null)}})]}),(j=i.prepend)==null?void 0:j.call(i,A)])}:void 0})}),{}}}),Ee=te({loadChildren:Function,loadingIcon:{type:String,default:"$loading"},items:Array,selectable:Boolean,selectStrategy:[String,Function,Object]},"VTreeviewChildren"),Z=se()({name:"VTreeviewChildren",props:Ee(),setup(e,t){let{emit:s,slots:i}=t;const r=Ze(null);function o(n){return new Promise(l=>{var u,y;if(!((u=e.items)!=null&&u.length)||!e.loadChildren)return l();if(((y=n==null?void 0:n.children)==null?void 0:y.length)===0){r.value=n.value,e.loadChildren(n).then(l);return}l()}).finally(()=>{r.value=null})}function a(n,l){e.selectable&&n(!l)}return()=>{var n,l;return((n=i.default)==null?void 0:n.call(i))??((l=e.items)==null?void 0:l.map(u=>{var k;let{children:y,props:p,raw:I}=u;const b=r.value===I.value,x={prepend:h=>{var f;return d(J,null,[e.selectable&&(!y||y&&!["leaf","single-leaf"].includes(e.selectStrategy))&&d("div",null,[d(et,{key:I.value,modelValue:h.isSelected,loading:b,indeterminate:h.isIndeterminate,onClick:tt(()=>a(h.select,h.isSelected),["stop"]),onKeydown:g=>{["Enter","Space"].includes(g.key)&&(g.stopPropagation(),a(h.select,h.isSelected))}},null)]),(f=i.prepend)==null?void 0:f.call(i,{...h,item:I})])},append:i.append?h=>{var f;return(f=i.append)==null?void 0:f.call(i,{...h,item:I})}:void 0,title:i.title?h=>{var f;return(f=i.title)==null?void 0:f.call(i,{...h,item:I})}:void 0},m=be.filterProps(p),C=Z.filterProps(e);return y?d(be,O({value:p==null?void 0:p.value},m),{activator:h=>{let{props:f}=h;const g={...p,...f,value:p==null?void 0:p.value};return d(ne,O(g,{loading:b,onClick:()=>o(I)}),x)},default:()=>d(Z,O(C,{items:y}),i)}):((k=i.item)==null?void 0:k.call(i,{props:p}))??d(ne,p,x)}))}}});function Se(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:[];for(const s of e)t.push(s),s.children&&Se(s.children,t);return t}const Pt=te({openAll:Boolean,search:String,...st({filterKeys:["title"]}),...Ee(),...De(it({collapseIcon:"$treeviewCollapse",expandIcon:"$treeviewExpand",slim:!0}),["nav"])},"VTreeview"),Mt=se()({name:"VTreeview",props:Pt(),emits:{"update:opened":e=>!0,"update:activated":e=>!0,"update:selected":e=>!0,"click:open":e=>!0,"click:select":e=>!0},setup(e,t){let{slots:s}=t;const{items:i}=rt(e),r=S(e,"activeColor"),o=S(e,"baseColor"),a=S(e,"color"),n=fe(e,"activated"),l=fe(e,"selected"),u=U(),y=$(()=>e.openAll?k(i.value):e.opened),p=$(()=>Se(i.value)),I=S(e,"search"),{filteredItems:b}=nt(e,p,I),x=$(()=>I.value?new Set(b.value.flatMap(h=>[...m(h.props.value),...C(h.props.value)])):null);function m(h){var _;const f=[];let g=h;for(;g!=null;)f.unshift(g),g=(_=u.value)==null?void 0:_.parents.get(g);return f}function C(h){var _,P;const f=[],g=(((_=u.value)==null?void 0:_.children.get(h))??[]).slice();for(;g.length;){const D=g.shift();D&&(f.push(D),g.push(...(((P=u.value)==null?void 0:P.children.get(D))??[]).slice()))}return f}function k(h){let f=[];for(const g of h)g.children&&(f.push(g.value),g.children&&(f=f.concat(k(g.children))));return f}return ot(Te,{visibleIds:x}),at({VTreeviewGroup:{activeColor:r,baseColor:o,color:a,collapseIcon:S(e,"collapseIcon"),expandIcon:S(e,"expandIcon")},VTreeviewItem:{activeClass:S(e,"activeClass"),activeColor:r,baseColor:o,color:a,density:S(e,"density"),disabled:S(e,"disabled"),lines:S(e,"lines"),variant:S(e,"variant")}}),ae(()=>{const h=ge.filterProps(e),f=Z.filterProps(e);return d(ge,O({ref:u},h,{class:["v-treeview",e.class],style:e.style,opened:y.value,activated:n.value,"onUpdate:activated":g=>n.value=g,selected:l.value,"onUpdate:selected":g=>l.value=g}),{default:()=>[d(Z,O(f,{items:i.value}),s)]})}),{open}}});function At(e){return{all:e=e||new Map,on:function(t,s){var i=e.get(t);i?i.push(s):e.set(t,[s])},off:function(t,s){var i=e.get(t);i&&(s?i.splice(i.indexOf(s)>>>0,1):e.set(t,[]))},emit:function(t,s){var i=e.get(t);i&&i.slice().map(function(r){r(s)}),(i=e.get("*"))&&i.slice().map(function(r){r(t,s)})}}}class Vt{constructor(){v(this,"inProgress",!1);v(this,"type",null);v(this,"data",null);v(this,"source",null);v(this,"top",null);v(this,"position",null);v(this,"eventBus",At());v(this,"success",null)}startDrag(t,s,i,r,o,a){this.type=o,this.data=a,this.source=t,this.position={x:i,y:r},this.top=null,this.inProgress=!0,this.emit(s,"dragstart"),this.emit(s,"dragtopchanged",{previousTop:null})}resetVariables(){this.inProgress=!1,this.data=null,this.source=null,this.position=null,this.success=null}stopDrag(t){this.success=this.top!==null&&this.top.compatibleMode&&this.top.dropAllowed,this.top!==null&&this.emit(t,"drop"),this.emit(t,"dragend"),this.resetVariables()}cancelDrag(t){this.success=!1,this.emit(t,"dragend"),this.resetVariables()}mouseMove(t,s){if(this.inProgress){let i=!1;const r=this.top;s===null?(this.top=null,i=!0):s.isDropMask?(this.top=null,i=!0):s.candidate(this.type,this.data,this.source)&&(this.top=s,i=!0),i&&t.stopPropagation(),this.top!==r&&this.emit(t.detail.native,"dragtopchanged",{previousTop:r}),this.position={x:t.detail.x,y:t.detail.y},this.emit(t.detail.native,"dragpositionchanged")}}emit(t,s,i={}){this.eventBus.emit(s,{type:this.type,data:this.data,top:this.top,source:this.source,position:this.position,success:this.success,native:t,...i})}on(t,s){this.eventBus.on(t,s)}off(t,s){this.eventBus.off(t,s)}}const c=lt(new Vt);var $e={data(){return{isDropMask:!1}},computed:{dragInProgress(){return c.inProgress},dragData(){return c.data},dragType(){return c.type},dragPosition(){return c.position},dragSource(){return c.source},dragTop(){return c.top}}};function G(e){const t=Lt(e);return t.style.position="fixed",t.style.margin="0",t.style["z-index"]="1000",t.style.transition="opacity 0.2s",t}function Lt(e){const t=e.cloneNode(!0);we(e,t);const s=e.getElementsByTagName("*"),i=t.getElementsByTagName("*");for(let r=s.length;r--;){const o=s[r],a=i[r];we(o,a)}return t}function we(e,t){const s=window.getComputedStyle(e);for(const i of s)if(i==="width"){const r=s.getPropertyValue("box-sizing")==="border-box"?e.clientWidth:e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);t.style.setProperty("width",r+"px")}else if(i==="height"){const r=s.getPropertyValue("box-sizing")==="border-box"?e.clientHeight:e.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom);t.style.setProperty("height",r+"px")}else t.style.setProperty(i,s.getPropertyValue(i),s.getPropertyPriority(i));t.style.pointerEvents="none"}const Bt=/(auto|scroll)/,re=(e,t)=>getComputedStyle(e,null).getPropertyValue(t),Ft=e=>Bt.test(re(e,"overflow")+re(e,"overflow-y")+re(e,"overflow-x")),oe=e=>!e||e===document.body?document.body:Ft(e)?e:oe(e.parentNode);var _e=null;function W(){clearTimeout(_e)}function Rt(e,t,s,i,r){if(!t||!r)return W(),!1;var o=t.getBoundingClientRect(),a=t===document.body,n=s-o.left,l=i-o.top;a&&(n=s,l=i);var u=o.width,y=o.height;a&&(u=document.documentElement.clientWidth,y=document.documentElement.clientHeight);var p=r,I=r,b=y-r,x=u-r,m=n<I,C=n>x,k=l<p,h=l>b;if(!(m||C||k||h))return W(),!1;var f=Math.max(t.scrollWidth,t.offsetWidth,t.clientWidth),g=Math.max(t.scrollHeight,t.offsetHeight,t.clientHeight),_=f-u,P=g-y;(function E(){W(),D()&&(_e=setTimeout(E,30))})();function D(){var E=t.scrollLeft,M=t.scrollTop;a&&(E=window.pageXOffset,M=window.pageYOffset);var ie=M>0,H=M<P,A=E>0,j=E<_,L=E,B=M,X=50;if(m&&A){const F=(I-n)/r;L=L-X*F}else if(C&&j){const F=(n-x)/r;L=L+X*F}if(k&&ie){const F=(p-l)/r;B=B-X*F}else if(h&&H){const F=(l-b)/r;B=B+X*F}return L=Math.max(0,Math.min(_,L)),B=Math.max(0,Math.min(P,B)),L!==E||B!==M?((a?window:t).scrollTo(L,B),!0):!1}return!0}var Nt={mixins:[$e],props:{type:{type:String,default:null},data:{default:null},dragImageOpacity:{type:Number,default:.7},disabled:{type:Boolean,default:!1},goBack:{type:Boolean,default:!1},handle:{type:String,default:null},delta:{type:Number,default:0},delay:{type:Number,default:0},dragClass:{type:String,default:null},vibration:{type:Number,default:0},scrollingEdgeSize:{type:Number,default:100}},emits:["dragstart","dragend","cut","copy"],data(){return{dragInitialised:!1,dragStarted:!1,ignoreNextClick:!1,initialUserSelect:null,downEvent:null,startPosition:null,delayTimer:null,scrollContainer:null}},computed:{cssClasses(){const e={"dnd-drag":!0};return this.disabled?e:{...e,"drag-source":this.dragInProgress&&this.dragSource===this,"drag-mode-copy":this.currentDropMode==="copy","drag-mode-cut":this.currentDropMode==="cut","drag-mode-reordering":this.currentDropMode==="reordering","drag-no-handle":!this.handle}},currentDropMode(){return this.dragInProgress&&this.dragSource===this&&this.dragTop&&this.dragTop.dropAllowed?this.dragTop.reordering?"reordering":this.dragTop.mode:null}},methods:{onSelectStart(e){e.stopPropagation(),e.preventDefault()},performVibration(){this.vibration>0&&window.navigator&&window.navigator.vibrate&&window.navigator.vibrate(this.vibration)},onMouseDown(e){let t=null,s=!1;if(e.type==="mousedown"){const r=e;t=e.target,s=r.buttons===1}else t=e.touches[0].target,s=!0;if(!(this.disabled||this.downEvent!==null||!s||!(!t.matches(".dnd-no-drag, .dnd-no-drag *")&&(!this.handle||t.matches(this.handle+", "+this.handle+" *"))))){if(this.scrollContainer=oe(t),this.initialUserSelect=document.body.style.userSelect,document.documentElement.style.userSelect="none",this.dragStarted=!1,this.downEvent=e,this.downEvent.type==="mousedown"){const r=e;this.startPosition={x:r.clientX,y:r.clientY}}else{const r=e;this.startPosition={x:r.touches[0].clientX,y:r.touches[0].clientY}}this.delay?(this.dragInitialised=!1,clearTimeout(this.delayTimer),this.delayTimer=setTimeout(()=>{this.dragInitialised=!0,this.performVibration()},this.delay)):(this.dragInitialised=!0,this.performVibration()),document.addEventListener("click",this.onMouseClick,!0),document.addEventListener("mouseup",this.onMouseUp),document.addEventListener("touchend",this.onMouseUp),document.addEventListener("selectstart",this.onSelectStart),document.addEventListener("keyup",this.onKeyUp),setTimeout(()=>{document.addEventListener("mousemove",this.onMouseMove),document.addEventListener("touchmove",this.onMouseMove,{passive:!1}),document.addEventListener("easy-dnd-move",this.onEasyDnDMove)},0),e.stopPropagation()}},onMouseClick(e){if(this.ignoreNextClick)return e.preventDefault(),e.stopPropagation&&e.stopPropagation(),e.stopImmediatePropagation&&e.stopImmediatePropagation(),this.ignoreNextClick=!1,!1},onMouseMove(e){if(this.downEvent===null||this.downEvent.type==="touchstart"&&e.type==="mousemove")return;let t=null,s=null,i=null;if(e.type==="touchmove"){const o=e;if(s=o.touches[0].clientX,i=o.touches[0].clientY,t=document.elementFromPoint(s,i),!t)return}else{const o=e;s=o.clientX,i=o.clientY,t=o.target}const r=Math.sqrt(Math.pow(this.startPosition.x-s,2)+Math.pow(this.startPosition.y-i,2));if(!this.dragStarted&&r>this.delta&&(this.dragInitialised?(this.ignoreNextClick=!0,this.dragStarted=!0,c.startDrag(this,this.downEvent,this.startPosition.x,this.startPosition.y,this.type,this.data),document.documentElement.classList.add("drag-in-progress")):clearTimeout(this.delayTimer)),this.dragStarted){const o=this.dragTop&&this.dragTop.$props.scrollingEdgeSize!==void 0?this.dragTop.$props.scrollingEdgeSize:this.scrollingEdgeSize;if(o){const n=this.dragTop?oe(this.dragTop.$el):this.scrollContainer;Rt(e,n,s,i,o)}else W();const a=new CustomEvent("easy-dnd-move",{bubbles:!0,cancelable:!0,detail:{x:s,y:i,native:e}});t.dispatchEvent(a)}this.dragInitialised&&e.cancelable&&e.preventDefault()},onEasyDnDMove(e){c.mouseMove(e,null)},onMouseUp(e){this.downEvent.type==="touchstart"&&e.type==="mouseup"||setTimeout(()=>{this.cancelDragActions(),this.dragStarted&&c.stopDrag(e),this.finishDrag()},0)},onKeyUp(e){e.key==="Escape"&&(this.cancelDragActions(),setTimeout(()=>{c.cancelDrag(e),this.finishDrag()},0))},cancelDragActions(){this.dragInitialised=!1,clearTimeout(this.delayTimer),W()},finishDrag(){this.downEvent=null,this.scrollContainer=null,this.dragStarted&&document.documentElement.classList.remove("drag-in-progress"),document.removeEventListener("click",this.onMouseClick,!0),document.removeEventListener("mousemove",this.onMouseMove),document.removeEventListener("touchmove",this.onMouseMove),document.removeEventListener("easy-dnd-move",this.onEasyDnDMove),document.removeEventListener("mouseup",this.onMouseUp),document.removeEventListener("touchend",this.onMouseUp),document.removeEventListener("selectstart",this.onSelectStart),document.removeEventListener("keyup",this.onKeyUp),document.documentElement.style.userSelect=this.initialUserSelect},dndDragStart(e){e.source===this&&this.$emit("dragstart",e)},dndDragEnd(e){e.source===this&&this.$emit("dragend",e)},createDragImage(e){let t;if(this.$slots["drag-image"]){const s=this.$refs["drag-image"]||document.createElement("div");s.childElementCount!==1?t=G(s):t=G(s.children.item(0))}else t=G(this.$el),t.style.transform=e;return this.dragClass&&t.classList.add(this.dragClass),t.classList.add("dnd-ghost"),t.__opacity=this.dragImageOpacity,t}},created(){c.on("dragstart",this.dndDragStart),c.on("dragend",this.dndDragEnd)},mounted(){this.$el.addEventListener("mousedown",this.onMouseDown),this.$el.addEventListener("touchstart",this.onMouseDown)},beforeUnmount(){c.off("dragstart",this.dndDragStart),c.off("dragend",this.dndDragEnd),this.$el.removeEventListener("mousedown",this.onMouseDown),this.$el.removeEventListener("touchstart",this.onMouseDown)}},ee={name:"Drag",mixins:[Nt],props:{tag:{type:[String,Object,Function],default:"div"}},computed:{dynamicSlots(){return Object.entries(this.$slots).filter(([e])=>e!=="drag-image"&&e!=="default")}}};const Ut={key:0,ref:"drag-image",class:"__drag-image"};function Ot(e,t,s,i,r,o){return V(),N(gt(s.tag),{class:ft(e.cssClasses)},ut({default:w(()=>[q(e.$slots,"default",me(pe(e.$slots.default||{}))),e.dragInitialised?(V(),xe("div",Ut,[q(e.$slots,"drag-image")],512)):Ce("v-if",!0)]),_:2},[ht(o.dynamicSlots,([a,n])=>({name:a,fn:w(()=>[q(e.$slots,a,me(pe(n)))])}))]),1032,["class"])}ee.render=Ot;ee.__scopeId="data-v-f87407ce";function Pe(e){return e.dragInProgress&&e.typeAllowed?e.compatibleMode&&e.effectiveAcceptsData(e.dragData,e.dragType):null}function Me(e,t){e.$emit("drop",t),t.source.$emit(e.mode,t)}function Ae(e,t){return e.effectiveAcceptsType(t)}var Kt={mixins:[$e],props:{acceptsType:{type:[String,Array,Function],default:null},acceptsData:{type:Function,default:()=>!0},mode:{type:String,default:"copy"},dragImageOpacity:{type:Number,default:.7}},emits:["dragover","dragenter","dragleave","dragend","drop"],data(){return{isDrop:!0}},computed:{compatibleMode(){return this.dragInProgress?!0:null},dropIn(){return this.dragInProgress?this.dragTop===this:null},typeAllowed(){return this.dragInProgress?this.effectiveAcceptsType(this.dragType):null},dropAllowed(){return Pe(this)},cssClasses(){const e={"dnd-drop":!0};return this.dropIn!==null&&(e["drop-in"]=this.dropIn,e["drop-out"]=!this.dropIn),this.typeAllowed!==null&&(e["type-allowed"]=this.typeAllowed,e["type-forbidden"]=!this.typeAllowed),this.dropAllowed!==null&&(e["drop-allowed"]=this.dropAllowed,e["drop-forbidden"]=!this.dropAllowed),e}},methods:{effectiveAcceptsType(e){return this.acceptsType===null?!0:typeof this.acceptsType=="string"||typeof this.acceptsType=="number"?this.acceptsType===e:typeof this.acceptsType=="object"&&Array.isArray(this.acceptsType)?this.acceptsType.includes(e):this.acceptsType(e)},effectiveAcceptsData(e,t){return this.acceptsData(e,t)},onDragPositionChanged(e){this===e.top&&this.$emit("dragover",e)},onDragTopChanged(e){this===e.top&&this.$emit("dragenter",e),this===e.previousTop&&this.$emit("dragleave",e)},onDragEnd(e){this===e.top&&this.$emit("dragend",e)},onDrop(e){this.dropIn&&this.compatibleMode&&this.dropAllowed&&this.doDrop(e)},doDrop(e){Me(this,e)},candidate(e){return Ae(this,e)},createDragImage(){let e="source";if(this.$refs["drag-image"]){const t=this.$refs["drag-image"];t.childElementCount!==1?e=G(t):e=G(t.children.item(0)),e.__opacity=this.dragImageOpacity,e.classList.add("dnd-ghost")}return e},onDnDMove(e){c.mouseMove(e,this)}},created(){c.on("dragpositionchanged",this.onDragPositionChanged),c.on("dragtopchanged",this.onDragTopChanged),c.on("drop",this.onDrop),c.on("dragend",this.onDragEnd)},mounted(){this.$el.addEventListener("easy-dnd-move",this.onDnDMove)},beforeUnmount(){this.$el.removeEventListener("easy-dnd-move",this.onDnDMove),c.off("dragpositionchanged",this.onDragPositionChanged),c.off("dragtopchanged",this.onDragTopChanged),c.off("drop",this.onDrop),c.off("dragend",this.onDragEnd)}},Ve={name:"DragFeedback"};const Gt={class:"DragFeedback"};function zt(e,t,s,i,r,o){return V(),xe("div",Gt,[q(e.$slots,"default")])}Ve.render=zt;class Ie{constructor(t,s,i,r){v(this,"reference");v(this,"referenceOriginalPosition");v(this,"magnets",[]);this.reference=t.item(0).parentNode,this.referenceOriginalPosition={x:this.reference.getBoundingClientRect().left-this.reference.scrollLeft,y:this.reference.getBoundingClientRect().top-this.reference.scrollTop};let o=0;for(const a of t){if(o>s)break;const n=a.getBoundingClientRect(),l=a.classList.contains("dnd-drop")||a.getElementsByClassName("dnd-drop").length>0;let u=!1;if(l){if(i==="auto")throw"Easy-DnD error : a drop list is missing one of these attributes : 'row' or 'column'.";u=i==="row"}r===null?this.magnets.push(l?this.before(n,u):this.center(n)):this.magnets.push(l?(r<o?this.after:this.before)(n,u):this.center(n)),o++}}center(t){return{x:t.left+t.width/2,y:t.top+t.height/2}}before(t,s){return s?{x:t.left,y:t.top+t.height/2}:{x:t.left+t.width/2,y:t.top}}after(t,s){return s?{x:t.left+t.width,y:t.top+t.height/2}:{x:t.left+t.width/2,y:t.top+t.height}}correction(){return{x:this.reference.getBoundingClientRect().left-this.reference.scrollLeft-this.referenceOriginalPosition.x,y:this.reference.getBoundingClientRect().top-this.reference.scrollTop-this.referenceOriginalPosition.y}}closestIndex(t){const s=t.x-this.correction().x,i=t.y-this.correction().y;let r=999999,o=-1;for(let a=0;a<this.magnets.length;a++){const n=this.magnets[a],l=Math.sqrt(Math.pow(n.x-s,2)+Math.pow(n.y-i,2));l<r&&(r=l,o=a)}return o}}class Wt{constructor(t,s){v(this,"from");v(this,"to");this.from=t,this.to=s}apply(t){const s=t[this.from];t.splice(this.from,1),t.splice(this.to,0,s)}}class Ht{constructor(t,s,i){v(this,"type");v(this,"data");v(this,"index");this.type=t,this.data=s,this.index=i}}var Le={name:"DropList",mixins:[Kt],props:{tag:{type:[String,Object,Function],default:"div"},items:{type:Array,required:!0},row:{type:Boolean,default:!1},column:{type:Boolean,default:!1},noAnimations:{type:Boolean,default:!1},scrollingEdgeSize:{type:Number,default:void 0}},emits:["reorder","insert"],data(){return{grid:null,forbiddenKeys:[],feedbackKey:null,fromIndex:null}},computed:{rootTag(){return this.noAnimations?this.tag:ct},rootProps(){return this.noAnimations?{}:{tag:this.tag,css:!1}},direction(){return this.row?"row":this.column?"column":"auto"},reordering(){return c.inProgress?c.source.$el.parentElement===this.$el:null},closestIndex(){return this.grid?this.grid.closestIndex(c.position):null},dropAllowed(){return this.dragInProgress?this.reordering?this.items.length>1:Pe(this)?this.forbiddenKeys!==null&&this.feedbackKey!==null?!this.forbiddenKeys.includes(this.feedbackKey):!0:!1:null},itemsBeforeFeedback(){return this.closestIndex===0?[]:this.items.slice(0,this.closestIndex)},itemsAfterFeedback(){return this.closestIndex===this.items.length?[]:this.items.slice(this.closestIndex)},itemsBeforeReorderingFeedback(){return this.closestIndex<=this.fromIndex?this.items.slice(0,this.closestIndex):this.items.slice(0,this.closestIndex+1)},itemsAfterReorderingFeedback(){return this.closestIndex<=this.fromIndex?this.items.slice(this.closestIndex):this.items.slice(this.closestIndex+1)},reorderedItems(){const e=this.closestIndex,t=[...this.items],s=t[this.fromIndex];return t.splice(this.fromIndex,1),t.splice(e,0,s),t},clazz(){return{"drop-list":!0,reordering:this.reordering===!0,inserting:this.reordering===!1,...this.reordering===!1?this.cssClasses:{"dnd-drop":!0}}},showDragFeedback(){return this.dragInProgress&&this.typeAllowed&&!this.reordering},showInsertingDragImage(){return this.dragInProgress&&this.typeAllowed&&!this.reordering&&!!this.$slots["drag-image"]},showReorderingDragImage(){return this.dragInProgress&&this.reordering&&!!this.$slots["reordering-drag-image"]},hasReorderingFeedback(){return!!this.$slots["reordering-feedback"]},hasEmptySlot(){return!!this.$slots.empty}},created(){c.on("dragstart",this.onDragStart),c.on("dragend",this.onDragEnd)},beforeUnmount(){c.off("dragstart",this.onDragStart),c.off("dragend",this.onDragEnd)},methods:{refresh(){this.$nextTick(()=>{this.grid=this.computeInsertingGrid(),this.feedbackKey=this.computeFeedbackKey(),this.forbiddenKeys=this.computeForbiddenKeys()})},onDragStart(e){this.candidate(c.type)&&(this.reordering?(this.fromIndex=Array.prototype.indexOf.call(e.source.$el.parentElement.children,e.source.$el),this.grid=this.computeReorderingGrid()):this.refresh())},onDragEnd(){this.fromIndex=null,this.feedbackKey=null,this.forbiddenKeys=null,this.grid=null},doDrop(e){this.reordering?this.fromIndex!==this.closestIndex&&this.$emit("reorder",new Wt(this.fromIndex,this.closestIndex)):(Me(this,e),this.$emit("insert",new Ht(e.type,e.data,this.closestIndex)))},candidate(e){return Ae(this,e)||this.reordering},computeForbiddenKeys(){return(this.noAnimations?[]:this.$refs.component.$slots.default()).map(e=>e.key).filter(e=>!!e&&e!=="drag-image"&&e!=="drag-feedback")},computeFeedbackKey(){return this.$refs.feedback.$slots.default()[0].key},computeInsertingGrid(){if(this.$refs.feedback.$el.children.length<1)return null;const t=this.$refs.feedback.$el.children[0].cloneNode(!0),s=this.$el;s.children.length>this.items.length?s.insertBefore(t,s.children[this.items.length]):s.appendChild(t);const i=new Ie(s.children,this.items.length,this.direction,null);return s.removeChild(t),i},computeReorderingGrid(){return new Ie(this.$el.children,this.items.length-1,this.direction,this.fromIndex)},createDragImage(){let e;if(this.$refs["drag-image"]){const t=this.$refs["drag-image"];let s;t.childElementCount!==1?s=t:s=t.children.item(0);const i=s.cloneNode(!0),r=this.$el;r.appendChild(i),e=G(i),r.removeChild(i),e.__opacity=this.dragImageOpacity,e.classList.add("dnd-ghost")}else e="source";return e}},render(){if(!this.$slots.item)throw'The "Item" slot must be defined to use DropList';if(!this.$slots.feedback)throw'The "Feedback" slot must be defined to use DropList';let e=[];if(this.dropIn&&this.dropAllowed)if(this.reordering)if(this.hasReorderingFeedback){const t=this.itemsBeforeReorderingFeedback.map((i,r)=>this.$slots.item({item:i,index:r,reorder:!1})[0]);t.length>0&&(e=e.concat(t)),e.push(this.$slots["reordering-feedback"]({key:"reordering-feedback",item:this.items[this.fromIndex]})[0]);const s=this.itemsAfterReorderingFeedback.map((i,r)=>this.$slots.item({item:i,index:this.itemsBeforeReorderingFeedback.length+r,reorder:!1})[0]);s.length>0&&(e=e.concat(s))}else{const t=this.reorderedItems.map((s,i)=>this.$slots.item({item:s,index:i,reorder:i===this.closestIndex})[0]);t.length>0&&(e=e.concat(t))}else{const t=this.itemsBeforeFeedback.map((i,r)=>this.$slots.item({item:i,index:r,reorder:!1})[0]);t.length>0&&(e=e.concat(t)),e.push(this.$slots.feedback({key:"drag-feedback",data:this.dragData,type:this.dragType})[0]);const s=this.itemsAfterFeedback.map((i,r)=>this.$slots.item({item:i,index:this.itemsBeforeFeedback.length+r,reorder:!1})[0]);s.length>0&&(e=e.concat(s))}else{const t=this.items.map((s,i)=>this.$slots.item({item:s,index:i,reorder:!1})[0]);t.length>0?e=e.concat(t):this.hasEmptySlot&&e.push(this.$slots.empty()[0])}return this.showDragFeedback&&e.push(Y(Ve,{class:"__feedback",ref:"feedback",key:"drag-feedback"},{default:()=>this.$slots.feedback({type:this.dragType,data:this.dragData})[0]})),this.showReorderingDragImage&&e.push(Y("div",{class:"__drag-image",ref:"drag-image",key:"reordering-drag-image"},{default:()=>this.$slots["reordering-drag-image"]({item:this.items[this.fromIndex]})[0]})),this.showInsertingDragImage&&e.push(Y("div",{class:"__drag-image",ref:"drag-image",key:"inserting-drag-image"},{default:()=>this.$slots["drag-image"]({type:this.dragType,data:this.dragData})[0]})),Y(this.rootTag,{ref:"component",class:this.clazz,...this.rootProps},{default:()=>e})}};Le.__scopeId="data-v-230f65e3";class jt{constructor(){v(this,"selfTransform",null);v(this,"clones",null);v(this,"source",null);v(this,"sourcePos",null);v(this,"sourceClone",null);c.on("dragstart",this.onDragStart.bind(this)),c.on("dragtopchanged",this.onDragTopChanged.bind(this)),c.on("dragpositionchanged",this.onDragPositionChanged.bind(this)),c.on("dragend",this.onDragEnd.bind(this))}onDragStart(t){this.cleanUp(),this.sourcePos={x:t.source.$el.getBoundingClientRect().left,y:t.source.$el.getBoundingClientRect().top},this.selfTransform="translate(-"+(t.position.x-this.sourcePos.x)+"px, -"+(t.position.y-this.sourcePos.y)+"px)",this.clones=new Map,this.source=t.source}onDragEnd(t){dt().then(()=>{if(!t.success&&this.source&&this.source.goBack){const s=this.switch(null);window.requestAnimationFrame(()=>{s.style.transition="all 0.5s",window.requestAnimationFrame(()=>{s.style.left=this.sourcePos.x+"px",s.style.top=this.sourcePos.y+"px",s.style.transform="translate(0,0)";const i=()=>{this.cleanUp(),s.removeEventListener("transitionend",i)};s.addEventListener("transitionend",i)})})}else this.cleanUp()})}cleanUp(){this.clones&&this.clones.forEach(t=>{t.parentNode===document.body&&document.body.removeChild(t)}),this.sourceClone!==null&&this.sourceClone.parentNode===document.body&&document.body.removeChild(this.sourceClone),this.selfTransform=null,this.clones=null,this.source=null,this.sourceClone=null,this.sourcePos=null}onDragTopChanged(t){this.switch(t.top)}switch(t){this.clones.forEach(i=>{i.style.opacity="0"}),this.sourceClone&&(this.sourceClone.style.opacity="0");let s;if(t===null)s=this.getSourceClone();else{if(!this.clones.has(t)){let i=t.createDragImage(this.selfTransform);i==="source"?i=this.getSourceClone():i!==null&&(i.style.opacity="0",document.body.appendChild(i)),this.clones.set(t,i)}s=this.clones.get(t)}return s!==null&&(s.offsetWidth,s.style.opacity=s.__opacity,s.style.visibility="visible"),s}getSourceClone(){return this.sourceClone===null&&(this.sourceClone=this.source.createDragImage(this.selfTransform),this.sourceClone.style.opacity="0",document.body.appendChild(this.sourceClone)),this.sourceClone}onDragPositionChanged(){this.clones.forEach(t=>{t.style.left=c.position.x+"px",t.style.top=c.position.y+"px"}),this.sourceClone&&(this.sourceClone.style.left=c.position.x+"px",this.sourceClone.style.top=c.position.y+"px")}}new jt;const Xt=z("h3",null,"Selected files",-1),Yt=z("h3",null,"Available files",-1),qt=ke({__name:"FileSelector",props:{files:{},modelValue:{}},emits:["update:modelValue"],setup(e,{emit:t}){const s=e,r=Ct(s,"modelValue",t);function o(l){r.value.splice(l.index,0,l.data)}const a=$(()=>kt(s.files,l=>({title:l.name}))),n=$(()=>Tt(a.value,l=>!r.value.includes(l.title)));return(l,u)=>{const y=R("v-list-item"),p=R("v-btn"),I=R("v-list"),b=R("v-col"),x=R("v-row");return V(),N(x,null,{default:w(()=>[d(b,{cols:"12",sm:"6",orderSm:"2"},{default:w(()=>[Xt,d(I,{density:"compact"},{default:w(()=>[d(T(Le),{items:T(r),class:"list",onInsert:o,onReorder:u[0]||(u[0]=m=>m.apply(T(r)))},{empty:w(()=>[d(y,{color:"primary"},{default:w(()=>[K("No files selected")]),_:1})]),item:w(({item:m,reorder:C})=>[(V(),N(T(ee),{key:m},{default:w(()=>[d(y,{color:"primary",active:C},{append:w(()=>[d(p,{onClick:k=>T(r).splice(T(r).indexOf(m),1),icon:"fas fa-close",variant:"plain",style:{height:"32px"}},null,8,["onClick"])]),default:w(()=>[K(Q(m)+" ",1)]),_:2},1032,["active"])]),_:2},1024))]),feedback:w(({data:m})=>[(V(),N(y,{color:"primary",active:"",key:m},{append:w(()=>[d(p,{icon:"fas fa-close",variant:"plain",style:{height:"32px"}})]),default:w(()=>[K(Q(m)+" ",1)]),_:2},1024))]),_:1},8,["items"])]),_:1})]),_:1}),d(b,{cols:"12",sm:"6",orderSm:"1"},{default:w(()=>[Yt,d(T(Mt),{items:n.value,density:"compact",class:"disable-active-underlay"},{item:w(({props:m})=>[(V(),N(T(ee),{data:m.title,class:"item",key:m.title},{default:w(()=>[d(T(ne),{title:m.title,onClick:C=>T(r).push(m.title),"prepend-icon":"fas fa-file-pdf"},null,8,["title","onClick"])]),_:2},1032,["data"]))]),_:1},8,["items"])]),_:1})]),_:1})}}}),Jt={class:"d-flex justify-space-between"},Qt=ke({__name:"SetlistCreateUpdate",setup(e){const t=yt(),s=bt(),i=t.params.id,r=i?"edit":"create",o=i?mt(ve,i):null,a=i?pt(o):null;a&&vt(a,b=>{b&&(n.value=b)});const n=U({id:"",name:"",songs:[]}),l=U(""),u=U(!1);async function y(){l.value="",u.value=!0;try{r=="create"?await It(ve,ye(n.value,"id")):await Dt(o,ye(n==null?void 0:n.value,"id")),s.push("/setlist")}catch(b){console.error(b),l.value="An unknown error occurred."}u.value=!1}async function p(){if(i){l.value="",u.value=!0;try{await xt(o),s.push("/setlist")}catch(b){console.error(b),l.value="An unknown error occurred."}u.value=!1}}const{pdfTree:I}=Re();return(b,x)=>{const m=R("v-btn"),C=R("v-text-field");return V(),N(Et,null,{default:w(()=>[z("h2",Jt,[z("div",null,[d(Ne,{to:T(wt)},null,8,["to"]),K(" "+Q(T(r)=="create"?"Create":"Update")+" Setlist ",1)]),z("div",null,[T(r)=="edit"?(V(),N(m,{key:0,onClick:p,color:"error",class:"ms-2","prepend-icon":"fas fa-trash"},{default:w(()=>[K(" Delete ")]),_:1})):Ce("",!0),d(m,{loading:u.value,color:"primary",onClick:y,class:"ms-2"},{default:w(()=>[K(Q(T(r)=="create"?"Create":"Update"),1)]),_:1},8,["loading"])])]),d(C,{modelValue:n.value.name,"onUpdate:modelValue":x[0]||(x[0]=k=>n.value.name=k),label:"Name"},null,8,["modelValue"]),d(qt,{modelValue:n.value.songs,"onUpdate:modelValue":x[1]||(x[1]=k=>n.value.songs=k),files:T(I)},null,8,["modelValue","files"])]),_:1})}}}),os=St(Qt,[["__scopeId","data-v-3f3ebb67"]]);export{os as default};
