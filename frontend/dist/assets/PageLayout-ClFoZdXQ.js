const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-ClbwFZ4l.js","assets/index-CVZBez9y.css"])))=>i.map(i=>d[i]);
import{P as Z,u as U,r as k,l as z,y,E as W,h as le,R as ie,m as G,M as te,z as se,o as d,c as M,b as o,j as c,n as V,A as X,t as S,e as L,F as J,k as ce,p as H,s as ee,i as ue,q as R,d as E,w as N,T as de,f as O,v as T,Q as pe,_ as ye,S as he}from"./index-ClbwFZ4l.js";import{c as u,S as F}from"./store-dVgnpWNK.js";import{_ as Y}from"./_plugin-vue_export-helper-DlAUqK2U.js";const ve=Z("inventory",()=>{const v=U(),t=k([]),p=k([]),h=k(!1);function i(){var e;return(e=v.currentBusiness)==null?void 0:e.id}const f=z(()=>t.value.filter(e=>!e.noStock&&e.stock<=(e.minStock||0))),b=z(()=>[...new Set(t.value.map(e=>e.category).filter(Boolean))]),x=z(()=>[...new Set(p.value.map(e=>e.category).filter(Boolean))]);async function n(){if(i()){h.value=!0;try{const e=await y.get(`/api/${i()}/inventory`);t.value=e.data}finally{h.value=!1}}}async function m(){if(!i())return;const e=await y.get(`/api/${i()}/recipes`);p.value=e.data}async function r(e){const a=await y.post(`/api/${i()}/inventory`,e);return t.value.push(a.data),a.data}async function l(e,a){const s=await y.put(`/api/${i()}/inventory/${e}`,a),g=t.value.findIndex(j=>j.id===e);return g!==-1&&(t.value[g]=s.data),s.data}async function C(e){await y.delete(`/api/${i()}/inventory/${e}`),t.value=t.value.filter(a=>a.id!==e)}async function _(e,a,s){const g=await y.patch(`/api/${i()}/inventory/${e}/adjust`,{adjustment:a,reason:s}),j=t.value.findIndex(w=>w.id===e);return j!==-1&&(t.value[j]=g.data),g.data}async function B(e){const a=await y.post(`/api/${i()}/inventory/count`,{items:e});return Array.isArray(a.data.inventory)&&(t.value=a.data.inventory),a.data}async function P(){const e=await y.post(`/api/${i()}/inventory/min-stock-zero`);return await n(),e.data}async function q(e){const a=await y.post(`/api/${i()}/recipes`,e);return p.value.push(a.data),a.data}async function A(e,a){const s=await y.put(`/api/${i()}/recipes/${e}`,a),g=p.value.findIndex(j=>j.id===e);return g!==-1&&(p.value[g]=s.data),s.data}async function $(e){await y.delete(`/api/${i()}/recipes/${e}`),p.value=p.value.filter(a=>a.id!==e)}return{items:t,recipes:p,loading:h,lowStockItems:f,categories:b,recipeCategories:x,fetchInventory:n,fetchRecipes:m,createItem:r,updateItem:l,deleteItem:C,adjustStock:_,countInventory:B,zeroMinStock:P,createRecipe:q,updateRecipe:A,deleteRecipe:$}}),fe=Z("payroll",()=>{const v=U(),t=k([]),p=k([]),h=k({dia:5e4,medio:25e3,hora:6250}),i=k({}),f=k([]),b=k(!1),x=z(()=>t.value.filter(a=>a.status==="pendiente").length);function n(){var a;return(a=v.currentBusiness)==null?void 0:a.id}async function m(a={}){if(n()){b.value=!0;try{const s=await y.get(`/api/${n()}/payroll`,{params:a});t.value=s.data.entries||[],p.value=s.data.payments||[],s.data.rates&&(h.value=s.data.rates),i.value=s.data.employeeRates||{}}finally{b.value=!1}}}async function r(){if(n())try{const a=await y.get(`/api/${n()}/users`);f.value=a.data||[]}catch{f.value=[]}}function l(a){return i.value[a]||h.value}async function C(a){const s=await y.put(`/api/${n()}/payroll/employee-rate`,a);return i.value=s.data||{},s.data}async function _(){if(!n())return;const a=await y.get(`/api/${n()}/payroll/rates`);h.value=a.data}async function B(a){const s=await y.put(`/api/${n()}/payroll/rates`,a);return h.value=s.data,s.data}async function P(a){return(await y.post(`/api/${n()}/payroll`,a)).data}async function q(a,s){return(await y.put(`/api/${n()}/payroll/${a}`,s)).data}async function A(a){await y.delete(`/api/${n()}/payroll/${a}`)}async function $(a){return(await y.post(`/api/${n()}/payroll/approve`,{ids:a})).data}async function e(a){return(await y.post(`/api/${n()}/payroll/pay`,a)).data}return{entries:t,payments:p,rates:h,employeeRates:i,users:f,loading:b,pendingCount:x,fetch:m,fetchRates:_,saveRates:B,fetchUsers:r,ratesFor:l,saveEmployeeRate:C,createEntry:P,updateEntry:q,deleteEntry:A,approve:$,pay:e}}),K=Z("business",()=>{const v=U(),t=k(null),p=k(!1),h=z(()=>{var l;return((l=t.value)==null?void 0:l.usesRecipes)!==!1});W(()=>{var l;return(l=v.currentBusiness)==null?void 0:l.id},l=>{t.value=null,l&&f()},{immediate:!0});function i(){var l;return`/api/${(l=v.currentBusiness)==null?void 0:l.id}`}async function f(){p.value=!0;try{const l=await y.get(`${i()}/profile`);t.value=l.data}finally{p.value=!1}}async function b(l){const C=await y.put(`${i()}/profile`,l);return t.value=C.data,C.data}async function x(){return(await y.get(`${i()}/users`)).data}async function n(l){return(await y.post(`${i()}/users`,l)).data}async function m(l,C){return(await y.put(`${i()}/users/${l}`,C)).data}async function r(l){return(await y.delete(`${i()}/users/${l}`)).data}return{profile:t,loading:p,usesRecipes:h,fetchProfile:f,updateProfile:b,fetchUsers:x,createUser:n,updateUser:m,deleteUser:r}}),D=k(!1);function ne(){function v(){D.value=!D.value}function t(){D.value=!1}return{isMenuOpen:D,toggleMenu:v,closeMenu:t}}/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const me=u("arrow-left-right",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=u("beer",[["path",{d:"M17 11h1a3 3 0 0 1 0 6h-1",key:"1yp76v"}],["path",{d:"M9 12v6",key:"1u1cab"}],["path",{d:"M13 12v6",key:"1sugkk"}],["path",{d:"M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z",key:"1510fo"}],["path",{d:"M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8",key:"19jb7n"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=u("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=u("briefcase",[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oe=u("building-2",[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=u("calendar-clock",[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Me=u("chart-column",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=u("chevron-down",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $e=u("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xe=u("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=u("clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ze=u("coffee",[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=u("croissant",[["path",{d:"M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487",key:"14kkz9"}],["path",{d:"M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132",key:"1g7v07"}],["path",{d:"M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42",key:"ratg6b"}],["path",{d:"M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14",key:"4454f0"}],["path",{d:"M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676",key:"qmemie"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=u("crosshair",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"22",x2:"18",y1:"12",y2:"12",key:"l9bcsi"}],["line",{x1:"6",x2:"2",y1:"12",y2:"12",key:"13hhkx"}],["line",{x1:"12",x2:"12",y1:"6",y2:"2",key:"10w3f3"}],["line",{x1:"12",x2:"12",y1:"22",y2:"18",key:"15g9kq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=u("dumbbell",[["path",{d:"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",key:"9m4mmf"}],["path",{d:"m2.5 21.5 1.4-1.4",key:"17g3f0"}],["path",{d:"m20.1 3.9 1.4-1.4",key:"1qn309"}],["path",{d:"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",key:"1t2c92"}],["path",{d:"m9.6 14.4 4.8-4.8",key:"6umqxw"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Re=u("history",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ve=u("hotel",[["path",{d:"M10 22v-6.57",key:"1wmca3"}],["path",{d:"M12 11h.01",key:"z322tv"}],["path",{d:"M12 7h.01",key:"1ivr5q"}],["path",{d:"M14 15.43V22",key:"1q2vjd"}],["path",{d:"M15 16a5 5 0 0 0-6 0",key:"o9wqvi"}],["path",{d:"M16 11h.01",key:"xkw8gn"}],["path",{d:"M16 7h.01",key:"1kdx03"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 7h.01",key:"1vti4s"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Le=u("key-round",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=u("layout-dashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Be=u("log-out",[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pe=u("menu",[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qe=u("moon",[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ee=u("package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const He=u("piggy-bank",[["path",{d:"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z",key:"1piglc"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M2 8v1a2 2 0 0 0 2 2h1",key:"1env43"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=u("receipt",[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const re=u("settings",[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const De=u("shopping-cart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fe=u("sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ne=u("truck",[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oe=u("utensils",[["path",{d:"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",key:"cjf0a3"}],["path",{d:"M7 2v20",key:"1473qp"}],["path",{d:"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",key:"j28e5"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=u("wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const We=u("wine",[["path",{d:"M8 22h8",key:"rmew8v"}],["path",{d:"M7 10h10",key:"1101jm"}],["path",{d:"M12 15v7",key:"t2xh3l"}],["path",{d:"M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z",key:"10ffi3"}]]),ae=[{key:"store",label:"Tienda",icon:F},{key:"utensils",label:"Restaurante",icon:Oe},{key:"beer",label:"Bar",icon:ke},{key:"wine",label:"Licorería",icon:We},{key:"coffee",label:"Café",icon:ze},{key:"crosshair",label:"Campo de tiro",icon:je},{key:"croissant",label:"Panadería",icon:Se},{key:"dumbbell",label:"Gimnasio",icon:Ie},{key:"hotel",label:"Hotel",icon:Ve},{key:"briefcase",label:"Otro negocio",icon:ge}],Oa="store";function Ge(v){return(ae.find(t=>t.key===v)||ae[0]).icon}function Je(){const v=K(),t=z(()=>{var n;return((n=v.profile)==null?void 0:n.spaceLabel)||"Mesa"}),p=z(()=>{var n;return((n=v.profile)==null?void 0:n.spaceLabelPlural)||t.value+"s"}),h=z(()=>{var n;return!!((n=v.profile)!=null&&n.multiOrders)}),i=z(()=>{var n;return((n=v.profile)==null?void 0:n.recipesLabel)||"Recetas"}),f=n=>{var m,r;return((r=(m=v.profile)==null?void 0:m.modules)==null?void 0:r[n])!==!1},b=n=>String((n==null?void 0:n.name)||(n==null?void 0:n.number)||"");return le({label:t,plural:p,multi:h,recipesLabel:i,has:f,shortName:b,nameOf:n=>`${t.value} ${b(n)}`.trim()})}const Ze={class:"sidebar-header"},Ye={class:"sidebar-logo"},Ke=["src"],Qe={key:1,class:"logo-icon-wrap"},Xe={key:2,class:"logo-text"},ea=["title"],aa={class:"sidebar-nav"},ta={class:"nav-icon"},sa={key:0,class:"nav-label"},na={key:1,class:"nav-badge"},oa={key:0,class:"sidebar-footer"},ra={class:"user-pill"},la={class:"user-avatar-sm"},ia={class:"user-info"},ca={class:"user-name-sm"},ua={class:"user-role-sm"},da={__name:"SideMenu",setup(v){const t=U(),p=K(),h=Je(),i=z(()=>{var e;return Ge((e=p.profile)==null?void 0:e.icon)}),f=ve(),b=fe(),x=ie(),{isMenuOpen:n,closeMenu:m}=ne(),r=k(!1),l=k(!1),C=[{path:"/dashboard",label:"Dashboard",icon:Ae,roles:["superadmin","admin","cajero"]},{path:"/tables",label:"Registrar Venta",icon:F,roles:["superadmin","admin","cajero"]},{path:"/inventory",label:"Inventario",icon:Ee,roles:["superadmin","admin","cajero"]},{path:"/recipes",label:"Recetas / Menú",icon:be,roles:["superadmin","admin"]},{path:"/purchases",label:"Salidas",icon:De,roles:["superadmin","admin"]},{path:"/suppliers",label:"Directorio de pagos",icon:Ne,roles:["superadmin","admin"]},{path:"/reports",label:"Reportes",icon:Me,roles:["superadmin","admin"]},{path:"/finance",label:"Finanzas",icon:He,roles:["superadmin","admin"]},{path:"/payroll",label:"Nómina",icon:we,roles:["superadmin","admin","cajero"]},{path:"/shifts",label:"Turnos de Caja",icon:Ce,roles:["superadmin","admin","cajero"]},{path:"/debtors",label:"Deudas",icon:Te,roles:["superadmin","admin","cajero"]},{path:"/invoices",label:"Facturas",icon:Ue,roles:["superadmin","admin","cajero"]},{path:"/audit",label:"Bitácora",icon:Re,roles:["superadmin","admin"]},{path:"/admin/setup",label:"Configuración",icon:re,roles:["superadmin","admin"]},{path:"/admin/franchises",label:"Franquicias",icon:oe,roles:["superadmin"]}],_={"/debtors":"debtors","/payroll":"payroll","/finance":"finance","/reports":"reports","/audit":"audit"},B=z(()=>{var a;const e=(a=t.user)==null?void 0:a.role;return C.filter(s=>s.roles.includes(e)).filter(s=>s.path!=="/recipes"||p.usesRecipes).filter(s=>!_[s.path]||h.has(_[s.path])).map(s=>({...s,label:s.path==="/recipes"&&h.recipesLabel!=="Recetas"?h.recipesLabel:s.label,badge:s.path==="/inventory"?f.lowStockItems.length:s.path==="/payroll"&&t.isAdmin?b.pendingCount:0}))}),P=z(()=>{var a,s;return{superadmin:"Super Admin",admin:"Administrador",cajero:"Cajero"}[(a=t.user)==null?void 0:a.role]||((s=t.user)==null?void 0:s.role)}),q=z(()=>{var a,s;return(((a=t.user)==null?void 0:a.name)||((s=t.user)==null?void 0:s.username)||"U").charAt(0).toUpperCase()});function A(e){return x.path===e||x.path.startsWith(e+"/")}function $(){l.value=window.innerWidth<768,r.value=l.value}return W(n,e=>{l.value&&(r.value=!e)}),W(()=>x.path,()=>{l.value&&m()}),G(()=>{$(),window.addEventListener("resize",$),t.isAdmin&&b.fetch().catch(()=>{})}),te(()=>window.removeEventListener("resize",$)),(e,a)=>{var g,j,w,Q;const s=se("router-link");return d(),M(J,null,[o("aside",{class:ee(["sidebar",{collapsed:r.value}])},[o("div",Ze,[o("div",Ye,[(g=c(p).profile)!=null&&g.logo?(d(),M("img",{key:0,src:c(p).profile.logo,class:"logo-img",alt:"logo"},null,8,Ke)):(d(),M("div",Qe,[(d(),V(X(i.value),{size:20,color:"#1a0a00"}))])),r.value?L("",!0):(d(),M("span",Xe,S(((j=c(p).profile)==null?void 0:j.name)||"facJp"),1))]),o("button",{class:"collapse-btn",onClick:a[0]||(a[0]=I=>r.value=!r.value),title:r.value?"Expandir":"Colapsar"},[r.value?(d(),V(c(xe),{key:1,size:16})):(d(),V(c($e),{key:0,size:16}))],8,ea)]),o("nav",aa,[(d(!0),M(J,null,ce(B.value,I=>(d(),V(s,{key:I.path,to:I.path,class:ee(["nav-item",{active:A(I.path)}]),title:r.value?I.label:""},{default:H(()=>[o("span",ta,[(d(),V(X(I.icon),{size:18}))]),r.value?L("",!0):(d(),M("span",sa,S(I.label),1)),I.badge&&I.badge>0&&!r.value?(d(),M("span",na,S(I.badge),1)):L("",!0)]),_:2},1032,["to","class","title"]))),128))]),r.value?L("",!0):(d(),M("div",oa,[o("div",ra,[o("div",la,S(q.value),1),o("div",ia,[o("span",ca,S(((w=c(t).user)==null?void 0:w.name)||((Q=c(t).user)==null?void 0:Q.username)),1),o("span",ua,S(P.value),1)])])]))],2),!r.value&&l.value?(d(),M("div",{key:0,class:"sidebar-overlay",onClick:a[1]||(a[1]=(...I)=>c(m)&&c(m)(...I))})):L("",!0)],64)}}},pa=Y(da,[["__scopeId","data-v-85630897"]]),ya={class:"navbar"},ha={class:"navbar-left"},va={class:"navbar-title"},fa={class:"navbar-right"},ma={key:0,class:"biz-name"},ka=["src"],ba=["title"],ga={class:"user-avatar"},wa={class:"user-name"},Ma={class:"modal",style:{"max-width":"400px"}},_a={class:"modal-body"},$a={class:"form-group"},xa={class:"form-group"},Ca={class:"form-group"},za={key:0,class:"field-error"},Sa={class:"modal-footer"},ja=["disabled"],Ia={__name:"NavBar",props:{title:{type:String,default:"facJp"}},setup(v){const t=U(),p=K(),h=ue(),{toggleMenu:i}=ne(),f=k(!1),b=k(null),x=k(!1),n=k(!1),m=k(""),r=k({current:"",newPass:"",confirm:""});function l(){x.value=!1,m.value="",r.value={current:"",newPass:"",confirm:""}}async function C(){var $,e;if(m.value="",!r.value.current||!r.value.newPass){m.value="Completa todos los campos";return}if(r.value.newPass!==r.value.confirm){m.value="Las contraseñas no coinciden";return}if(r.value.newPass.length<6){m.value="La contraseña debe tener al menos 6 caracteres";return}n.value=!0;try{await(await ye(async()=>{const{default:s}=await import("./index-ClbwFZ4l.js").then(g=>g.U);return{default:s}},__vite__mapDeps([0,1]))).default.post("/api/auth/change-password",{currentPassword:r.value.current,newPassword:r.value.newPass}),l(),alert("Contraseña cambiada correctamente")}catch(a){m.value=((e=($=a.response)==null?void 0:$.data)==null?void 0:e.error)||"Error al cambiar la contraseña"}finally{n.value=!1}}const _=k(document.documentElement.classList.contains("dark"));function B(){_.value=!_.value,document.documentElement.classList.toggle("dark",_.value),localStorage.setItem("facjp_dark",_.value?"1":"0")}G(()=>{localStorage.getItem("facjp_dark")==="1"&&(_.value=!0,document.documentElement.classList.add("dark"))});const P=z(()=>{var e,a;return(((e=t.user)==null?void 0:e.name)||((a=t.user)==null?void 0:a.username)||"U").charAt(0).toUpperCase()});function q(){t.logout(),h.push("/login")}function A($){b.value&&!b.value.contains($.target)&&(f.value=!1)}return G(()=>document.addEventListener("click",A)),te(()=>document.removeEventListener("click",A)),($,e)=>{var s,g,j;const a=se("router-link");return d(),M(J,null,[o("header",ya,[o("div",ha,[o("button",{class:"menu-toggle",onClick:e[0]||(e[0]=(...w)=>c(i)&&c(i)(...w)),"aria-label":"Menú"},[R(c(Pe),{size:20})]),o("h2",va,S(v.title),1)]),o("div",fa,[c(t).currentBusiness?(d(),M("span",ma,[(s=c(p).profile)!=null&&s.logo?(d(),M("img",{key:0,src:c(p).profile.logo,class:"biz-logo",alt:"logo"},null,8,ka)):(d(),V(c(F),{key:1,size:14,class:"biz-icon"})),E(" "+S(c(t).currentBusiness.name),1)])):L("",!0),o("button",{class:"icon-btn",onClick:B,title:_.value?"Modo claro":"Modo oscuro"},[_.value?(d(),V(c(Fe),{key:0,size:17})):(d(),V(c(qe),{key:1,size:17}))],8,ba),o("div",{class:"user-menu",onClick:e[6]||(e[6]=N(w=>f.value=!f.value,["stop"])),ref_key:"menuRef",ref:b},[o("div",ga,S(P.value),1),o("span",wa,S(((g=c(t).user)==null?void 0:g.name)||((j=c(t).user)==null?void 0:j.username)),1),R(c(_e),{size:12,class:"arrow"}),R(de,{name:"fade"},{default:H(()=>[f.value?(d(),M("div",{key:0,class:"dropdown-menu",onClick:e[5]||(e[5]=N(()=>{},["stop"]))},[c(t).isAdmin?(d(),V(a,{key:0,to:"/admin/setup",class:"dropdown-item",onClick:e[1]||(e[1]=w=>f.value=!1)},{default:H(()=>[R(c(re),{size:15}),e[10]||(e[10]=E(" Configuración ",-1))]),_:1})):L("",!0),c(t).isSuperAdmin?(d(),V(a,{key:1,to:"/admin/franchises",class:"dropdown-item",onClick:e[2]||(e[2]=w=>f.value=!1)},{default:H(()=>[R(c(oe),{size:15}),e[11]||(e[11]=E(" Franquicias ",-1))]),_:1})):L("",!0),c(t).businesses.length>1?(d(),V(a,{key:2,to:"/select-business",class:"dropdown-item",onClick:e[3]||(e[3]=w=>f.value=!1)},{default:H(()=>[R(c(me),{size:15}),e[12]||(e[12]=E(" Cambiar negocio ",-1))]),_:1})):L("",!0),o("button",{class:"dropdown-item",onClick:e[4]||(e[4]=w=>{x.value=!0,f.value=!1})},[R(c(Le),{size:15}),e[13]||(e[13]=E(" Cambiar contraseña ",-1))]),e[15]||(e[15]=o("div",{class:"dropdown-divider"},null,-1)),o("button",{class:"dropdown-item danger",onClick:q},[R(c(Be),{size:15}),e[14]||(e[14]=E(" Cerrar sesión ",-1))])])):L("",!0)]),_:1})],512)])]),(d(),V(pe,{to:"body"},[x.value?(d(),M("div",{key:0,class:"modal-overlay",onClick:N(l,["self"])},[o("div",Ma,[o("div",{class:"modal-header"},[e[16]||(e[16]=o("h3",{class:"modal-title"},"Cambiar contraseña",-1)),o("button",{class:"btn-close",onClick:l},"×")]),o("div",_a,[o("div",$a,[e[17]||(e[17]=o("label",{class:"form-label"},"Contraseña actual",-1)),O(o("input",{"onUpdate:modelValue":e[7]||(e[7]=w=>r.value.current=w),type:"password",class:"form-control"},null,512),[[T,r.value.current]])]),o("div",xa,[e[18]||(e[18]=o("label",{class:"form-label"},"Nueva contraseña",-1)),O(o("input",{"onUpdate:modelValue":e[8]||(e[8]=w=>r.value.newPass=w),type:"password",class:"form-control"},null,512),[[T,r.value.newPass]])]),o("div",Ca,[e[19]||(e[19]=o("label",{class:"form-label"},"Confirmar nueva contraseña",-1)),O(o("input",{"onUpdate:modelValue":e[9]||(e[9]=w=>r.value.confirm=w),type:"password",class:"form-control"},null,512),[[T,r.value.confirm]])]),m.value?(d(),M("p",za,S(m.value),1)):L("",!0)]),o("div",Sa,[o("button",{class:"btn btn-outline",onClick:l},"Cancelar"),o("button",{class:"btn btn-primary",onClick:C,disabled:n.value},S(n.value?"Guardando...":"Guardar"),9,ja)])])])):L("",!0)]))],64)}}},Ra=Y(Ia,[["__scopeId","data-v-d47873fe"]]),Va={class:"app-footer"},La={class:"footer-brand"},Aa={class:"footer-logo"},Ba={class:"footer-copy"},Pa={__name:"AppFooter",setup(v){const t=new Date().getFullYear();return(p,h)=>(d(),M("footer",Va,[o("div",La,[o("div",Aa,[R(c(F),{size:12})]),h[0]||(h[0]=o("span",{class:"footer-name"},"facJp",-1)),h[1]||(h[1]=o("span",{class:"footer-sep"},"·",-1)),h[2]||(h[2]=o("span",{class:"footer-tagline"},"Gestión para bares y restaurantes",-1))]),o("div",Ba," © "+S(c(t))+" · Todos los derechos reservados ",1)]))}},qa=Y(Pa,[["__scopeId","data-v-1b2193c1"]]),Ea={class:"app-layout"},Ha={class:"main-content"},Ua={class:"content-area"},Ta={__name:"PageLayout",props:{title:{type:String,default:"facJp"}},setup(v){return(t,p)=>(d(),M("div",Ea,[R(pa),o("div",Ha,[R(Ra,{title:v.title},null,8,["title"]),o("div",Ua,[he(t.$slots,"default")]),R(qa)])]))}};export{ae as B,Me as C,Oa as D,Be as L,Ee as P,Ue as R,Te as W,Ta as _,ve as a,K as b,Ge as c,fe as d,Ce as e,Je as u};
