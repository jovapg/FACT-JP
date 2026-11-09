import{R as t,W as r}from"./PageLayout-CH_nI6CT.js";import{c as a}from"./store-B2q2N6kx.js";/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n=a("banknote",[["rect",{width:"20",height:"12",x:"2",y:"6",rx:"2",key:"9lu3g6"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}],["path",{d:"M6 12h.01M18 12h.01",key:"113zkx"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const o=a("credit-card",[["rect",{width:"20",height:"14",x:"2",y:"5",rx:"2",key:"ynyp8z"}],["line",{x1:"2",x2:"22",y1:"10",y2:"10",key:"1b3vmo"}]]);/**
 * @license lucide-vue-next v1.0.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const c=a("smartphone",[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]]),i={efectivo:"Efectivo",transferencia:"Transferencia",tarjeta:"Tarjeta",pago_fiado:"Pago de fiado"},f={efectivo:"badge-success",transferencia:"badge-info",tarjeta:"badge-warning",pago_fiado:"badge-purple"},s={efectivo:n,transferencia:c,tarjeta:o,pago_fiado:r};function p(e){return e?i[e.toLowerCase()]||e:"—"}function g(e){return e&&f[e.toLowerCase()]||"badge-default"}function u(e){return e?s[e.toLowerCase()]||t:t}export{p as a,g as b,u as p};
