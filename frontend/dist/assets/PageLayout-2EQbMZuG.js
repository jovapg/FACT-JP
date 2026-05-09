import{P as O,u as q,r as x,x as L,C as y,B as E,R as Z,l as H,L as J,y as W,o as r,c as m,b as n,j as a,p as w,e as j,m as S,F as P,k as ee,n as V,z as te,t as I,q as N,i as ae,d as R,w as T,T as se,S as ne}from"./index--TTwQ58H.js";import{_ as F}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{c as h,U as D}from"./utensils-crossed-bjBw8bh_.js";const oe=O("inventory",()=>{const _=q(),t=x([]),d=x([]),c=x(!1);function u(){var e;return(e=_.currentBusiness)==null?void 0:e.id}const k=L(()=>t.value.filter(e=>e.stock<=(e.minStock||0))),M=L(()=>[...new Set(t.value.map(e=>e.category).filter(Boolean))]),o=L(()=>[...new Set(d.value.map(e=>e.category).filter(Boolean))]);async function $(){if(u()){c.value=!0;try{const e=await y.get(`/api/${u()}/inventory`);t.value=e.data}finally{c.value=!1}}}async function B(){if(!u())return;const e=await y.get(`/api/${u()}/recipes`);d.value=e.data}async function i(e){const l=await y.post(`/api/${u()}/inventory`,e);return t.value.push(l.data),l.data}async function g(e,l){const z=await y.put(`/api/${u()}/inventory/${e}`,l),C=t.value.findIndex(p=>p.id===e);return C!==-1&&(t.value[C]=z.data),z.data}async function A(e){await y.delete(`/api/${u()}/inventory/${e}`),t.value=t.value.filter(l=>l.id!==e)}async function s(e,l,z){const C=await y.patch(`/api/${u()}/inventory/${e}/adjust`,{adjustment:l,reason:z}),p=t.value.findIndex(X=>X.id===e);return p!==-1&&(t.value[p]=C.data),C.data}async function b(e){const l=await y.post(`/api/${u()}/recipes`,e);return d.value.push(l.data),l.data}async function f(e,l){const z=await y.put(`/api/${u()}/recipes/${e}`,l),C=d.value.findIndex(p=>p.id===e);return C!==-1&&(d.value[C]=z.data),z.data}async function v(e){await y.delete(`/api/${u()}/recipes/${e}`),d.value=d.value.filter(l=>l.id!==e)}return{items:t,recipes:d,loading:c,lowStockItems:k,categories:M,recipeCategories:o,fetchInventory:$,fetchRecipes:B,createItem:i,updateItem:g,deleteItem:A,adjustStock:s,createRecipe:b,updateRecipe:f,deleteRecipe:v}}),G=O("business",()=>{const _=q(),t=x(null),d=x(!1);E(()=>{var i;return(i=_.currentBusiness)==null?void 0:i.id},i=>{t.value=null,i&&u()},{immediate:!0});function c(){var i;return`/api/${(i=_.currentBusiness)==null?void 0:i.id}`}async function u(){d.value=!0;try{const i=await y.get(`${c()}/profile`);t.value=i.data}finally{d.value=!1}}async function k(i){const g=await y.put(`${c()}/profile`,i);return t.value=g.data,g.data}async function M(){return(await y.get(`${c()}/users`)).data}async function o(i){return(await y.post(`${c()}/users`,i)).data}async function $(i,g){return(await y.put(`${c()}/users/${i}`,g)).data}async function B(i){return(await y.delete(`${c()}/users/${i}`)).data}return{profile:t,loading:d,fetchProfile:u,updateProfile:k,fetchUsers:M,createUser:o,updateUser:$,deleteUser:B}}),U=x(!1);function Y(){function _(){U.value=!U.value}function t(){U.value=!1}return{isMenuOpen:U,toggleMenu:_,closeMenu:t}}/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=h("arrow-left-right",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ie=h("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K=h("building-2",[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const le=h("chart-column",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ce=h("chevron-down",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ue=h("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const de=h("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pe=h("clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const he=h("layout-dashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ve=h("log-out",[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=h("menu",[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const me=h("moon",[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fe=h("package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=h("receipt",[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=h("settings",[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=h("shopping-cart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=h("store",[["path",{d:"M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5",key:"slp6dd"}],["path",{d:"M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",key:"o0xfot"}],["path",{d:"M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05",key:"wn3emo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=h("sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=h("truck",[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]]),Me={class:"sidebar-header"},$e={class:"sidebar-logo"},Ce=["src"],xe={key:1,class:"logo-icon-wrap"},ze={key:2,class:"logo-text"},Se=["title"],je={class:"sidebar-nav"},Ie={class:"nav-icon"},Ae={key:0,class:"nav-label"},Be={key:1,class:"nav-badge"},Le={key:0,class:"sidebar-footer"},Re={class:"user-pill"},Ve={class:"user-avatar-sm"},Ue={class:"user-info"},qe={class:"user-name-sm"},Ee={class:"user-role-sm"},He={__name:"SideMenu",setup(_){const t=q(),d=G(),c=oe(),u=Z(),{isMenuOpen:k,closeMenu:M}=Y(),o=x(!1),$=x(!1),B=[{path:"/dashboard",label:"Dashboard",icon:he,roles:["superadmin","admin","cajero"]},{path:"/tables",label:"Registrar Venta",icon:D,roles:["superadmin","admin","cajero"]},{path:"/inventory",label:"Inventario",icon:fe,roles:["superadmin","admin"]},{path:"/recipes",label:"Recetas / Menú",icon:ie,roles:["superadmin","admin"]},{path:"/purchases",label:"Compras",icon:ge,roles:["superadmin","admin"]},{path:"/suppliers",label:"Proveedores",icon:we,roles:["superadmin","admin"]},{path:"/reports",label:"Reportes",icon:le,roles:["superadmin","admin"]},{path:"/shifts",label:"Turnos de Caja",icon:pe,roles:["superadmin","admin","cajero"]},{path:"/invoices",label:"Facturas",icon:ke,roles:["superadmin","admin","cajero"]},{path:"/admin/setup",label:"Configuración",icon:Q,roles:["superadmin","admin"]},{path:"/admin/franchises",label:"Franquicias",icon:K,roles:["superadmin"]}],i=L(()=>{var v;const f=(v=t.user)==null?void 0:v.role;return B.filter(e=>e.roles.includes(f)).map(e=>({...e,badge:e.path==="/inventory"?c.lowStockItems.length:0}))}),g=L(()=>{var v,e;return{superadmin:"Super Admin",admin:"Administrador",cajero:"Cajero"}[(v=t.user)==null?void 0:v.role]||((e=t.user)==null?void 0:e.role)}),A=L(()=>{var v,e;return(((v=t.user)==null?void 0:v.name)||((e=t.user)==null?void 0:e.username)||"U").charAt(0).toUpperCase()});function s(f){return u.path===f||u.path.startsWith(f+"/")}function b(){$.value=window.innerWidth<768,o.value=$.value}return E(k,f=>{$.value&&(o.value=!f)}),E(()=>u.path,()=>{$.value&&M()}),H(()=>{b(),window.addEventListener("resize",b)}),J(()=>window.removeEventListener("resize",b)),(f,v)=>{var l,z,C;const e=W("router-link");return r(),m(P,null,[n("aside",{class:N(["sidebar",{collapsed:o.value}])},[n("div",Me,[n("div",$e,[(l=a(d).profile)!=null&&l.logo?(r(),m("img",{key:0,src:a(d).profile.logo,class:"logo-img",alt:"logo"},null,8,Ce)):(r(),m("div",xe,[w(a(D),{size:20,color:"#1a0a00"})])),o.value?j("",!0):(r(),m("span",ze,"facJp"))]),n("button",{class:"collapse-btn",onClick:v[0]||(v[0]=p=>o.value=!o.value),title:o.value?"Expandir":"Colapsar"},[o.value?(r(),S(a(de),{key:1,size:16})):(r(),S(a(ue),{key:0,size:16}))],8,Se)]),n("nav",je,[(r(!0),m(P,null,ee(i.value,p=>(r(),S(e,{key:p.path,to:p.path,class:N(["nav-item",{active:s(p.path)}]),title:o.value?p.label:""},{default:V(()=>[n("span",Ie,[(r(),S(te(p.icon),{size:18}))]),o.value?j("",!0):(r(),m("span",Ae,I(p.label),1)),p.badge&&p.badge>0&&!o.value?(r(),m("span",Be,I(p.badge),1)):j("",!0)]),_:2},1032,["to","class","title"]))),128))]),o.value?j("",!0):(r(),m("div",Le,[n("div",Re,[n("div",Ve,I(A.value),1),n("div",Ue,[n("span",qe,I(((z=a(t).user)==null?void 0:z.name)||((C=a(t).user)==null?void 0:C.username)),1),n("span",Ee,I(g.value),1)])])]))],2),!o.value&&$.value?(r(),m("div",{key:0,class:"sidebar-overlay",onClick:v[1]||(v[1]=(...p)=>a(M)&&a(M)(...p))})):j("",!0)],64)}}},De=F(He,[["__scopeId","data-v-11039888"]]),Fe={class:"navbar"},Pe={class:"navbar-left"},Ne={class:"navbar-title"},Te={class:"navbar-right"},Oe={key:0,class:"biz-name"},Je=["src"],We=["title"],Ge={class:"user-avatar"},Ye={class:"user-name"},Ke={__name:"NavBar",props:{title:{type:String,default:"facJp"}},setup(_){const t=q(),d=G(),c=ae(),{toggleMenu:u}=Y(),k=x(!1),M=x(null),o=x(document.documentElement.classList.contains("dark"));function $(){o.value=!o.value,document.documentElement.classList.toggle("dark",o.value),localStorage.setItem("facjp_dark",o.value?"1":"0")}H(()=>{localStorage.getItem("facjp_dark")==="1"&&(o.value=!0,document.documentElement.classList.add("dark"))});const B=L(()=>{var s,b;return(((s=t.user)==null?void 0:s.name)||((b=t.user)==null?void 0:b.username)||"U").charAt(0).toUpperCase()});function i(){t.logout(),c.push("/login")}function g(A){M.value&&!M.value.contains(A.target)&&(k.value=!1)}return H(()=>document.addEventListener("click",g)),J(()=>document.removeEventListener("click",g)),(A,s)=>{var f,v,e;const b=W("router-link");return r(),m("header",Fe,[n("div",Pe,[n("button",{class:"menu-toggle",onClick:s[0]||(s[0]=(...l)=>a(u)&&a(u)(...l)),"aria-label":"Menú"},[w(a(ye),{size:20})]),n("h2",Ne,I(_.title),1)]),n("div",Te,[a(t).currentBusiness?(r(),m("span",Oe,[(f=a(d).profile)!=null&&f.logo?(r(),m("img",{key:0,src:a(d).profile.logo,class:"biz-logo",alt:"logo"},null,8,Je)):(r(),S(a(_e),{key:1,size:14,class:"biz-icon"})),R(" "+I(a(t).currentBusiness.name),1)])):j("",!0),n("button",{class:"icon-btn",onClick:$,title:o.value?"Modo claro":"Modo oscuro"},[o.value?(r(),S(a(be),{key:0,size:17})):(r(),S(a(me),{key:1,size:17}))],8,We),n("div",{class:"user-menu",onClick:s[5]||(s[5]=T(l=>k.value=!k.value,["stop"])),ref_key:"menuRef",ref:M},[n("div",Ge,I(B.value),1),n("span",Ye,I(((v=a(t).user)==null?void 0:v.name)||((e=a(t).user)==null?void 0:e.username)),1),w(a(ce),{size:12,class:"arrow"}),w(se,{name:"fade"},{default:V(()=>[k.value?(r(),m("div",{key:0,class:"dropdown-menu",onClick:s[4]||(s[4]=T(()=>{},["stop"]))},[a(t).isAdmin?(r(),S(b,{key:0,to:"/admin/setup",class:"dropdown-item",onClick:s[1]||(s[1]=l=>k.value=!1)},{default:V(()=>[w(a(Q),{size:15}),s[6]||(s[6]=R(" Configuración ",-1))]),_:1})):j("",!0),a(t).isSuperAdmin?(r(),S(b,{key:1,to:"/admin/franchises",class:"dropdown-item",onClick:s[2]||(s[2]=l=>k.value=!1)},{default:V(()=>[w(a(K),{size:15}),s[7]||(s[7]=R(" Franquicias ",-1))]),_:1})):j("",!0),a(t).businesses.length>1?(r(),S(b,{key:2,to:"/select-business",class:"dropdown-item",onClick:s[3]||(s[3]=l=>k.value=!1)},{default:V(()=>[w(a(re),{size:15}),s[8]||(s[8]=R(" Cambiar negocio ",-1))]),_:1})):j("",!0),s[10]||(s[10]=n("div",{class:"dropdown-divider"},null,-1)),n("button",{class:"dropdown-item danger",onClick:i},[w(a(ve),{size:15}),s[9]||(s[9]=R(" Cerrar sesión ",-1))])])):j("",!0)]),_:1})],512)])])}}},Qe=F(Ke,[["__scopeId","data-v-8e70678e"]]),Xe={class:"app-footer"},Ze={class:"footer-brand"},et={class:"footer-logo"},tt={class:"footer-copy"},at={__name:"AppFooter",setup(_){const t=new Date().getFullYear();return(d,c)=>(r(),m("footer",Xe,[n("div",Ze,[n("div",et,[w(a(D),{size:12})]),c[0]||(c[0]=n("span",{class:"footer-name"},"facJp",-1)),c[1]||(c[1]=n("span",{class:"footer-sep"},"·",-1)),c[2]||(c[2]=n("span",{class:"footer-tagline"},"Gestión para bares y restaurantes",-1))]),n("div",tt," © "+I(a(t))+" · Todos los derechos reservados ",1)]))}},st=F(at,[["__scopeId","data-v-49160c1d"]]),nt={class:"app-layout"},ot={class:"main-content"},rt={class:"content-area"},ut={__name:"PageLayout",props:{title:{type:String,default:"facJp"}},setup(_){return(t,d)=>(r(),m("div",nt,[w(De),n("div",ot,[w(Qe,{title:_.title},null,8,["title"]),n("div",rt,[ne(t.$slots,"default")]),w(st)])]))}};export{le as C,ve as L,fe as P,ke as R,ut as _,G as a,pe as b,oe as u};
