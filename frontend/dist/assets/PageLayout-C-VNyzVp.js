const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BAyWc5b3.js","assets/index-Cj3rrX6u.css"])))=>i.map(i=>d[i]);
import{P as Z,u as U,r as b,l as S,y as v,E as W,h as ce,R as ue,m as G,M as ne,z as oe,o as p,c as x,b as n,j as c,n as R,A as ae,t as j,e as V,F as J,k as de,p as H,s as te,i as pe,q as B,d as E,w as F,T as ye,f as N,v as T,Q as he,_ as ve,S as fe}from"./index-BAyWc5b3.js";import{c as u,S as O}from"./store-_HbC9mPs.js";import{_ as Y}from"./_plugin-vue_export-helper-DlAUqK2U.js";const me=Z("inventory",()=>{const f=U(),t=b([]),y=b([]),m=b(!1);function i(){var e;return(e=f.currentBusiness)==null?void 0:e.id}const g=S(()=>t.value.filter(e=>!e.noStock&&e.stock<=(e.minStock||0))),_=S(()=>[...new Set(t.value.map(e=>e.category).filter(Boolean))]),C=S(()=>[...new Set(y.value.map(e=>e.category).filter(Boolean))]);async function s(){if(i()){m.value=!0;try{const e=await v.get(`/api/${i()}/inventory`);t.value=e.data}finally{m.value=!1}}}async function w(){if(!i())return;const e=await v.get(`/api/${i()}/recipes`);y.value=e.data}async function r(e){const a=await v.post(`/api/${i()}/inventory`,e);return t.value.push(a.data),a.data}async function l(e,a){const o=await v.put(`/api/${i()}/inventory/${e}`,a),h=t.value.findIndex(d=>d.id===e);return h!==-1&&(t.value[h]=o.data),o.data}async function M(e){await v.delete(`/api/${i()}/inventory/${e}`),t.value=t.value.filter(a=>a.id!==e)}async function k(e,a,o){const h=await v.patch(`/api/${i()}/inventory/${e}/adjust`,{adjustment:a,reason:o}),d=t.value.findIndex($=>$.id===e);return d!==-1&&(t.value[d]=h.data),h.data}async function L(e){const a=await v.post(`/api/${i()}/inventory/count`,{items:e});return Array.isArray(a.data.inventory)&&(t.value=a.data.inventory),a.data}async function A(){const e=await v.post(`/api/${i()}/inventory/min-stock-zero`);return await s(),e.data}async function P(e){const a=await v.post(`/api/${i()}/recipes`,e);return y.value.push(a.data),a.data}async function q(e,a){const o=await v.put(`/api/${i()}/recipes/${e}`,a),h=y.value.findIndex(d=>d.id===e);return h!==-1&&(y.value[h]=o.data),o.data}async function z(e){await v.delete(`/api/${i()}/recipes/${e}`),y.value=y.value.filter(a=>a.id!==e)}return{items:t,recipes:y,loading:m,lowStockItems:g,categories:_,recipeCategories:C,fetchInventory:s,fetchRecipes:w,createItem:r,updateItem:l,deleteItem:M,adjustStock:k,countInventory:L,zeroMinStock:A,createRecipe:P,updateRecipe:q,deleteRecipe:z}}),ke=Z("payroll",()=>{const f=U(),t=b([]),y=b([]),m=b({dia:5e4,medio:25e3,hora:6250}),i=b({}),g=b([]),_=b(!1),C=S(()=>t.value.filter(a=>a.status==="pendiente").length);function s(){var a;return(a=f.currentBusiness)==null?void 0:a.id}async function w(a={}){if(s()){_.value=!0;try{const o=await v.get(`/api/${s()}/payroll`,{params:a});t.value=o.data.entries||[],y.value=o.data.payments||[],o.data.rates&&(m.value=o.data.rates),i.value=o.data.employeeRates||{}}finally{_.value=!1}}}async function r(){if(s())try{const a=await v.get(`/api/${s()}/users`);g.value=a.data||[]}catch{g.value=[]}}function l(a){return i.value[a]||m.value}async function M(a){const o=await v.put(`/api/${s()}/payroll/employee-rate`,a);return i.value=o.data||{},o.data}async function k(){if(!s())return;const a=await v.get(`/api/${s()}/payroll/rates`);m.value=a.data}async function L(a){const o=await v.put(`/api/${s()}/payroll/rates`,a);return m.value=o.data,o.data}async function A(a){return(await v.post(`/api/${s()}/payroll`,a)).data}async function P(a,o){return(await v.put(`/api/${s()}/payroll/${a}`,o)).data}async function q(a){await v.delete(`/api/${s()}/payroll/${a}`)}async function z(a){return(await v.post(`/api/${s()}/payroll/approve`,{ids:a})).data}async function e(a){return(await v.post(`/api/${s()}/payroll/pay`,a)).data}return{entries:t,payments:y,rates:m,employeeRates:i,users:g,loading:_,pendingCount:C,fetch:w,fetchRates:k,saveRates:L,fetchUsers:r,ratesFor:l,saveEmployeeRate:M,createEntry:A,updateEntry:P,deleteEntry:q,approve:z,pay:e}}),K=Z("business",()=>{const f=U(),t=b(null),y=b(!1),m=S(()=>{var l;return((l=t.value)==null?void 0:l.usesRecipes)!==!1});W(()=>{var l;return(l=f.currentBusiness)==null?void 0:l.id},l=>{t.value=null,l&&g()},{immediate:!0});function i(){var l;return`/api/${(l=f.currentBusiness)==null?void 0:l.id}`}async function g(){var l,M;y.value=!0;try{const k=await v.get(`${i()}/profile`);t.value=k.data,(l=k.data)!=null&&l.name&&f.renameBusiness((M=f.currentBusiness)==null?void 0:M.id,k.data.name)}finally{y.value=!1}}async function _(l){var k,L;const M=await v.put(`${i()}/profile`,l);return t.value=M.data,(k=M.data)!=null&&k.name&&f.renameBusiness((L=f.currentBusiness)==null?void 0:L.id,M.data.name),M.data}async function C(){return(await v.get(`${i()}/users`)).data}async function s(l){return(await v.post(`${i()}/users`,l)).data}async function w(l,M){return(await v.put(`${i()}/users/${l}`,M)).data}async function r(l){return(await v.delete(`${i()}/users/${l}`)).data}return{profile:t,loading:y,usesRecipes:m,fetchProfile:g,updateProfile:_,fetchUsers:C,createUser:s,updateUser:w,deleteUser:r}}),D=b(!1);function re(){function f(){D.value=!D.value}function t(){D.value=!1}return{isMenuOpen:D,toggleMenu:f,closeMenu:t}}/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=u("arrow-left-right",[["path",{d:"M8 3 4 7l4 4",key:"9rb6wj"}],["path",{d:"M4 7h16",key:"6tx8e3"}],["path",{d:"m16 21 4-4-4-4",key:"siv7j2"}],["path",{d:"M20 17H4",key:"h6l3hr"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ge=u("beer",[["path",{d:"M17 11h1a3 3 0 0 1 0 6h-1",key:"1yp76v"}],["path",{d:"M9 12v6",key:"1u1cab"}],["path",{d:"M13 12v6",key:"1sugkk"}],["path",{d:"M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z",key:"1510fo"}],["path",{d:"M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8",key:"19jb7n"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const we=u("book-open",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Me=u("briefcase",[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const le=u("building-2",[["path",{d:"M10 12h4",key:"a56b0p"}],["path",{d:"M10 8h4",key:"1sr2af"}],["path",{d:"M14 21v-3a2 2 0 0 0-4 0v3",key:"1rgiei"}],["path",{d:"M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",key:"secmi2"}],["path",{d:"M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",key:"16ra0t"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _e=u("calendar-clock",[["path",{d:"M16 14v2.2l1.6 1",key:"fo4ql5"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $e=u("chart-column",[["path",{d:"M3 3v16a2 2 0 0 0 2 2h16",key:"c24i48"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xe=u("chevron-down",[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ce=u("chevron-left",[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Se=u("chevron-right",[["path",{d:"m9 18 6-6-6-6",key:"mthhwq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ze=u("clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 6v6l4 2",key:"mmk7yg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const je=u("coffee",[["path",{d:"M10 2v2",key:"7u0qdc"}],["path",{d:"M14 2v2",key:"6buw04"}],["path",{d:"M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",key:"pwadti"}],["path",{d:"M6 2v2",key:"colzsn"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ie=u("croissant",[["path",{d:"M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487",key:"14kkz9"}],["path",{d:"M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132",key:"1g7v07"}],["path",{d:"M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42",key:"ratg6b"}],["path",{d:"M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14",key:"4454f0"}],["path",{d:"M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676",key:"qmemie"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Be=u("crosshair",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"22",x2:"18",y1:"12",y2:"12",key:"l9bcsi"}],["line",{x1:"6",x2:"2",y1:"12",y2:"12",key:"13hhkx"}],["line",{x1:"12",x2:"12",y1:"6",y2:"2",key:"10w3f3"}],["line",{x1:"12",x2:"12",y1:"22",y2:"18",key:"15g9kq"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Re=u("dumbbell",[["path",{d:"M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",key:"9m4mmf"}],["path",{d:"m2.5 21.5 1.4-1.4",key:"17g3f0"}],["path",{d:"m20.1 3.9 1.4-1.4",key:"1qn309"}],["path",{d:"M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",key:"1t2c92"}],["path",{d:"m9.6 14.4 4.8-4.8",key:"6umqxw"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ve=u("history",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Le=u("hotel",[["path",{d:"M10 22v-6.57",key:"1wmca3"}],["path",{d:"M12 11h.01",key:"z322tv"}],["path",{d:"M12 7h.01",key:"1ivr5q"}],["path",{d:"M14 15.43V22",key:"1q2vjd"}],["path",{d:"M15 16a5 5 0 0 0-6 0",key:"o9wqvi"}],["path",{d:"M16 11h.01",key:"xkw8gn"}],["path",{d:"M16 7h.01",key:"1kdx03"}],["path",{d:"M8 11h.01",key:"1dfujw"}],["path",{d:"M8 7h.01",key:"1vti4s"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ae=u("key-round",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Pe=u("layout-dashboard",[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const qe=u("log-out",[["path",{d:"m16 17 5-5-5-5",key:"1bji2h"}],["path",{d:"M21 12H9",key:"dn1m92"}],["path",{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",key:"1uf3rs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ee=u("menu",[["path",{d:"M4 5h16",key:"1tepv9"}],["path",{d:"M4 12h16",key:"1lakjw"}],["path",{d:"M4 19h16",key:"1djgab"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const He=u("moon",[["path",{d:"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",key:"kfwtm"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ue=u("package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["polyline",{points:"3.29 7 12 12 20.71 7",key:"ousv84"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const De=u("piggy-bank",[["path",{d:"M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z",key:"1piglc"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M2 8v1a2 2 0 0 0 2 2h1",key:"1env43"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Oe=u("receipt",[["path",{d:"M12 17V7",key:"pyj7ub"}],["path",{d:"M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8",key:"1elt7d"}],["path",{d:"M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",key:"ycz6yz"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ie=u("settings",[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",key:"1i5ecw"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Fe=u("shopping-cart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ne=u("sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Te=u("truck",[["path",{d:"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2",key:"wrbu53"}],["path",{d:"M15 18H9",key:"1lyqi6"}],["path",{d:"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",key:"lysw3i"}],["circle",{cx:"17",cy:"18",r:"2",key:"332jqn"}],["circle",{cx:"7",cy:"18",r:"2",key:"19iecd"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const We=u("utensils",[["path",{d:"M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",key:"cjf0a3"}],["path",{d:"M7 2v20",key:"1473qp"}],["path",{d:"M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",key:"j28e5"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ge=u("wallet",[["path",{d:"M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",key:"18etb6"}],["path",{d:"M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",key:"xoc0q4"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Je=u("wine",[["path",{d:"M8 22h8",key:"rmew8v"}],["path",{d:"M7 10h10",key:"1101jm"}],["path",{d:"M12 15v7",key:"t2xh3l"}],["path",{d:"M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z",key:"10ffi3"}]]),se=[{key:"store",label:"Tienda",icon:O},{key:"utensils",label:"Restaurante",icon:We},{key:"beer",label:"Bar",icon:ge},{key:"wine",label:"Licorería",icon:Je},{key:"coffee",label:"Café",icon:je},{key:"crosshair",label:"Campo de tiro",icon:Be},{key:"croissant",label:"Panadería",icon:Ie},{key:"dumbbell",label:"Gimnasio",icon:Re},{key:"hotel",label:"Hotel",icon:Le},{key:"briefcase",label:"Otro negocio",icon:Me}],Wa="store";function Ze(f){return(se.find(t=>t.key===f)||se[0]).icon}function Ye(){const f=K(),t=S(()=>{var s;return((s=f.profile)==null?void 0:s.spaceLabel)||"Mesa"}),y=S(()=>{var s;return((s=f.profile)==null?void 0:s.spaceLabelPlural)||t.value+"s"}),m=S(()=>{var s;return!!((s=f.profile)!=null&&s.multiOrders)}),i=S(()=>{var s;return((s=f.profile)==null?void 0:s.recipesLabel)||"Recetas"}),g=s=>{var w,r;return((r=(w=f.profile)==null?void 0:w.modules)==null?void 0:r[s])!==!1},_=s=>String((s==null?void 0:s.name)||(s==null?void 0:s.number)||"");return ce({label:t,plural:y,multi:m,recipesLabel:i,has:g,shortName:_,nameOf:s=>`${t.value} ${_(s)}`.trim()})}const Ke={class:"sidebar-header"},Qe={class:"sidebar-logo"},Xe=["src"],ea={key:1,class:"logo-icon-wrap"},aa={key:2,class:"logo-text"},ta=["title"],sa={class:"sidebar-nav"},na={class:"nav-icon"},oa={key:0,class:"nav-label"},ra={key:1,class:"nav-badge"},la={key:0,class:"sidebar-footer"},ia={class:"user-pill"},ca={class:"user-avatar-sm"},ua={class:"user-info"},da={class:"user-name-sm"},pa={class:"user-role-sm"},ya={__name:"SideMenu",setup(f){const t=U(),y=K(),m=Ye(),i=S(()=>{var o;return Ze((o=y.profile)==null?void 0:o.icon)}),g=me(),_=ke(),C=ue(),{isMenuOpen:s,closeMenu:w}=re(),r=b(!1),l=b(!1),M=[{path:"/dashboard",label:"Dashboard",icon:Pe,roles:["superadmin","admin","cajero"]},{path:"/tables",label:"Registrar Venta",icon:O,roles:["superadmin","admin","cajero"]},{path:"/inventory",label:"Inventario",icon:Ue,roles:["superadmin","admin","cajero"]},{path:"/recipes",label:"Recetas / Menú",icon:we,roles:["superadmin","admin"]},{path:"/purchases",label:"Salidas",icon:Fe,roles:["superadmin","admin"]},{path:"/suppliers",label:"Directorio de pagos",icon:Te,roles:["superadmin","admin"]},{path:"/reports",label:"Reportes",icon:$e,roles:["superadmin","admin"]},{path:"/finance",label:"Finanzas",icon:De,roles:["superadmin","admin"]},{path:"/payroll",label:"Nómina",icon:_e,roles:["superadmin","admin","cajero"]},{path:"/shifts",label:"Turnos de Caja",icon:ze,roles:["superadmin","admin","cajero"]},{path:"/debtors",label:"Deudas",icon:Ge,roles:["superadmin","admin","cajero"]},{path:"/invoices",label:"Facturas",icon:Oe,roles:["superadmin","admin","cajero"]},{path:"/audit",label:"Bitácora",icon:Ve,roles:["superadmin","admin"]},{path:"/admin/setup",label:"Configuración",icon:ie,roles:["superadmin","admin"]},{path:"/admin/franchises",label:"Franquicias",icon:le,roles:["superadmin"]}],k={"/debtors":"debtors","/payroll":"payroll","/finance":"finance","/reports":"reports","/audit":"audit"},L=S(()=>{var h;const o=(h=t.user)==null?void 0:h.role;return M.filter(d=>d.roles.includes(o)).filter(d=>d.path!=="/recipes"||y.usesRecipes).filter(d=>!k[d.path]||m.has(k[d.path])).map(d=>({...d,label:d.path==="/recipes"&&m.recipesLabel!=="Recetas"?m.recipesLabel:d.label,badge:d.path==="/inventory"?g.lowStockItems.length:d.path==="/payroll"&&t.isAdmin?_.pendingCount:d.path==="/audit"&&t.isSuperAdmin?A.value:0}))}),A=b(0);async function P(){if(t.isSuperAdmin)try{A.value=(await v.get("/api/system-events")).data.open||0}catch{}}const q=S(()=>{var h,d;return{superadmin:"Super Admin",admin:"Administrador",cajero:"Cajero"}[(h=t.user)==null?void 0:h.role]||((d=t.user)==null?void 0:d.role)}),z=S(()=>{var h,d;return(((h=t.user)==null?void 0:h.name)||((d=t.user)==null?void 0:d.username)||"U").charAt(0).toUpperCase()});function e(o){return C.path===o||C.path.startsWith(o+"/")}function a(){l.value=window.innerWidth<768,r.value=l.value}return W(s,o=>{l.value&&(r.value=!o)}),W(()=>C.path,()=>{l.value&&w(),P()}),G(()=>{a(),window.addEventListener("resize",a),t.isAdmin&&_.fetch().catch(()=>{}),P()}),ne(()=>window.removeEventListener("resize",a)),(o,h)=>{var $,Q,X,ee;const d=oe("router-link");return p(),x(J,null,[n("aside",{class:te(["sidebar",{collapsed:r.value}])},[n("div",Ke,[n("div",Qe,[($=c(y).profile)!=null&&$.logo?(p(),x("img",{key:0,src:c(y).profile.logo,class:"logo-img",alt:"logo"},null,8,Xe)):(p(),x("div",ea,[(p(),R(ae(i.value),{size:20,color:"#1a0a00"}))])),r.value?V("",!0):(p(),x("span",aa,j(((Q=c(y).profile)==null?void 0:Q.name)||"facJp"),1))]),n("button",{class:"collapse-btn",onClick:h[0]||(h[0]=I=>r.value=!r.value),title:r.value?"Expandir":"Colapsar"},[r.value?(p(),R(c(Se),{key:1,size:16})):(p(),R(c(Ce),{key:0,size:16}))],8,ta)]),n("nav",sa,[(p(!0),x(J,null,de(L.value,I=>(p(),R(d,{key:I.path,to:I.path,class:te(["nav-item",{active:e(I.path)}]),title:r.value?I.label:""},{default:H(()=>[n("span",na,[(p(),R(ae(I.icon),{size:18}))]),r.value?V("",!0):(p(),x("span",oa,j(I.label),1)),I.badge&&I.badge>0&&!r.value?(p(),x("span",ra,j(I.badge),1)):V("",!0)]),_:2},1032,["to","class","title"]))),128))]),r.value?V("",!0):(p(),x("div",la,[n("div",ia,[n("div",ca,j(z.value),1),n("div",ua,[n("span",da,j(((X=c(t).user)==null?void 0:X.name)||((ee=c(t).user)==null?void 0:ee.username)),1),n("span",pa,j(q.value),1)])])]))],2),!r.value&&l.value?(p(),x("div",{key:0,class:"sidebar-overlay",onClick:h[1]||(h[1]=(...I)=>c(w)&&c(w)(...I))})):V("",!0)],64)}}},ha=Y(ya,[["__scopeId","data-v-0ef661c3"]]),va={class:"navbar"},fa={class:"navbar-left"},ma={class:"navbar-title"},ka={class:"navbar-right"},ba={key:0,class:"biz-name"},ga=["src"],wa=["title"],Ma={class:"user-avatar"},_a={class:"user-name"},$a={class:"modal",style:{"max-width":"400px"}},xa={class:"modal-body"},Ca={class:"form-group"},Sa={class:"form-group"},za={class:"form-group"},ja={key:0,class:"field-error"},Ia={class:"modal-footer"},Ba=["disabled"],Ra={__name:"NavBar",props:{title:{type:String,default:"facJp"}},setup(f){const t=U(),y=K(),m=pe(),{toggleMenu:i}=re(),g=b(!1),_=b(null),C=b(!1),s=b(!1),w=b(""),r=b({current:"",newPass:"",confirm:""});function l(){C.value=!1,w.value="",r.value={current:"",newPass:"",confirm:""}}async function M(){var z,e;if(w.value="",!r.value.current||!r.value.newPass){w.value="Completa todos los campos";return}if(r.value.newPass!==r.value.confirm){w.value="Las contraseñas no coinciden";return}if(r.value.newPass.length<6){w.value="La contraseña debe tener al menos 6 caracteres";return}s.value=!0;try{await(await ve(async()=>{const{default:o}=await import("./index-BAyWc5b3.js").then(h=>h.U);return{default:o}},__vite__mapDeps([0,1]))).default.post("/api/auth/change-password",{currentPassword:r.value.current,newPassword:r.value.newPass}),l(),alert("Contraseña cambiada correctamente")}catch(a){w.value=((e=(z=a.response)==null?void 0:z.data)==null?void 0:e.error)||"Error al cambiar la contraseña"}finally{s.value=!1}}const k=b(document.documentElement.classList.contains("dark"));function L(){k.value=!k.value,document.documentElement.classList.toggle("dark",k.value),localStorage.setItem("facjp_dark",k.value?"1":"0")}G(()=>{localStorage.getItem("facjp_dark")==="1"&&(k.value=!0,document.documentElement.classList.add("dark"))});const A=S(()=>{var e,a;return(((e=t.user)==null?void 0:e.name)||((a=t.user)==null?void 0:a.username)||"U").charAt(0).toUpperCase()});function P(){t.logout(),m.push("/login")}function q(z){_.value&&!_.value.contains(z.target)&&(g.value=!1)}return G(()=>document.addEventListener("click",q)),ne(()=>document.removeEventListener("click",q)),(z,e)=>{var o,h,d;const a=oe("router-link");return p(),x(J,null,[n("header",va,[n("div",fa,[n("button",{class:"menu-toggle",onClick:e[0]||(e[0]=(...$)=>c(i)&&c(i)(...$)),"aria-label":"Menú"},[B(c(Ee),{size:20})]),n("h2",ma,j(f.title),1)]),n("div",ka,[c(t).currentBusiness?(p(),x("span",ba,[(o=c(y).profile)!=null&&o.logo?(p(),x("img",{key:0,src:c(y).profile.logo,class:"biz-logo",alt:"logo"},null,8,ga)):(p(),R(c(O),{key:1,size:14,class:"biz-icon"})),E(" "+j(c(t).currentBusiness.name),1)])):V("",!0),n("button",{class:"icon-btn",onClick:L,title:k.value?"Modo claro":"Modo oscuro"},[k.value?(p(),R(c(Ne),{key:0,size:17})):(p(),R(c(He),{key:1,size:17}))],8,wa),n("div",{class:"user-menu",onClick:e[6]||(e[6]=F($=>g.value=!g.value,["stop"])),ref_key:"menuRef",ref:_},[n("div",Ma,j(A.value),1),n("span",_a,j(((h=c(t).user)==null?void 0:h.name)||((d=c(t).user)==null?void 0:d.username)),1),B(c(xe),{size:12,class:"arrow"}),B(ye,{name:"fade"},{default:H(()=>[g.value?(p(),x("div",{key:0,class:"dropdown-menu",onClick:e[5]||(e[5]=F(()=>{},["stop"]))},[c(t).isAdmin?(p(),R(a,{key:0,to:"/admin/setup",class:"dropdown-item",onClick:e[1]||(e[1]=$=>g.value=!1)},{default:H(()=>[B(c(ie),{size:15}),e[10]||(e[10]=E(" Configuración ",-1))]),_:1})):V("",!0),c(t).isSuperAdmin?(p(),R(a,{key:1,to:"/admin/franchises",class:"dropdown-item",onClick:e[2]||(e[2]=$=>g.value=!1)},{default:H(()=>[B(c(le),{size:15}),e[11]||(e[11]=E(" Franquicias ",-1))]),_:1})):V("",!0),c(t).businesses.length>1?(p(),R(a,{key:2,to:"/select-business",class:"dropdown-item",onClick:e[3]||(e[3]=$=>g.value=!1)},{default:H(()=>[B(c(be),{size:15}),e[12]||(e[12]=E(" Cambiar negocio ",-1))]),_:1})):V("",!0),n("button",{class:"dropdown-item",onClick:e[4]||(e[4]=$=>{C.value=!0,g.value=!1})},[B(c(Ae),{size:15}),e[13]||(e[13]=E(" Cambiar contraseña ",-1))]),e[15]||(e[15]=n("div",{class:"dropdown-divider"},null,-1)),n("button",{class:"dropdown-item danger",onClick:P},[B(c(qe),{size:15}),e[14]||(e[14]=E(" Cerrar sesión ",-1))])])):V("",!0)]),_:1})],512)])]),(p(),R(he,{to:"body"},[C.value?(p(),x("div",{key:0,class:"modal-overlay",onClick:F(l,["self"])},[n("div",$a,[n("div",{class:"modal-header"},[e[16]||(e[16]=n("h3",{class:"modal-title"},"Cambiar contraseña",-1)),n("button",{class:"btn-close",onClick:l},"×")]),n("div",xa,[n("div",Ca,[e[17]||(e[17]=n("label",{class:"form-label"},"Contraseña actual",-1)),N(n("input",{"onUpdate:modelValue":e[7]||(e[7]=$=>r.value.current=$),type:"password",class:"form-control"},null,512),[[T,r.value.current]])]),n("div",Sa,[e[18]||(e[18]=n("label",{class:"form-label"},"Nueva contraseña",-1)),N(n("input",{"onUpdate:modelValue":e[8]||(e[8]=$=>r.value.newPass=$),type:"password",class:"form-control"},null,512),[[T,r.value.newPass]])]),n("div",za,[e[19]||(e[19]=n("label",{class:"form-label"},"Confirmar nueva contraseña",-1)),N(n("input",{"onUpdate:modelValue":e[9]||(e[9]=$=>r.value.confirm=$),type:"password",class:"form-control"},null,512),[[T,r.value.confirm]])]),w.value?(p(),x("p",ja,j(w.value),1)):V("",!0)]),n("div",Ia,[n("button",{class:"btn btn-outline",onClick:l},"Cancelar"),n("button",{class:"btn btn-primary",onClick:M,disabled:s.value},j(s.value?"Guardando...":"Guardar"),9,Ba)])])])):V("",!0)]))],64)}}},Va=Y(Ra,[["__scopeId","data-v-d47873fe"]]),La={class:"app-footer"},Aa={class:"footer-brand"},Pa={class:"footer-logo"},qa={class:"footer-copy"},Ea={__name:"AppFooter",setup(f){const t=new Date().getFullYear();return(y,m)=>(p(),x("footer",La,[n("div",Aa,[n("div",Pa,[B(c(O),{size:12})]),m[0]||(m[0]=n("span",{class:"footer-name"},"facJp",-1)),m[1]||(m[1]=n("span",{class:"footer-sep"},"·",-1)),m[2]||(m[2]=n("span",{class:"footer-tagline"},"Gestión financiera",-1))]),n("div",qa," © "+j(c(t))+" · Todos los derechos reservados ",1)]))}},Ha=Y(Ea,[["__scopeId","data-v-f502402c"]]),Ua={class:"app-layout"},Da={class:"main-content"},Oa={class:"content-area"},Ga={__name:"PageLayout",props:{title:{type:String,default:"facJp"}},setup(f){return(t,y)=>(p(),x("div",Ua,[B(ha),n("div",Da,[B(Va,{title:f.title},null,8,["title"]),n("div",Oa,[fe(t.$slots,"default")]),B(Ha)])]))}};export{se as B,$e as C,Wa as D,qe as L,Ue as P,Oe as R,Ge as W,Ga as _,me as a,K as b,Ze as c,ke as d,ze as e,Ye as u};
