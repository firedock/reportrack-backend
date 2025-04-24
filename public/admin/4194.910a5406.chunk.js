"use strict";(self.webpackChunkreportrack=self.webpackChunkreportrack||[]).push([[4194],{34194:(T,E,i)=>{i.r(E),i.d(E,{default:()=>es});var e=i(92132),d=i(21272),a=i(50642),o=i(6479),p=i(53900),s=i(57564),t=i(68065),c=i(168),P=i(32161),D=i(69564),C=i(79318),m=i(70768),f=i(34508),u=i(21270),l=i(96586),n=i(57842),L=i(83314),K=i(27026),U=i(19106),X=i(70230),b=i(55794),S=i(43121),z=i(32559),r=i(16136),R=i(54894),B=i(74930),_=i(10194),gs=i(77965),J=i(35601),F=i(83286),Z=i(61535),h=i(33544),O=i(12083),k=i(4032),w=i(31708),q=i(13333);const ss=O.Ik().shape({options:O.Ik().shape({from:O.Ik().shape({name:O.Yj().required(r.iW.required),email:O.Yj().email(r.iW.email).required(r.iW.required)}).required(),response_email:O.Yj().email(r.iW.email),object:O.Yj().required(r.iW.required),message:O.Yj().required(r.iW.required)}).required(r.iW.required)}),N=({template:g,onToggle:y,onSubmit:M})=>{const{formatMessage:$}=(0,R.A)();return(0,e.jsxs)(a.k,{onClose:y,labelledBy:`${$({id:(0,_.g)("PopUpForm.header.edit.email-templates"),defaultMessage:"Edit email template"})}, ${$({id:(0,_.g)(g.display),defaultMessage:g.display})}`,children:[(0,e.jsx)(o.r,{children:(0,e.jsxs)(J.B,{label:`${$({id:(0,_.g)("PopUpForm.header.edit.email-templates"),defaultMessage:"Edit email template"})}, ${$({id:(0,_.g)(g.display),defaultMessage:g.display})}`,children:[(0,e.jsx)(F.m,{children:$({id:(0,_.g)("PopUpForm.header.edit.email-templates"),defaultMessage:"Edit email template"})}),(0,e.jsx)(F.m,{isCurrent:!0,children:$({id:(0,_.g)(g.display),defaultMessage:g.display})})]})}),(0,e.jsx)(Z.l1,{onSubmit:M,initialValues:g,validateOnChange:!1,validationSchema:ss,enableReinitialize:!0,children:({errors:j,values:A,handleChange:v,isSubmitting:W})=>(0,e.jsxs)(r.lV,{children:[(0,e.jsx)(p.c,{children:(0,e.jsxs)(s.x,{gap:5,children:[(0,e.jsx)(t.E,{col:6,s:12,children:(0,e.jsx)(r.ah,{intlLabel:{id:(0,_.g)("PopUpForm.Email.options.from.name.label"),defaultMessage:"Shipper name"},name:"options.from.name",onChange:v,value:A.options.from.name,error:j?.options?.from?.name,type:"text"})}),(0,e.jsx)(t.E,{col:6,s:12,children:(0,e.jsx)(r.ah,{intlLabel:{id:(0,_.g)("PopUpForm.Email.options.from.email.label"),defaultMessage:"Shipper email"},name:"options.from.email",onChange:v,value:A.options.from.email,error:j?.options?.from?.email,type:"text"})}),(0,e.jsx)(t.E,{col:6,s:12,children:(0,e.jsx)(r.ah,{intlLabel:{id:(0,_.g)("PopUpForm.Email.options.response_email.label"),defaultMessage:"Response email"},name:"options.response_email",onChange:v,value:A.options.response_email,error:j?.options?.response_email,type:"text"})}),(0,e.jsx)(t.E,{col:6,s:12,children:(0,e.jsx)(r.ah,{intlLabel:{id:(0,_.g)("PopUpForm.Email.options.object.label"),defaultMessage:"Subject"},name:"options.object",onChange:v,value:A.options.object,error:j?.options?.object,type:"text"})}),(0,e.jsx)(t.E,{col:12,s:12,children:(0,e.jsx)(c.T,{label:$({id:(0,_.g)("PopUpForm.Email.options.message.label"),defaultMessage:"Message"}),id:"options.message",onChange:v,value:A.options.message,error:j?.options?.message&&$({id:j.options.message,defaultMessage:j.options.message})})})]})}),(0,e.jsx)(P.j,{startActions:(0,e.jsx)(D.$,{onClick:y,variant:"tertiary",children:"Cancel"}),endActions:(0,e.jsx)(D.$,{loading:W,type:"submit",children:"Finish"})})]})})]})};N.propTypes={template:h.shape({display:h.string,icon:h.string,options:h.shape({from:h.shape({name:h.string,email:h.string}),message:h.string,object:h.string,response_email:h.string})}).isRequired,onSubmit:h.func.isRequired,onToggle:h.func.isRequired};const H=({canUpdate:g,onEditClick:y})=>{const{formatMessage:M}=(0,R.A)();return(0,e.jsxs)(C.X,{colCount:3,rowCount:3,children:[(0,e.jsx)(m.d,{children:(0,e.jsxs)(f.Tr,{children:[(0,e.jsx)(u.Th,{width:"1%",children:(0,e.jsx)(l.s,{children:M({id:(0,_.g)("Email.template.table.icon.label"),defaultMessage:"icon"})})}),(0,e.jsx)(u.Th,{children:(0,e.jsx)(n.o,{variant:"sigma",textColor:"neutral600",children:M({id:(0,_.g)("Email.template.table.name.label"),defaultMessage:"name"})})}),(0,e.jsx)(u.Th,{width:"1%",children:(0,e.jsx)(l.s,{children:M({id:(0,_.g)("Email.template.table.action.label"),defaultMessage:"action"})})})]})}),(0,e.jsxs)(L.N,{children:[(0,e.jsxs)(f.Tr,{...(0,r.qM)({fn:()=>y("reset_password")}),children:[(0,e.jsx)(u.Td,{children:(0,e.jsx)(K.I,{children:(0,e.jsx)(k.A,{"aria-label":M({id:"global.reset-password",defaultMessage:"Reset password"})})})}),(0,e.jsx)(u.Td,{children:(0,e.jsx)(n.o,{children:M({id:"global.reset-password",defaultMessage:"Reset password"})})}),(0,e.jsx)(u.Td,{...r.dG,children:(0,e.jsx)(U.K,{onClick:()=>y("reset_password"),label:M({id:(0,_.g)("Email.template.form.edit.label"),defaultMessage:"Edit a template"}),noBorder:!0,icon:g&&(0,e.jsx)(w.A,{})})})]}),(0,e.jsxs)(f.Tr,{...(0,r.qM)({fn:()=>y("email_confirmation")}),children:[(0,e.jsx)(u.Td,{children:(0,e.jsx)(K.I,{children:(0,e.jsx)(q.A,{"aria-label":M({id:(0,_.g)("Email.template.email_confirmation"),defaultMessage:"Email address confirmation"})})})}),(0,e.jsx)(u.Td,{children:(0,e.jsx)(n.o,{children:M({id:(0,_.g)("Email.template.email_confirmation"),defaultMessage:"Email address confirmation"})})}),(0,e.jsx)(u.Td,{...r.dG,children:(0,e.jsx)(U.K,{onClick:()=>y("email_confirmation"),label:M({id:(0,_.g)("Email.template.form.edit.label"),defaultMessage:"Edit a template"}),noBorder:!0,icon:g&&(0,e.jsx)(w.A,{})})})]})]})]})};H.propTypes={canUpdate:h.bool.isRequired,onEditClick:h.func.isRequired};const es=()=>(0,e.jsx)(r.kz,{permissions:_.P.readEmailTemplates,children:(0,e.jsx)(ts,{})}),ts=()=>{const{formatMessage:g}=(0,R.A)(),{trackUsage:y}=(0,r.z1)(),{notifyStatus:M}=(0,X.W)(),$=(0,r.hN)(),{lockApp:j,unlockApp:A}=(0,r.MA)(),v=(0,B.useQueryClient)(),{get:W,put:is}=(0,r.ry)(),{formatAPIError:Q}=(0,r.wq)();(0,r.L4)();const[as,ns]=d.useState(!1),[V,os]=d.useState(null),{isLoading:ls,allowedActions:{canUpdate:rs}}=(0,r.ec)({update:_.P.updateEmailTemplates}),{isLoading:ds,data:Y}=(0,B.useQuery)(["users-permissions","email-templates"],async()=>{const{data:x}=await W("/users-permissions/email-templates");return x},{onSuccess(){M(g({id:(0,_.g)("Email.template.data.loaded"),defaultMessage:"Email templates has been loaded"}))},onError(x){$({type:"warning",message:Q(x)})}}),ms=ls||ds,I=()=>{ns(x=>!x)},_s=x=>{os(x),I()},G=(0,B.useMutation)(x=>is("/users-permissions/email-templates",{"email-templates":x}),{async onSuccess(){await v.invalidateQueries(["users-permissions","email-templates"]),$({type:"success",message:{id:"notification.success.saved",defaultMessage:"Saved"}}),y("didEditEmailTemplates"),A(),I()},onError(x){$({type:"warning",message:Q(x)}),A()},refetchActive:!0}),ps=x=>{j(),y("willEditEmailTemplates");const cs={...Y,[V]:x};G.mutate(cs)};return ms?(0,e.jsxs)(b.g,{"aria-busy":"true",children:[(0,e.jsx)(r.x7,{name:g({id:(0,_.g)("HeaderNav.link.emailTemplates"),defaultMessage:"Email templates"})}),(0,e.jsx)(S.Q,{title:g({id:(0,_.g)("HeaderNav.link.emailTemplates"),defaultMessage:"Email templates"})}),(0,e.jsx)(z.s,{children:(0,e.jsx)(r.Bl,{})})]}):(0,e.jsxs)(b.g,{"aria-busy":G.isLoading,children:[(0,e.jsx)(r.x7,{name:g({id:(0,_.g)("HeaderNav.link.emailTemplates"),defaultMessage:"Email templates"})}),(0,e.jsx)(S.Q,{title:g({id:(0,_.g)("HeaderNav.link.emailTemplates"),defaultMessage:"Email templates"})}),(0,e.jsxs)(z.s,{children:[(0,e.jsx)(H,{onEditClick:_s,canUpdate:rs}),as&&(0,e.jsx)(N,{template:Y[V],onToggle:I,onSubmit:ps})]})]})}},77030:(T,E,i)=>{i.d(E,{a:()=>p});var e=i(79793),d=i(17297),a=i(52718);const o={color:!0,cursor:!0,height:!0,width:!0},p=e.Ay.div.withConfig({shouldForwardProp:(s,t)=>!o[s]&&t(s)})`
  // Font
  font-size: ${({fontSize:s,theme:t})=>(0,a.K)(t.fontSizes,s,s)};

  // Colors
  background: ${({theme:s,background:t})=>(0,a.K)(s.colors,t,t)};
  color: ${({theme:s,color:t})=>(0,a.K)(s.colors,t,void 0)};

  // Spaces
  ${({theme:s,padding:t})=>(0,d.A)("padding",t,s)}
  ${({theme:s,paddingTop:t})=>(0,d.A)("padding-top",t,s)}
  ${({theme:s,paddingRight:t})=>(0,d.A)("padding-right",t,s)}
  ${({theme:s,paddingBottom:t})=>(0,d.A)("padding-bottom",t,s)}
  ${({theme:s,paddingLeft:t})=>(0,d.A)("padding-left",t,s)}
  ${({theme:s,marginLeft:t})=>(0,d.A)("margin-left",t,s)}
  ${({theme:s,marginRight:t})=>(0,d.A)("margin-right",t,s)}
  ${({theme:s,marginTop:t})=>(0,d.A)("margin-top",t,s)}
  ${({theme:s,marginBottom:t})=>(0,d.A)("margin-bottom",t,s)}

  // Responsive hiding
  ${({theme:s,hiddenS:t})=>t?`${s.mediaQueries.tablet} { display: none; }`:void 0}
  ${({theme:s,hiddenXS:t})=>t?`${s.mediaQueries.mobile} { display: none; }`:void 0}
  

  // Borders
  border-radius: ${({theme:s,hasRadius:t,borderRadius:c})=>t?s.borderRadius:c};
  border-style: ${({borderStyle:s})=>s};
  border-width: ${({borderWidth:s})=>s};
  border-color: ${({borderColor:s,theme:t})=>(0,a.K)(t.colors,s,void 0)};
  border: ${({theme:s,borderColor:t,borderStyle:c,borderWidth:P})=>{if(t&&!c&&typeof P>"u")return`1px solid ${s.colors[t]}`}};

  // Shadows
  box-shadow: ${({theme:s,shadow:t})=>(0,a.K)(s.shadows,t,void 0)};

  // Handlers
  pointer-events: ${({pointerEvents:s})=>s};
  &:hover {
    ${({_hover:s,theme:t})=>s?s(t):void 0}
  }

  // Display
  display: ${({display:s})=>s};

  // Position
  position: ${({position:s})=>s};
  left: ${({left:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  right: ${({right:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  top: ${({top:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  bottom: ${({bottom:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  z-index: ${({zIndex:s})=>s};
  overflow: ${({overflow:s})=>s};

  // Size
  width: ${({width:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  max-width: ${({maxWidth:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  min-width: ${({minWidth:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  height: ${({height:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  max-height: ${({maxHeight:s,theme:t})=>(0,a.K)(t.spaces,s,s)};
  min-height: ${({minHeight:s,theme:t})=>(0,a.K)(t.spaces,s,s)};

  // Animation
  transition: ${({transition:s})=>s};
  transform: ${({transform:s})=>s};
  animation: ${({animation:s})=>s};

  //Flexbox children props
  flex-shrink: ${({shrink:s})=>s};
  flex-grow: ${({grow:s})=>s};
  flex-basis: ${({basis:s})=>s};
  flex: ${({flex:s})=>s};

  // Text
  text-align: ${({textAlign:s})=>s};
  text-transform: ${({textTransform:s})=>s};
  line-height: ${({theme:s,lineHeight:t})=>(0,a.K)(s.lineHeights,t,t)};

  // Cursor
  cursor: ${({cursor:s})=>s};
`},85574:(T,E,i)=>{i.d(E,{o:()=>u});var e=i(79793);const d="alpha",a="beta",o="delta",p="epsilon",s="omega",t="pi",c="sigma",P=[d,a,o,p,s,t,c],D=({ellipsis:l=!1})=>l&&`
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,C=({variant:l=s,theme:n})=>{switch(l){case d:return`
        font-weight: ${n.fontWeights.bold};
        font-size: ${n.fontSizes[5]};
        line-height: ${n.lineHeights[2]};
      `;case a:return`
        font-weight: ${n.fontWeights.bold};
        font-size: ${n.fontSizes[4]};
        line-height: ${n.lineHeights[1]};
      `;case o:return`
        font-weight: ${n.fontWeights.semiBold};
        font-size: ${n.fontSizes[3]};
        line-height: ${n.lineHeights[2]};
      `;case p:return`
        font-size: ${n.fontSizes[3]};
        line-height: ${n.lineHeights[6]};
      `;case s:return`
        font-size: ${n.fontSizes[2]};
        line-height: ${n.lineHeights[4]};
      `;case t:return`
        font-size: ${n.fontSizes[1]};
        line-height: ${n.lineHeights[3]};
      `;case c:return`
        font-weight: ${n.fontWeights.bold};
        font-size: ${n.fontSizes[0]};
        line-height: ${n.lineHeights[5]};
        text-transform: uppercase;
      `;default:return`
        font-size: ${n.fontSizes[2]};
      `}};var m=i(52718);const f={fontSize:!0,fontWeight:!0},u=e.Ay.span.withConfig({shouldForwardProp:(l,n)=>!f[l]&&n(l)})`
  ${C}
  ${D}

  // These properties need to come after {variantStyle}, because they might
  // overwrite a variant attribute
  font-weight: ${({theme:l,fontWeight:n})=>(0,m.K)(l.fontWeights,n,void 0)};
  font-size: ${({theme:l,fontSize:n})=>(0,m.K)(l.fontSizes,n,void 0)};
  line-height: ${({theme:l,lineHeight:n})=>(0,m.K)(l.lineHeights,n,n)};
  color: ${({theme:l,textColor:n})=>l.colors[n||"neutral800"]};
  text-align: ${({textAlign:l})=>l};
  text-decoration: ${({textDecoration:l})=>l};
  text-transform: ${({textTransform:l})=>l};
`},17297:(T,E,i)=>{i.d(E,{A:()=>e});const e=(d,a,o)=>{if(!a)return;if(typeof a=="object")return(Array.isArray(a)?a:[a?.desktop,a?.tablet,a?.mobile]).reduce((c,P,D)=>{if(P)switch(D){case 0:return`${c}${d}: ${o.spaces[P]};`;case 1:return`${c}${o.mediaQueries.tablet}{${d}: ${o.spaces[P]};}`;case 2:return`${c}${o.mediaQueries.mobile}{${d}: ${o.spaces[P]};}`;default:return c}return c},"");const p=o.spaces[a]??a;return`${d}: ${p};`}},52718:(T,E,i)=>{i.d(E,{K:()=>a});function e(o,p){return typeof o=="string"?!1:p in o}function d(o){return o&&typeof o=="object"&&!Array.isArray(o)}function a(o,p,s){return p&&e(o,p)?o[p]:s}},35601:(T,E,i)=>{i.d(E,{B:()=>C});var e=i(92132),d=i(21272),a=i(79793),o=i(77030),p=i(85574);const s=()=>(0,e.jsx)(o.a,{"aria-hidden":!0,paddingLeft:1,paddingRight:1,children:(0,e.jsx)(p.o,{variant:"pi",textColor:"neutral500",children:"/"})});s.displayName="Divider";var t=i(17297);const c={direction:!0},P=(0,a.Ay)(o.a).withConfig({shouldForwardProp:(m,f)=>!c[m]&&f(m)})`
  align-items: ${({alignItems:m="center"})=>m};
  display: ${({display:m="flex",inline:f})=>f?"inline-flex":m};
  flex-direction: ${({direction:m="row"})=>m};
  flex-shrink: ${({shrink:m})=>m};
  flex-wrap: ${({wrap:m})=>m};
  ${({gap:m,theme:f})=>(0,t.A)("gap",m,f)};
  justify-content: ${({justifyContent:m})=>m};
`,D=(0,a.Ay)(P)`
  // CrumbLinks do have padding-x, because they need to have a
  // interaction effect, which mis-aligns the breadcrumbs on the left.
  // This normalizes the behavior by moving the first item to left by
  // the same amount it has inner padding
  :first-child {
    margin-left: ${({theme:m})=>`calc(-1*${m.spaces[2]})`};
  }
`,C=({label:m,children:f,...u})=>{const l=d.Children.toArray(f);return(0,e.jsx)(o.a,{"aria-label":m,...u,children:(0,e.jsx)(D,{as:"ol",children:d.Children.map(l,(n,L)=>{const K=l.length>1&&L+1<l.length;return(0,e.jsxs)(P,{inline:!0,as:"li",children:[n,K&&(0,e.jsx)(s,{})]})})})})};C.displayName="Breadcrumbs"},83286:(T,E,i)=>{i.d(E,{m:()=>o});var e=i(92132),d=i(77030),a=i(85574);const o=({children:p,isCurrent:s=!1,...t})=>(0,e.jsx)(d.a,{paddingLeft:2,paddingRight:2,paddingTop:1,paddingBottom:1,children:(0,e.jsx)(a.o,{variant:"pi",textColor:"neutral800",fontWeight:s?"bold":"normal","aria-current":s,...t,children:p})});o.displayName="Crumb"}}]);
