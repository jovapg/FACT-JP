const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CWdGrTZD.js","assets/index-CVZBez9y.css"])))=>i.map(i=>d[i]);
import{P as Q,u as H,r as g,l as L,y as k,E as N,R as se,m as O,M as Y,z as X,o as r,c as m,b as a,j as o,q as C,t as x,e as j,n as A,F as J,k as ne,p as U,A as oe,s as K,i as re,d as B,w as D,T as le,f as F,v as T,Q as ie,_ as ce,S as ue}from"./index-CWdGrTZD.js";import{_ as G}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{c as i,U as W}from"./utensils-crossed-Q_dxpk_S.js";const de=Q("inventory",()=>{const z=H(),s=g([]),u=g([]),d=g(!1);function c(){var t;return(t=z.currentBusiness)==null?void 0:t.id}const _=L(()=>s.value.filter(t=>t.stock<=(t.minStock||0))),I=L(()=>[...new Set(s.value.map(t=>t.category).filter(Boolean))]),p=L(()=>[...new Set(u.value.map(t=>t.category).filter(Boolean))]);async function w(){if(c()){d.value=!0;try{const t=await k.get(`/api/${c()}/inventory`);s.value=t.data}finally{d.value=!1}}}async function M(){if(!c())return;const t=await k.get(`/api/${c()}/recipes`);u.value=t.data}async function n(t){const e=await k.post(`/api/${c()}/inventory`,t);return s.value.push(e.data),e.data}async function b(t,e){const v=await k.put(`/api/${c()}/inventory/${t}`,e),f=s.value.findIndex(l=>l.id===t);return f!==-1&&(s.value[f]=v.data),v.data}async function R(t){await k.delete(`/api/${c()}/inventory/${t}`),s.value=s.value.filter(e=>e.id!==t)}async function V(t,e,v){const f=await k.patch(`/api/${c()}/inventory/${t}/adjust`,{adjustment:e,reason:v}),l=s.value.findIndex(E=>E.id===t);return l!==-1&&(s.value[l]=f.data),f.data}async function P(t){const e=await k.post(`/api/${c()}/inventory/count`,{items:t});return Array.isArray(e.data.inventory)&&(s.value=e.data.inventory),e.data}async function $(t){const e=await k.post(`/api/${c()}/recipes`,t);return u.value.push(e.data),e.data}async function h(t,e){const v=await k.put(`/api/${c()}/recipes/${t}`,e),f=u.value.findIndex(l=>l.id===t);return f!==-1&&(u.value[f]=v.data),v.data}async function y(t){await k.delete(`/api/${c()}/recipes/${t}`),u.value=u.value.filter(e=>e.id!==t)}return{items:s,recipes:u,loading:d,lowStockItems:_,categories:I,recipeCategories:p,fetchInventory:w,fetchRecipes:M,createItem:n,updateItem:b,deleteItem:R,adjustStock:V,countInventory:P,createRecipe:$,updateRecipe:h,deleteRecipe:y}}),Z=Q("business",()=>{const z=H(),s=g(null),u=g(!1);N(()=>{var n;return(n=z.currentBusiness)==null?void 0:n.id},n=>{s.value=null,n&&c()},{immediate:!0});function d(){var n;return`/api/${(n=z.currentBusiness)==null?void 0:n.id}`}async function c(){u.value=!0;try{const n=await k.get(`${d()}/profile`);s.value=n.data}finally{u.value=!1}}async function _(n){const b=await k.put(`${d()}/profile`,n);return s.value=b.data,b.data}async function I(){return(await k.get(`${d()}/users`)).data}async function p(n){return(await k.post(`${d()}/users`,n)).data}async function w(n,b){return(await k.put(`${d()}/users/${n}`,b)).data}async function M(n){return(await k.delete(`${d()}/users/${n}`)).data}return{profile:s,loading:u,fetchProfile:c,updateProfile:_,fetchUsers:I,createUser:p,updateUser:w,deleteUser:M}}),q=g(!1);function ee(){function z(){q.value=!q.value}function s(){q.value=!1}return{isMenuOpen:q,toggleMenu:z,closeMenu:s}}/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=i("arrow-left-right",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ve=i("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ae=i("building-2",[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const he=i("calendar-clock",[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=i("chart-column",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const me=i("chevron-down",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fe=i("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=i("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=i("clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=i("history",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=i("key-round",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=i("layout-dashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Me=i("log-out",[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $e=i("menu",[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=i("moon",[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xe=i("package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ze=i("piggy-bank",[["path",{d:"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z",key:"1piglc"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M2 8v1a2 2 0 0 0 2 2h1",key:"1env43"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=i("receipt",[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=i("settings",[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=i("shopping-cart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=i("store",[["path",{d:"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5",key:"slp6dd"}],["path",{d:"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",key:"o0xfot"}],["path",{d:"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05",key:"wn3emo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ve=i("sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=i("truck",[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pe=i("wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]),Le={class:"sidebar-header"},Re={class:"sidebar-logo"},Be=["src"],Ue={key:1,class:"logo-icon-wrap"},Ee={key:2,class:"logo-text"},qe=["title"],He={class:"sidebar-nav"},De={class:"nav-icon"},Fe={key:0,class:"nav-label"},Te={key:1,class:"nav-badge"},Ne={key:0,class:"sidebar-footer"},Oe={class:"user-pill"},Je={class:"user-avatar-sm"},We={class:"user-info"},Ge={class:"user-name-sm"},Ke={class:"user-role-sm"},Qe={__name:"SideMenu",setup(z){const s=H(),u=Z(),d=de(),c=se(),{isMenuOpen:_,closeMenu:I}=ee(),p=g(!1),w=g(!1),M=[{path:"/dashboard",label:"Dashboard",icon:we,roles:["superadmin","admin","cajero"]},{path:"/tables",label:"Registrar Venta",icon:W,roles:["superadmin","admin","cajero"]},{path:"/inventory",label:"Inventario",icon:xe,roles:["superadmin","admin","cajero"]},{path:"/recipes",label:"Recetas / Menú",icon:ve,roles:["superadmin","admin"]},{path:"/purchases",label:"Salidas",icon:je,roles:["superadmin","admin"]},{path:"/suppliers",label:"Directorio de pagos",icon:Ae,roles:["superadmin","admin"]},{path:"/reports",label:"Reportes",icon:ye,roles:["superadmin","admin"]},{path:"/finance",label:"Finanzas",icon:ze,roles:["superadmin","admin"]},{path:"/payroll",label:"Nómina",icon:he,roles:["superadmin","admin","cajero"]},{path:"/shifts",label:"Turnos de Caja",icon:be,roles:["superadmin","admin","cajero"]},{path:"/debtors",label:"Deudas",icon:Pe,roles:["superadmin","admin","cajero"]},{path:"/invoices",label:"Facturas",icon:Se,roles:["superadmin","admin","cajero"]},{path:"/audit",label:"Bitácora",icon:ge,roles:["superadmin","admin"]},{path:"/admin/setup",label:"Configuración",icon:te,roles:["superadmin","admin"]},{path:"/admin/franchises",label:"Franquicias",icon:ae,roles:["superadmin"]}],n=L(()=>{var h;const $=(h=s.user)==null?void 0:h.role;return M.filter(y=>y.roles.includes($)).map(y=>({...y,badge:y.path==="/inventory"?d.lowStockItems.length:0}))}),b=L(()=>{var h,y;return{superadmin:"Super Admin",admin:"Administrador",cajero:"Cajero"}[(h=s.user)==null?void 0:h.role]||((y=s.user)==null?void 0:y.role)}),R=L(()=>{var h,y;return(((h=s.user)==null?void 0:h.name)||((y=s.user)==null?void 0:y.username)||"U").charAt(0).toUpperCase()});function V($){return c.path===$||c.path.startsWith($+"/")}function P(){w.value=window.innerWidth<768,p.value=w.value}return N(_,$=>{w.value&&(p.value=!$)}),N(()=>c.path,()=>{w.value&&I()}),O(()=>{P(),window.addEventListener("resize",P)}),Y(()=>window.removeEventListener("resize",P)),($,h)=>{var t,e,v,f;const y=X("router-link");return r(),m(J,null,[a("aside",{class:K(["sidebar",{collapsed:p.value}])},[a("div",Le,[a("div",Re,[(t=o(u).profile)!=null&&t.logo?(r(),m("img",{key:0,src:o(u).profile.logo,class:"logo-img",alt:"logo"},null,8,Be)):(r(),m("div",Ue,[C(o(W),{size:20,color:"#1a0a00"})])),p.value?j("",!0):(r(),m("span",Ee,x(((e=o(u).profile)==null?void 0:e.name)||"facJp"),1))]),a("button",{class:"collapse-btn",onClick:h[0]||(h[0]=l=>p.value=!p.value),title:p.value?"Expandir":"Colapsar"},[p.value?(r(),A(o(ke),{key:1,size:16})):(r(),A(o(fe),{key:0,size:16}))],8,qe)]),a("nav",He,[(r(!0),m(J,null,ne(n.value,l=>(r(),A(y,{key:l.path,to:l.path,class:K(["nav-item",{active:V(l.path)}]),title:p.value?l.label:""},{default:U(()=>[a("span",De,[(r(),A(oe(l.icon),{size:18}))]),p.value?j("",!0):(r(),m("span",Fe,x(l.label),1)),l.badge&&l.badge>0&&!p.value?(r(),m("span",Te,x(l.badge),1)):j("",!0)]),_:2},1032,["to","class","title"]))),128))]),p.value?j("",!0):(r(),m("div",Ne,[a("div",Oe,[a("div",Je,x(R.value),1),a("div",We,[a("span",Ge,x(((v=o(s).user)==null?void 0:v.name)||((f=o(s).user)==null?void 0:f.username)),1),a("span",Ke,x(b.value),1)])])]))],2),!p.value&&w.value?(r(),m("div",{key:0,class:"sidebar-overlay",onClick:h[1]||(h[1]=(...l)=>o(I)&&o(I)(...l))})):j("",!0)],64)}}},Ye=G(Qe,[["__scopeId","data-v-d3eaf1ee"]]),Xe={class:"navbar"},Ze={class:"navbar-left"},ea={class:"navbar-title"},aa={class:"navbar-right"},ta={key:0,class:"biz-name"},sa=["src"],na=["title"],oa={class:"user-avatar"},ra={class:"user-name"},la={class:"modal",style:{"max-width":"400px"}},ia={class:"modal-body"},ca={class:"form-group"},ua={class:"form-group"},da={class:"form-group"},pa={key:0,class:"field-error"},va={class:"modal-footer"},ha=["disabled"],ya={__name:"NavBar",props:{title:{type:String,default:"facJp"}},setup(z){const s=H(),u=Z(),d=re(),{toggleMenu:c}=ee(),_=g(!1),I=g(null),p=g(!1),w=g(!1),M=g(""),n=g({current:"",newPass:"",confirm:""});function b(){p.value=!1,M.value="",n.value={current:"",newPass:"",confirm:""}}async function R(){var t,e;if(M.value="",!n.value.current||!n.value.newPass){M.value="Completa todos los campos";return}if(n.value.newPass!==n.value.confirm){M.value="Las contraseñas no coinciden";return}if(n.value.newPass.length<6){M.value="La contraseña debe tener al menos 6 caracteres";return}w.value=!0;try{await(await ce(async()=>{const{default:f}=await import("./index-CWdGrTZD.js").then(l=>l.U);return{default:f}},__vite__mapDeps([0,1]))).default.post("/api/auth/change-password",{currentPassword:n.value.current,newPassword:n.value.newPass}),b(),alert("Contraseña cambiada correctamente")}catch(v){M.value=((e=(t=v.response)==null?void 0:t.data)==null?void 0:e.error)||"Error al cambiar la contraseña"}finally{w.value=!1}}const V=g(document.documentElement.classList.contains("dark"));function P(){V.value=!V.value,document.documentElement.classList.toggle("dark",V.value),localStorage.setItem("facjp_dark",V.value?"1":"0")}O(()=>{localStorage.getItem("facjp_dark")==="1"&&(V.value=!0,document.documentElement.classList.add("dark"))});const $=L(()=>{var e,v;return(((e=s.user)==null?void 0:e.name)||((v=s.user)==null?void 0:v.username)||"U").charAt(0).toUpperCase()});function h(){s.logout(),d.push("/login")}function y(t){I.value&&!I.value.contains(t.target)&&(_.value=!1)}return O(()=>document.addEventListener("click",y)),Y(()=>document.removeEventListener("click",y)),(t,e)=>{var f,l,E;const v=X("router-link");return r(),m(J,null,[a("header",Xe,[a("div",Ze,[a("button",{class:"menu-toggle",onClick:e[0]||(e[0]=(...S)=>o(c)&&o(c)(...S)),"aria-label":"Menú"},[C(o($e),{size:20})]),a("h2",ea,x(z.title),1)]),a("div",aa,[o(s).currentBusiness?(r(),m("span",ta,[(f=o(u).profile)!=null&&f.logo?(r(),m("img",{key:0,src:o(u).profile.logo,class:"biz-logo",alt:"logo"},null,8,sa)):(r(),A(o(Ie),{key:1,size:14,class:"biz-icon"})),B(" "+x(o(s).currentBusiness.name),1)])):j("",!0),a("button",{class:"icon-btn",onClick:P,title:V.value?"Modo claro":"Modo oscuro"},[V.value?(r(),A(o(Ve),{key:0,size:17})):(r(),A(o(Ce),{key:1,size:17}))],8,na),a("div",{class:"user-menu",onClick:e[6]||(e[6]=D(S=>_.value=!_.value,["stop"])),ref_key:"menuRef",ref:I},[a("div",oa,x($.value),1),a("span",ra,x(((l=o(s).user)==null?void 0:l.name)||((E=o(s).user)==null?void 0:E.username)),1),C(o(me),{size:12,class:"arrow"}),C(le,{name:"fade"},{default:U(()=>[_.value?(r(),m("div",{key:0,class:"dropdown-menu",onClick:e[5]||(e[5]=D(()=>{},["stop"]))},[o(s).isAdmin?(r(),A(v,{key:0,to:"/admin/setup",class:"dropdown-item",onClick:e[1]||(e[1]=S=>_.value=!1)},{default:U(()=>[C(o(te),{size:15}),e[10]||(e[10]=B(" Configuración ",-1))]),_:1})):j("",!0),o(s).isSuperAdmin?(r(),A(v,{key:1,to:"/admin/franchises",class:"dropdown-item",onClick:e[2]||(e[2]=S=>_.value=!1)},{default:U(()=>[C(o(ae),{size:15}),e[11]||(e[11]=B(" Franquicias ",-1))]),_:1})):j("",!0),o(s).businesses.length>1?(r(),A(v,{key:2,to:"/select-business",class:"dropdown-item",onClick:e[3]||(e[3]=S=>_.value=!1)},{default:U(()=>[C(o(pe),{size:15}),e[12]||(e[12]=B(" Cambiar negocio ",-1))]),_:1})):j("",!0),a("button",{class:"dropdown-item",onClick:e[4]||(e[4]=S=>{p.value=!0,_.value=!1})},[C(o(_e),{size:15}),e[13]||(e[13]=B(" Cambiar contraseña ",-1))]),e[15]||(e[15]=a("div",{class:"dropdown-divider"},null,-1)),a("button",{class:"dropdown-item danger",onClick:h},[C(o(Me),{size:15}),e[14]||(e[14]=B(" Cerrar sesión ",-1))])])):j("",!0)]),_:1})],512)])]),(r(),A(ie,{to:"body"},[p.value?(r(),m("div",{key:0,class:"modal-overlay",onClick:D(b,["self"])},[a("div",la,[a("div",{class:"modal-header"},[e[16]||(e[16]=a("h3",{class:"modal-title"},"Cambiar contraseña",-1)),a("button",{class:"btn-close",onClick:b},"×")]),a("div",ia,[a("div",ca,[e[17]||(e[17]=a("label",{class:"form-label"},"Contraseña actual",-1)),F(a("input",{"onUpdate:modelValue":e[7]||(e[7]=S=>n.value.current=S),type:"password",class:"form-control"},null,512),[[T,n.value.current]])]),a("div",ua,[e[18]||(e[18]=a("label",{class:"form-label"},"Nueva contraseña",-1)),F(a("input",{"onUpdate:modelValue":e[8]||(e[8]=S=>n.value.newPass=S),type:"password",class:"form-control"},null,512),[[T,n.value.newPass]])]),a("div",da,[e[19]||(e[19]=a("label",{class:"form-label"},"Confirmar nueva contraseña",-1)),F(a("input",{"onUpdate:modelValue":e[9]||(e[9]=S=>n.value.confirm=S),type:"password",class:"form-control"},null,512),[[T,n.value.confirm]])]),M.value?(r(),m("p",pa,x(M.value),1)):j("",!0)]),a("div",va,[a("button",{class:"btn btn-outline",onClick:b},"Cancelar"),a("button",{class:"btn btn-primary",onClick:R,disabled:w.value},x(w.value?"Guardando...":"Guardar"),9,ha)])])])):j("",!0)]))],64)}}},ma=G(ya,[["__scopeId","data-v-d47873fe"]]),fa={class:"app-footer"},ka={class:"footer-brand"},ba={class:"footer-logo"},ga={class:"footer-copy"},_a={__name:"AppFooter",setup(z){const s=new Date().getFullYear();return(u,d)=>(r(),m("footer",fa,[a("div",ka,[a("div",ba,[C(o(W),{size:12})]),d[0]||(d[0]=a("span",{class:"footer-name"},"facJp",-1)),d[1]||(d[1]=a("span",{class:"footer-sep"},"·",-1)),d[2]||(d[2]=a("span",{class:"footer-tagline"},"Gestión para bares y restaurantes",-1))]),a("div",ga," © "+x(o(s))+" · Todos los derechos reservados ",1)]))}},wa=G(_a,[["__scopeId","data-v-734b035f"]]),Ma={class:"app-layout"},$a={class:"main-content"},Ca={class:"content-area"},ja={__name:"PageLayout",props:{title:{type:String,default:"facJp"}},setup(z){return(s,u)=>(r(),m("div",Ma,[C(Ye),a("div",$a,[C(ma,{title:z.title},null,8,["title"]),a("div",Ca,[ue(s.$slots,"default")]),C(wa)])]))}};export{ye as C,Me as L,xe as P,Se as R,Pe as W,ja as _,Z as a,be as b,de as u};
