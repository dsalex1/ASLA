import{r as e,o as r,c,d as B,l as m,_ as N,i as A,f as S,b as o,w as n,a as w,t as I,a6 as p,h as D,e as h,as as k,at as L}from"./index-W8QkwKgP.js";import{u as M,_ as C}from"./auth-8cKHBzK5.js";import{_ as U}from"./plugin-vue_export-helper-DlAUqK2U.js";const F={};function O(V,E){const _=e("v-progress-circular");return r(),c(_,{indeterminate:"",color:"primary"})}const G=U(F,[["render",O]]);var W={VITE_FIREBASE_API_KEY:"AIzaSyDR5ik7GoUZA142kws0i-b6NtfUAivS0WM",VITE_FIREBASE_AUTH_DOMAIN:"alex-set-list-app.firebaseapp.com",VITE_FIREBASE_PROJECT_ID:"alex-set-list-app",VITE_FIREBASE_STORAGE_BUCKET:"alex-set-list-app.appspot.com",VITE_FIREBASE_MESSAGING_SENDER_ID:"252093619867",VITE_FIREBASE_APP_ID:"1:252093619867:web:fc5d6fbf1420e9d939703e",VITE_FIREBASE_MEASUREMENT_ID:"G-C44WH0WBW0",VITE_APP_NAME:"ASLA - Alex' Setlist App",VITE_APP_SHORT_NAME:"ASLA",VITE_APP_DESCRIPTION:"Alex' Setlist App",VITE_BASE_URL:"/ASLA/",BASE_URL:"/ASLA/",MODE:"production",DEV:!1,PROD:!0,SSR:!1};const H={key:0,class:"d-flex justify-center align-center",style:{height:"100vh"}},K={class:"mt-2 mb-10"},j=w("h1",{class:"text-h4 mb-2"},"Login",-1),z={key:0,class:"text-error"},$=B({__name:"Login",setup(V){const E=W,_=M(),t=m(""),u=m(!1),i=m(""),a=N({email:"",password:""});async function x(){try{await k(L,a.email),i.value="Password reset email sent.",t.value=""}catch{t.value="No user found with this email."}}const g=async d=>{if((await d).valid){u.value=!0,t.value="",i.value="";try{await _.login(a.email,a.password)}catch{t.value="Wrong credentials."}u.value=!1}};return(d,l)=>{const P=e("v-img"),y=e("v-alert"),f=e("v-text-field"),v=e("v-btn"),T=e("v-form"),R=e("v-sheet"),b=e("v-container");return A(_).user===void 0?(r(),S("div",H,[o(G)])):(r(),c(b,{key:1,class:"d-flex flex-column align-center"},{default:n(()=>[o(P,{class:"mt-12 border rounded",width:"128",height:"128",src:C}),w("h2",K,I(A(E).VITE_APP_NAME),1),o(R,{"max-width":"400",width:"400",class:"mx-auto"},{default:n(()=>[j,i.value?(r(),c(y,{key:0,color:"success mb-2",text:i.value},null,8,["text"])):p("",!0),o(T,{"validate-on":"submit",onSubmit:D(g,["prevent"]),width:"100%"},{default:n(()=>[o(f,{rules:[s=>!!s||"Please enter your password."],modelValue:a.email,"onUpdate:modelValue":l[0]||(l[0]=s=>a.email=s),label:"Email"},null,8,["rules","modelValue"]),o(f,{rules:[s=>!!s||"Please enter your email address."],modelValue:a.password,"onUpdate:modelValue":l[1]||(l[1]=s=>a.password=s),type:"password",label:"Password"},null,8,["rules","modelValue"]),t.value?(r(),S("p",z,I(t.value),1)):p("",!0),o(v,{loading:u.value,type:"submit",color:"primary",class:"me-2 mt-4"},{default:n(()=>[h("Login")]),_:1},8,["loading"]),t.value?(r(),c(v,{key:1,variant:"text",color:"primary",class:"mt-4",onClick:x},{default:n(()=>[h("Forgot Password?")]),_:1})):p("",!0)]),_:1})]),_:1})]),_:1}))}}});export{$ as default};
