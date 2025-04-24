"use strict";(self.webpackChunkreportrack=self.webpackChunkreportrack||[]).push([[6619],{86619:(C,E,t)=>{t.r(E),t.d(E,{ProvidersPage:()=>le,default:()=>be});var i=t(92132),d=t(21272),a=t(44158),o=t(81926),_=t(50642),e=t(6479),s=t(53900),f=t(43242),M=t(57564),j=t(68065),R=t(32161),l=t(69564),b=t(53432),I=t(55794),u=t(43121),n=t(32559),N=t(79318),H=t(70768),ie=t(34508),K=t(21270),S=t(57842),_e=t(96586),he=t(83314),me=t(19106),p=t(16136),fe=t(31708),ve=t(39404),Q=t(54894),V=t(74930),Ee=t(35601),Pe=t(83286),Me=t(61535),r=t(33544),h=t(10194),Le=t(77965),c=t(12083);const k=({description:v,disabled:U,intlLabel:A,error:$,name:x,onChange:W,placeholder:m,providerToEditName:L,type:O,value:y})=>{const{formatMessage:P}=(0,Q.A)(),T=x==="noName"?`${window.strapi.backendURL}/api/connect/${L}/callback`:y,B=P({id:A.id,defaultMessage:A.defaultMessage},{provider:L,...A.values}),D=v?P({id:v.id,defaultMessage:v.defaultMessage},{provider:L,...v.values}):"";if(O==="bool")return(0,i.jsx)(a.l,{"aria-label":x,checked:y,disabled:U,hint:D,label:B,name:x,offLabel:P({id:"app.components.ToggleCheckbox.off-label",defaultMessage:"Off"}),onLabel:P({id:"app.components.ToggleCheckbox.on-label",defaultMessage:"On"}),onChange:w=>{W({target:{name:x,value:w.target.checked}})}});const Z=m?P({id:m.id,defaultMessage:m.defaultMessage},{...m.values}):"",ee=$?P({id:$,defaultMessage:$}):"";return(0,i.jsx)(o.k,{"aria-label":x,disabled:U,error:ee,label:B,name:x,onChange:W,placeholder:Z,type:O,value:T})};k.defaultProps={description:null,disabled:!1,error:"",placeholder:null,value:""},k.propTypes={description:r.shape({id:r.string.isRequired,defaultMessage:r.string.isRequired,values:r.object}),disabled:r.bool,error:r.string,intlLabel:r.shape({id:r.string.isRequired,defaultMessage:r.string.isRequired,values:r.object}).isRequired,name:r.string.isRequired,onChange:r.func.isRequired,placeholder:r.shape({id:r.string.isRequired,defaultMessage:r.string.isRequired,values:r.object}),providerToEditName:r.string.isRequired,type:r.string.isRequired,value:r.oneOfType([r.bool,r.string])};const G=({headerBreadcrumbs:v,initialData:U,isSubmiting:A,layout:$,isOpen:x,onSubmit:W,onToggle:m,providerToEditName:L})=>{const{formatMessage:O}=(0,Q.A)();return x?(0,i.jsxs)(_.k,{onClose:m,labelledBy:"title",children:[(0,i.jsx)(e.r,{children:(0,i.jsx)(Ee.B,{label:v.join(", "),children:v.map((y,P,T)=>(0,i.jsx)(Pe.m,{isCurrent:P===T.length-1,children:y},y))})}),(0,i.jsx)(Me.l1,{onSubmit:y=>W(y),initialValues:U,validationSchema:$.schema,validateOnChange:!1,children:({errors:y,handleChange:P,values:T})=>(0,i.jsxs)(p.lV,{children:[(0,i.jsx)(s.c,{children:(0,i.jsx)(f.s,{direction:"column",alignItems:"stretch",gap:1,children:(0,i.jsx)(M.x,{gap:5,children:$.form.map(B=>B.map(D=>(0,i.jsx)(j.E,{col:D.size,xs:12,children:(0,i.jsx)(k,{...D,error:y[D.name],onChange:P,value:T[D.name],providerToEditName:L})},D.name)))})})}),(0,i.jsx)(R.j,{startActions:(0,i.jsx)(l.$,{variant:"tertiary",onClick:m,type:"button",children:O({id:"app.components.Button.cancel",defaultMessage:"Cancel"})}),endActions:(0,i.jsx)(l.$,{type:"submit",loading:A,children:O({id:"global.save",defaultMessage:"Save"})})})]})})]}):null};G.defaultProps={initialData:null,providerToEditName:null},G.propTypes={headerBreadcrumbs:r.arrayOf(r.string).isRequired,initialData:r.object,layout:r.shape({form:r.arrayOf(r.array),schema:r.object}).isRequired,isOpen:r.bool.isRequired,isSubmiting:r.bool.isRequired,onSubmit:r.func.isRequired,onToggle:r.func.isRequired,providerToEditName:r.string};const ae={id:(0,h.g)("PopUpForm.Providers.redirectURL.front-end.label"),defaultMessage:"The redirect URL to your front-end app"},ne={id:"http://www.client-app.com",defaultMessage:"http://www.client-app.com"},X={id:(0,h.g)("PopUpForm.Providers.enabled.description"),defaultMessage:"If disabled, users won't be able to use this provider."},J={id:(0,h.g)("PopUpForm.Providers.enabled.label"),defaultMessage:"Enable"},re={id:(0,h.g)("PopUpForm.Providers.key.label"),defaultMessage:"Client ID"},oe={id:(0,h.g)("PopUpForm.Providers.redirectURL.label"),defaultMessage:"The redirect URL to add in your {provider} application configurations"},z={id:(0,h.g)("PopUpForm.Providers.key.placeholder"),defaultMessage:"TEXT"},de={id:(0,h.g)("PopUpForm.Providers.secret.label"),defaultMessage:"Client Secret"},q={email:{form:[[{intlLabel:J,name:"enabled",type:"bool",description:X,size:6}]],schema:c.Ik().shape({enabled:c.lc().required(p.iW.required)})},providers:{form:[[{intlLabel:J,name:"enabled",type:"bool",description:X,size:6,validations:{required:!0}}],[{intlLabel:re,name:"key",type:"text",placeholder:z,size:12,validations:{required:!0}}],[{intlLabel:de,name:"secret",type:"text",placeholder:z,size:12,validations:{required:!0}}],[{intlLabel:ae,placeholder:ne,name:"callback",type:"text",size:12,validations:{required:!0}}],[{intlLabel:oe,name:"noName",type:"text",validations:{},size:12,disabled:!0}]],schema:c.Ik().shape({enabled:c.lc().required(p.iW.required),key:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()}),secret:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()}),callback:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()})})},providersWithSubdomain:{form:[[{intlLabel:J,name:"enabled",type:"bool",description:X,size:6,validations:{required:!0}}],[{intlLabel:re,name:"key",type:"text",placeholder:z,size:12,validations:{required:!0}}],[{intlLabel:de,name:"secret",type:"text",placeholder:z,size:12,validations:{required:!0}}],[{intlLabel:{id:(0,h.g)({id:"PopUpForm.Providers.jwksurl.label"}),defaultMessage:"JWKS URL"},name:"jwksurl",type:"text",placeholder:z,size:12,validations:{required:!1}}],[{intlLabel:{id:(0,h.g)("PopUpForm.Providers.subdomain.label"),defaultMessage:"Host URI (Subdomain)"},name:"subdomain",type:"text",placeholder:{id:(0,h.g)("PopUpForm.Providers.subdomain.placeholder"),defaultMessage:"my.subdomain.com"},size:12,validations:{required:!0}}],[{intlLabel:ae,placeholder:ne,name:"callback",type:"text",size:12,validations:{required:!0}}],[{intlLabel:oe,name:"noName",type:"text",validations:{},size:12,disabled:!0}]],schema:c.Ik().shape({enabled:c.lc().required(p.iW.required),key:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()}),secret:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()}),subdomain:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()}),callback:c.Yj().when("enabled",{is:!0,then:c.Yj().required(p.iW.required),otherwise:c.Yj()})})}},le=()=>{const{formatMessage:v,locale:U}=(0,Q.A)(),A=(0,V.useQueryClient)(),{trackUsage:$}=(0,p.z1)(),[x,W]=d.useState(!1),[m,L]=d.useState(null),O=(0,p.hN)(),{lockApp:y,unlockApp:P}=(0,p.MA)(),{get:T,put:B}=(0,p.ry)(),{formatAPIError:D}=(0,p.wq)(),Z=(0,p.QM)(U,{sensitivity:"base"});(0,p.L4)();const{isLoading:ee,allowedActions:{canUpdate:w}}=(0,p.ec)({update:h.P.updateProviders}),{isLoading:ye,data:se}=(0,V.useQuery)(["users-permissions","get-providers"],async()=>{const{data:g}=await T("/users-permissions/providers");return g},{initialData:{}}),ce=(0,V.useMutation)(g=>B("/users-permissions/providers",g),{async onSuccess(){await A.invalidateQueries(["users-permissions","get-providers"]),O({type:"success",message:{id:(0,h.g)("notification.success.submit")}}),$("didEditAuthenticationProvider"),te(),P()},onError(g){O({type:"warning",message:D(g)}),P()},refetchActive:!1}),F=Object.entries(se).reduce((g,[Y,Oe])=>{const{icon:pe,enabled:je,subdomain:Ae}=Oe;return g.push({name:Y,icon:pe==="envelope"?["fas","envelope"]:["fab",pe],enabled:je,subdomain:Ae}),g},[]).sort((g,Y)=>Z.compare(g.name,Y.name)),xe=ye||ee,ue=d.useMemo(()=>m?!!F.find(Y=>Y.name===m)?.subdomain:!1,[F,m]),$e=d.useMemo(()=>m==="email"?q.email:ue?q.providersWithSubdomain:q.providers,[m,ue]),te=()=>{W(g=>!g)},ge=g=>{w&&(L(g.name),te())},De=async g=>{y(),$("willEditAuthenticationProvider"),ce.mutate({providers:{...se,[m]:g}})};return(0,i.jsxs)(b.P,{children:[(0,i.jsx)(p.x7,{name:v({id:(0,h.g)("HeaderNav.link.providers"),defaultMessage:"Providers"})}),(0,i.jsxs)(I.g,{children:[(0,i.jsx)(u.Q,{title:v({id:(0,h.g)("HeaderNav.link.providers"),defaultMessage:"Providers"})}),xe?(0,i.jsx)(p.Bl,{}):(0,i.jsx)(n.s,{children:(0,i.jsxs)(N.X,{colCount:3,rowCount:F.length+1,children:[(0,i.jsx)(H.d,{children:(0,i.jsxs)(ie.Tr,{children:[(0,i.jsx)(K.Th,{children:(0,i.jsx)(S.o,{variant:"sigma",textColor:"neutral600",children:v({id:"global.name",defaultMessage:"Name"})})}),(0,i.jsx)(K.Th,{children:(0,i.jsx)(S.o,{variant:"sigma",textColor:"neutral600",children:v({id:(0,h.g)("Providers.status"),defaultMessage:"Status"})})}),(0,i.jsx)(K.Th,{children:(0,i.jsx)(S.o,{variant:"sigma",children:(0,i.jsx)(_e.s,{children:v({id:"global.settings",defaultMessage:"Settings"})})})})]})}),(0,i.jsx)(he.N,{children:F.map(g=>(0,i.jsxs)(ie.Tr,{...(0,p.qM)({fn:()=>ge(g),condition:w}),children:[(0,i.jsx)(K.Td,{width:"45%",children:(0,i.jsx)(S.o,{fontWeight:"semiBold",textColor:"neutral800",children:g.name})}),(0,i.jsx)(K.Td,{width:"65%",children:(0,i.jsx)(S.o,{textColor:g.enabled?"success600":"danger600","data-testid":`enable-${g.name}`,children:g.enabled?v({id:"global.enabled",defaultMessage:"Enabled"}):v({id:"global.disabled",defaultMessage:"Disabled"})})}),(0,i.jsx)(K.Td,{...p.dG,children:w&&(0,i.jsx)(me.K,{onClick:()=>ge(g),noBorder:!0,icon:(0,i.jsx)(fe.A,{}),label:"Edit"})})]},g.name))})]})})]}),(0,i.jsx)(G,{initialData:se[m],isOpen:x,isSubmiting:ce.isLoading,layout:$e,headerBreadcrumbs:[v({id:(0,h.g)("PopUpForm.header.edit.providers"),defaultMessage:"Edit Provider"}),ve(m)],onToggle:te,onSubmit:De,providerToEditName:m})]})},be=()=>(0,i.jsx)(p.kz,{permissions:h.P.readProviders,children:(0,i.jsx)(le,{})})},77030:(C,E,t)=>{t.d(E,{a:()=>_});var i=t(79793),d=t(17297),a=t(52718);const o={color:!0,cursor:!0,height:!0,width:!0},_=i.Ay.div.withConfig({shouldForwardProp:(e,s)=>!o[e]&&s(e)})`
  // Font
  font-size: ${({fontSize:e,theme:s})=>(0,a.K)(s.fontSizes,e,e)};

  // Colors
  background: ${({theme:e,background:s})=>(0,a.K)(e.colors,s,s)};
  color: ${({theme:e,color:s})=>(0,a.K)(e.colors,s,void 0)};

  // Spaces
  ${({theme:e,padding:s})=>(0,d.A)("padding",s,e)}
  ${({theme:e,paddingTop:s})=>(0,d.A)("padding-top",s,e)}
  ${({theme:e,paddingRight:s})=>(0,d.A)("padding-right",s,e)}
  ${({theme:e,paddingBottom:s})=>(0,d.A)("padding-bottom",s,e)}
  ${({theme:e,paddingLeft:s})=>(0,d.A)("padding-left",s,e)}
  ${({theme:e,marginLeft:s})=>(0,d.A)("margin-left",s,e)}
  ${({theme:e,marginRight:s})=>(0,d.A)("margin-right",s,e)}
  ${({theme:e,marginTop:s})=>(0,d.A)("margin-top",s,e)}
  ${({theme:e,marginBottom:s})=>(0,d.A)("margin-bottom",s,e)}

  // Responsive hiding
  ${({theme:e,hiddenS:s})=>s?`${e.mediaQueries.tablet} { display: none; }`:void 0}
  ${({theme:e,hiddenXS:s})=>s?`${e.mediaQueries.mobile} { display: none; }`:void 0}
  

  // Borders
  border-radius: ${({theme:e,hasRadius:s,borderRadius:f})=>s?e.borderRadius:f};
  border-style: ${({borderStyle:e})=>e};
  border-width: ${({borderWidth:e})=>e};
  border-color: ${({borderColor:e,theme:s})=>(0,a.K)(s.colors,e,void 0)};
  border: ${({theme:e,borderColor:s,borderStyle:f,borderWidth:M})=>{if(s&&!f&&typeof M>"u")return`1px solid ${e.colors[s]}`}};

  // Shadows
  box-shadow: ${({theme:e,shadow:s})=>(0,a.K)(e.shadows,s,void 0)};

  // Handlers
  pointer-events: ${({pointerEvents:e})=>e};
  &:hover {
    ${({_hover:e,theme:s})=>e?e(s):void 0}
  }

  // Display
  display: ${({display:e})=>e};

  // Position
  position: ${({position:e})=>e};
  left: ${({left:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  right: ${({right:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  top: ${({top:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  bottom: ${({bottom:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  z-index: ${({zIndex:e})=>e};
  overflow: ${({overflow:e})=>e};

  // Size
  width: ${({width:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  max-width: ${({maxWidth:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  min-width: ${({minWidth:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  height: ${({height:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  max-height: ${({maxHeight:e,theme:s})=>(0,a.K)(s.spaces,e,e)};
  min-height: ${({minHeight:e,theme:s})=>(0,a.K)(s.spaces,e,e)};

  // Animation
  transition: ${({transition:e})=>e};
  transform: ${({transform:e})=>e};
  animation: ${({animation:e})=>e};

  //Flexbox children props
  flex-shrink: ${({shrink:e})=>e};
  flex-grow: ${({grow:e})=>e};
  flex-basis: ${({basis:e})=>e};
  flex: ${({flex:e})=>e};

  // Text
  text-align: ${({textAlign:e})=>e};
  text-transform: ${({textTransform:e})=>e};
  line-height: ${({theme:e,lineHeight:s})=>(0,a.K)(e.lineHeights,s,s)};

  // Cursor
  cursor: ${({cursor:e})=>e};
`},85574:(C,E,t)=>{t.d(E,{o:()=>I});var i=t(79793);const d="alpha",a="beta",o="delta",_="epsilon",e="omega",s="pi",f="sigma",M=[d,a,o,_,e,s,f],j=({ellipsis:u=!1})=>u&&`
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,R=({variant:u=e,theme:n})=>{switch(u){case d:return`
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
      `;case _:return`
        font-size: ${n.fontSizes[3]};
        line-height: ${n.lineHeights[6]};
      `;case e:return`
        font-size: ${n.fontSizes[2]};
        line-height: ${n.lineHeights[4]};
      `;case s:return`
        font-size: ${n.fontSizes[1]};
        line-height: ${n.lineHeights[3]};
      `;case f:return`
        font-weight: ${n.fontWeights.bold};
        font-size: ${n.fontSizes[0]};
        line-height: ${n.lineHeights[5]};
        text-transform: uppercase;
      `;default:return`
        font-size: ${n.fontSizes[2]};
      `}};var l=t(52718);const b={fontSize:!0,fontWeight:!0},I=i.Ay.span.withConfig({shouldForwardProp:(u,n)=>!b[u]&&n(u)})`
  ${R}
  ${j}

  // These properties need to come after {variantStyle}, because they might
  // overwrite a variant attribute
  font-weight: ${({theme:u,fontWeight:n})=>(0,l.K)(u.fontWeights,n,void 0)};
  font-size: ${({theme:u,fontSize:n})=>(0,l.K)(u.fontSizes,n,void 0)};
  line-height: ${({theme:u,lineHeight:n})=>(0,l.K)(u.lineHeights,n,n)};
  color: ${({theme:u,textColor:n})=>u.colors[n||"neutral800"]};
  text-align: ${({textAlign:u})=>u};
  text-decoration: ${({textDecoration:u})=>u};
  text-transform: ${({textTransform:u})=>u};
`},17297:(C,E,t)=>{t.d(E,{A:()=>i});const i=(d,a,o)=>{if(!a)return;if(typeof a=="object")return(Array.isArray(a)?a:[a?.desktop,a?.tablet,a?.mobile]).reduce((f,M,j)=>{if(M)switch(j){case 0:return`${f}${d}: ${o.spaces[M]};`;case 1:return`${f}${o.mediaQueries.tablet}{${d}: ${o.spaces[M]};}`;case 2:return`${f}${o.mediaQueries.mobile}{${d}: ${o.spaces[M]};}`;default:return f}return f},"");const _=o.spaces[a]??a;return`${d}: ${_};`}},52718:(C,E,t)=>{t.d(E,{K:()=>a});function i(o,_){return typeof o=="string"?!1:_ in o}function d(o){return o&&typeof o=="object"&&!Array.isArray(o)}function a(o,_,e){return _&&i(o,_)?o[_]:e}},35601:(C,E,t)=>{t.d(E,{B:()=>R});var i=t(92132),d=t(21272),a=t(79793),o=t(77030),_=t(85574);const e=()=>(0,i.jsx)(o.a,{"aria-hidden":!0,paddingLeft:1,paddingRight:1,children:(0,i.jsx)(_.o,{variant:"pi",textColor:"neutral500",children:"/"})});e.displayName="Divider";var s=t(17297);const f={direction:!0},M=(0,a.Ay)(o.a).withConfig({shouldForwardProp:(l,b)=>!f[l]&&b(l)})`
  align-items: ${({alignItems:l="center"})=>l};
  display: ${({display:l="flex",inline:b})=>b?"inline-flex":l};
  flex-direction: ${({direction:l="row"})=>l};
  flex-shrink: ${({shrink:l})=>l};
  flex-wrap: ${({wrap:l})=>l};
  ${({gap:l,theme:b})=>(0,s.A)("gap",l,b)};
  justify-content: ${({justifyContent:l})=>l};
`,j=(0,a.Ay)(M)`
  // CrumbLinks do have padding-x, because they need to have a
  // interaction effect, which mis-aligns the breadcrumbs on the left.
  // This normalizes the behavior by moving the first item to left by
  // the same amount it has inner padding
  :first-child {
    margin-left: ${({theme:l})=>`calc(-1*${l.spaces[2]})`};
  }
`,R=({label:l,children:b,...I})=>{const u=d.Children.toArray(b);return(0,i.jsx)(o.a,{"aria-label":l,...I,children:(0,i.jsx)(j,{as:"ol",children:d.Children.map(u,(n,N)=>{const H=u.length>1&&N+1<u.length;return(0,i.jsxs)(M,{inline:!0,as:"li",children:[n,H&&(0,i.jsx)(e,{})]})})})})};R.displayName="Breadcrumbs"},83286:(C,E,t)=>{t.d(E,{m:()=>o});var i=t(92132),d=t(77030),a=t(85574);const o=({children:_,isCurrent:e=!1,...s})=>(0,i.jsx)(d.a,{paddingLeft:2,paddingRight:2,paddingTop:1,paddingBottom:1,children:(0,i.jsx)(a.o,{variant:"pi",textColor:"neutral800",fontWeight:e?"bold":"normal","aria-current":e,...s,children:_})});o.displayName="Crumb"}}]);
