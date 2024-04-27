!function(){"use strict";const e=()=>{},t=e=>"number"==typeof e&&Number.isFinite(e),n=e=>"string"==typeof e,l=Array.isArray,a=e=>"object"==typeof e&&!!e&&!l(e),o=e=>"function"==typeof e,s=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),i=e=>{for(let t in e)if(s(e,t))return!1;return!0},r=e=>{let t=null;if("/"===e.charAt(0)&&("/"===e.charAt(1)?e=`https://${e}`:t=e),null===t)try{t=new URL(e).pathname}catch(n){t=e}return t},u=e=>`__duo-toolbox__-${e}`,d=u("global_variables"),c=(e,t)=>(a(window[d])||(window[d]={}),s(window[d],e)?window[d][e]:t),p=(e,t)=>{a(window[d])||(window[d]={}),window[d][e]=t},v=(e,t,n)=>{const l=t(c(e,n));return p(e,l),l},f=(e,t,n,l,a=1)=>{s(window,e)&&t(window[e])?n(window[e]):v("pending_global_listeners",((o={})=>{var s;if(!o[e]){o[e]={};let n=window[e];Object.defineProperty(window,e,{get:()=>n,set:l=>{t(l)?(Object.defineProperty(window,e,{value:l,configurable:!0,enumerable:!0,writable:!0}),Object.values(o[e]).forEach((e=>e.callback(l)))):n=l},configurable:!0})}return a>(Number(null===(s=o[e][l])||void 0===s?void 0:s.version)||0)&&(o[e][l]={callback:n,version:a}),o}))},g=u("original_function"),h=u("override_version"),m=(t,n,l,o=1)=>{var s;if(a(t)&&o>(Number(null===(s=t[n])||void 0===s?void 0:s[h])||0)){var i;const a=(null===(i=t[n])||void 0===i?void 0:i[g])||t[n]||e;t[n]=l(a),t[n][g]=a,t[n][h]=o}},_=(e,t,n,l=1)=>f(e,o,(e=>m(null==e?void 0:e.prototype,t,n,l)),`instance_method:${t}`,l),y=u("logging_iframe"),b=u("ui_event_notification"),w=(e,t)=>{window.postMessage({type:b,event:e,value:t},"*")},T=()=>(()=>{let e=document.getElementById(y);return e&&e.isConnected||(e=document.createElement("iframe"),e.id=y,e.style.display="none",document.body.appendChild(e)),e})().contentWindow.console,k=(...e)=>T().error(...e),x=["characterIntro","characterMatch","characterPuzzle","characterSelect","characterTrace","selectPronunciation","selectTranscription"],O=e=>{var t,n;return(null===(t=e.metadata)||void 0===t?void 0:t.source_language)||e.sourceLanguage||(null===(n=e.metadata)||void 0===n?void 0:n.learning_language)},L=e=>{var t;return(null===(t=e.metadata)||void 0===t?void 0:t.target_language)||e.targetLanguage||O(e)},S="effect",M="tts_sentence",$="tts_word",q="tts_morpheme",R="unknown",E="normal",K="slow",C="howler",j="rate",V="volume",D=u("forced_setting"),N=e=>a(e)&&!!e[D],U=e=>e.value,I=(e,n)=>((e,t,n,l=1)=>{if(!a(e))return;const o=u(`${t}_override_version`);l>(Number(e[o])||0)&&Object.defineProperty(e,t,n(Object.getOwnPropertyDescriptor(e,t)))})(HTMLMediaElement,n,(n=>({...n,set:function(l){const a=H[e];t(l)?(this[a.originalValueKey]=l,s(this,a.valueKey)&&(l=this[a.isRelativeKey]?z(e,l*this[a.valueKey]):this[a.valueKey])):N(l)&&(l=U(l)),t(l)&&(this[a.listenerValueKey]=l),n.set.call(this,l)}}))),P=(e,n)=>_("Howl",n,(l=>function(){const a=this,o=arguments,i=H[e];let r=!1;const u=a._queue.length;(1===o.length||2===o.length&&void 0===o[1])&&-1===a._getSoundIds().indexOf(o[0])&&(N(o[0])?(r=!0,o[0]=U(o[0])):((e,n)=>j===e&&t(n)||V===e&&n>=0&&n<=1)(e,o[0])&&(a[i.originalValueKey]=o[0],s(a,i.valueKey)&&(r=!0,a[i.isRelativeKey]?o[0]=z(e,o[0]*a[i.valueKey]):o[0]=a[i.valueKey])),r&&(a[i.listenerValueKey]=o[0]));const d=l.apply(a,arguments);return r&&u<a._queue.length&&(a._queue[a._queue.length-1].action=function(){var e;o[0]=(e=o[0],{[D]:!0,value:e}),a[n](...o)}),d})),A=(e,t,n,l)=>({...l,functions:{audio:{applyOverride:()=>I(e,n),getter:e=>e[t],setter:(e,n)=>e[t]=n,hasQueuedUpdate:()=>!1},[C]:{applyOverride:()=>P(e,n),getter:e=>e[n](),setter:(e,t)=>e[n](t),hasQueuedUpdate:e=>e._queue.find((e=>e.event===n))}},priorityKey:u(`${e}_priority`),isRelativeKey:u(`${e}_is_relative`),valueKey:u(`forced_${e}_value`),originalValueKey:u(`original_${e}_value`),listenerValueKey:u(`${e}_value`)}),H={[j]:A(j,"playbackRate","rate",{minValue:.5,maxValue:4,defaultValue:1}),[V]:A(V,"volume","volume",{minValue:0,maxValue:1,defaultValue:1})},z=(e,t)=>H[e]?Math.max(H[e].minValue,Math.min(t,H[e].maxValue)):t,B="event_listeners",Q=()=>{return`__listener::${e="last_event_listener_id",v(`__counter::${e}__`,(e=>e+1),0)}__`;var e},X=e=>{var t;return(null===(t=c(B,{}))||void 0===t?void 0:t[e])||{}},F=(e,t)=>{v(B,(n=>Object.assign(n||{},{[e]:t})))},J=e=>!i(X(e)),W=(e,t)=>{const n=X(e);return i(n)?null:t(Object.values(n))},G=(e,t,n=Q())=>{const l=X(e);return l[n]=t,F(e,l),()=>Z(e,n)},Y=(e,t,n,a,o=G,s=Q())=>{const i=`__${t}::${e}__`;var r;r=i,X(t)[r]||o(t,((...t)=>{const n=a(...t);l(n)&&ee(e,...n)}),i);const u=G(e,n,s);return()=>{u(),J(e)||Z(t,i)}},Z=(e,t)=>{const n=X(e);delete n[t],F(e,n)},ee=(e,...t)=>W(e,(e=>e.flatMap((e=>{try{return[e(...t)]}catch(e){return[]}})))),te="practice_session_loaded",ne="practice_challenges_loaded",le="pre_fetched_session_loaded",ae="story_loaded",oe="alphabets_loaded",se="alphabet_hints_loaded",ie="forum_discussion_loaded",re="guidebook_loaded",ue="sound_playback_requested",de="sound_playback_confirmed",ce="sound_playback_cancelled",pe={[oe]:/\/[\d]{4}-[\d]{2}-[\d]{2}\/alphabets\/courses\/(?<toLanguage>[^/]+)\/(?<fromLanguage>[^/?]+)\/?/g,[ie]:/\/comments\/([\d]+)/g,[re]:/\/guidebook\/compiled\/(?<toLanguage>[^/]+)\/(?<fromLanguage>[^/]+)\/?/g,[te]:/\/[\d]{4}-[\d]{2}-[\d]{2}\/sessions/g,[ae]:/\/api2\/stories/g,user_data_loaded:/\/[\d]{4}-[\d]{2}-[\d]{2}\/users\/[\d]+/g},ve="http_request_url_event_map",fe=()=>{let e=c(ve);return e instanceof Map||(e=new Map,Object.entries(pe).forEach((([t,n])=>{e.set(n,{eventType:t,urlRegExp:n,requestData:{}})})),p(ve,e)),e},ge=e=>{let t,n;const l=fe();for(const a of l.values()){const l=Array.from(e.matchAll(a.urlRegExp))[0];if(l){t=a.eventType,n={...a.requestData,...l.groups||{}};break}}return t?{eventType:t,requestData:n}:null},he=(e,t,n=Q())=>(_("XMLHttpRequest","open",(e=>function(t,n,l,o,s){const i=ge(n);return i&&W(i.eventType,(e=>{this.addEventListener("load",(()=>{try{const t=a(this.response)?this.response:JSON.parse(this.responseText);e.forEach((e=>e(t,i.requestData)))}catch(e){k(e,`Could not handle the XHR result (event: "${i.eventType}"): `)}}))})),e.call(this,t,n,l,o,s)}),3),((e,t,n=1)=>{f(e,o,(()=>m(window,e,t,n)),"global",n)})("fetch",(e=>function(t,n){const l=t instanceof Request?t.url:String(t);let a=null;const o=ge(l);return o&&(a=W(o.eventType,(e=>t=>{try{e.forEach((e=>e(t,o.requestData)))}catch(e){k(e,`Could not handle the fetch result (event: "${o.eventType}"): `)}}))),e.call(this,t,n).then((e=>{if(!a)return e;const t=e.clone();return e.json().then((e=>(a(e),t))).catch((()=>t))}))}),2),G(e,t,n)),me=(e,t=Q())=>{const l=le,a=e=>W(l,(t=>{e.addEventListener("success",(()=>{try{t.forEach((t=>t(e.result)))}catch(e){k(e,`Could not handle the IDBRequest result (event: ${l}): `)}}))}));return _("IDBIndex","get",(e=>function(t){const l=e.call(this,t);return n(t)&&t&&"prefetchedSessions"===this.objectStore.name&&a(l),l})),_("IDBObjectStore","get",(e=>function(t){const n=e.call(this,t);return"prefetchedSessions"===this.name&&a(n),n})),G(l,e,t)},_e=e=>{const t=e=>{let t;if(a(e)){var n;a(e.session)&&(e=e.session);t=[{challenges:[e.challenges,e.adaptiveChallenges,e.easierAdaptiveChallenges,e.mistakesReplacementChallenges,null===(n=e.adaptiveInterleavedChallenges)||void 0===n?void 0:n.challenges].filter(l).flat(),sessionMetaData:e.metadata||{}}]}return t},n=Y(ne,te,e,t,he),o=Y(ne,le,e,t,((e,t,n)=>me(t,n)));return()=>{n(),o()}},ye=(e,t)=>({url:e,type:M,speed:E,language:t}),be=(e,t)=>({url:e,type:$,speed:E,language:t}),we=(e,t)=>({url:e,type:q,speed:E,language:t}),Te=Object.fromEntries(["/sounds/7abe057dc8446ad325229edd6d8fd250.mp3","/sounds/2aae0ea735c8e9ed884107d6f0a09e35.mp3","/sounds/421d48c53ad6d52618dba715722278e0.mp3","/sounds/37d8f0b39dcfe63872192c89653a93f6.mp3","/sounds/0a27c1ee63dd220647e8410a0029aed2.mp3","/sounds/a28ff0a501ef5f33ca78c0afc45ee53e.mp3","/sounds/2e4669d8cf839272f0731f8afa488caf.mp3","/sounds/f0b6ab4396d5891241ef4ca73b4de13a.mp3"].map((e=>{return[e,(t=e,{url:t,type:S,speed:E,language:null})];var t}))),ke=/\/duolingo-data\/tts\/(?<language>[a-z-_]+)\/token\//i,xe="sound_type_map",Oe=()=>c(xe,Te),Le=[R,M,$,q,S],Se=[E,K],Me=(e,t)=>((e,t,n)=>{for(const l of e){const e=Number(l(t,n));if(!isNaN(e)&&0!==e)return e}return 0})([(e,t)=>Le.indexOf(e.type)-Le.indexOf(t.type),(e,t)=>Se.indexOf(e.speed)-Se.indexOf(t.speed)],e,t),$e=e=>{const t=Oe()||{};for(const n of e){const e=r(n.url);(!t[e]||Me(n,t[e])>0)&&(t[e]=n)}p(xe,t)},qe="sound_detection_listeners_version",Re="sound_detection_unregistration_callbacks",Ee=(e,t,n)=>{var l;return{url:e.url,type:t,speed:(null===(l=e.speed)||void 0===l?void 0:l.value)||E,language:n}},Ke=(e,t)=>{if(l(null==e?void 0:e.alphabets)&&n(null==t?void 0:t.toLanguage)){const o=t.toLanguage;$e(e.alphabets.flatMap((e=>null==e?void 0:e.groups)).flatMap((e=>null==e?void 0:e.characters)).flat().map((e=>null==e?void 0:e.ttsUrl)).filter(n).map((e=>we(e,o))));const s=[];for(const t of e.alphabets){var a;n(t.explanationUrl)&&s.push(t.explanationUrl),l(null===(a=t.explanationListing)||void 0===a?void 0:a.groups)&&s.push(...t.explanationListing.groups.flatMap((e=>null==e?void 0:e.tips)).map((e=>null==e?void 0:e.url)).filter(n))}s.length>0&&((e,t,n={})=>{const l=fe();for(const o of t)l.set(o,{eventType:e,requestData:n,urlRegExp:o instanceof RegExp?o:new RegExp((a=String(o),a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),"g")});var a})(se,s,t)}},Ce=(e,t)=>{if(l(null==e?void 0:e.elements)&&n(null==t?void 0:t.toLanguage)){const l=t.toLanguage;$e(e.elements.flatMap((({element:e})=>a(e)&&[e].concat(e.phrases||[]).concat(e.examples||[]))).filter(a).flatMap((e=>((e,t)=>{var l,o,s,i,r;const u=[],d=e.ttsURL;return n(d)&&u.push(ye(d,t)),u.concat([(null===(l=e.tokenTTS)||void 0===l?void 0:l.tokenTTSCollection)||[],(null===(o=e.text)||void 0===o||null===(s=o.tokenTTS)||void 0===s?void 0:s.tokenTTSCollection)||[],(null===(i=e.subtext)||void 0===i||null===(r=i.tokenTTS)||void 0===r?void 0:r.tokenTTSCollection)||[]].flat().filter(a).map((e=>null==e?void 0:e.ttsURL)).filter((e=>(e=>n(e))&&e!==d)).map((e=>be(e,t))))})(e,l))))}},je=()=>{const e=4<=(Number(c(qe))||0);var t,o,s,i,r,u;!!c(Re)&&e||(e||Ve(),p(qe,4),p(Re,[(u=e=>(e=>{const t=e.learningLanguage;l(null==e?void 0:e.elements)&&$e(e.elements.map((e=>{var t;return(null==e||null===(t=e.line)||void 0===t?void 0:t.content)||(null==e?void 0:e.learningLanguageTitleContent)})).flatMap((e=>[null==e?void 0:e.audio,null==e?void 0:e.audioPrefix,null==e?void 0:e.audioSuffix])).map((e=>null==e?void 0:e.url)).filter(n).map((e=>ye(e,t))))})(e),he(ae,u)),(i=(e,t)=>Ke(e,t),he(oe,i,r)),(s=(e,t)=>((e,t)=>{if(l(null==e?void 0:e.elements)&&n(null==t?void 0:t.toLanguage)){const l=e.elements.map((e=>null==e?void 0:e.element)).flatMap((e=>{var t;return null==e||null===(t=e.tokenTTS)||void 0===t?void 0:t.tokenTTSCollection}));l.push(...e.elements.map((e=>null==e?void 0:e.element)).flatMap((e=>null==e?void 0:e.cells)).flat().flatMap((e=>{var t;return null==e||null===(t=e.tokenTTS)||void 0===t?void 0:t.tokenTTSCollection})));const a=t.toLanguage;$e(l.map((e=>null==e?void 0:e.ttsURL)).filter(n).map((e=>we(e,a))))}})(e,t),he(se,s)),(o=e=>{var t;n(null==(t=e)?void 0:t.tts_url)&&$e([ye(t.tts_url,t.sentence_language)])},he(ie,o)),(t=(e,t)=>Ce(e,t),he(re,t)),_e((e=>(e=>{const t=[];for(const r of e){var o;const e=r.type,u=O(r),d=L(r);if(n(r.tts)){const n=x.indexOf(e)>=0?we:ye;t.push(n(r.tts,u))}if(n(r.slowTts)&&t.push({url:r.slowTts,type:M,speed:K,language:u}),n(r.solutionTts)&&t.push(ye(r.solutionTts,d)),l(r.choices)){const l=-1===x.indexOf(e)?be:we;t.push(r.choices.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>l(e,d))))}if(l(r.tokens)&&t.push(r.tokens.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>be(e,u)))),l(r.displayTokens)&&t.push(r.displayTokens.map((e=>{var t;return null==e||null===(t=e.hintToken)||void 0===t?void 0:t.tts})).filter(n).map((e=>be(e,u)))),l(r.questionTokens)&&t.push(r.questionTokens.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>be(e,d)))),l(null===(o=r.metadata)||void 0===o?void 0:o.speakers))for(const e of r.metadata.speakers){var s,i;a(null===(s=e.tts)||void 0===s?void 0:s.tokens)&&t.push(Object.values(e.tts.tokens).filter((e=>n(e.url))).map((e=>Ee(e,$,d)))),l(null===(i=e.tts)||void 0===i?void 0:i.sentence)&&t.push(e.tts.sentence.filter((e=>n(e.url))).map((e=>Ee(e,M,d))))}if(l(r.pairs)){const l=-1===x.indexOf(e)?be:we;t.push(r.pairs.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>l(e,d))))}l(r.options)&&t.push(r.options.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>be(e,d)))),l(r.dialogue)&&(t.push(r.dialogue.map((e=>null==e?void 0:e.tts)).filter(n).map((e=>ye(e,d)))),t.push(r.dialogue.map((e=>null==e?void 0:e.hintTokens)).filter(l).flat().map((e=>null==e?void 0:e.tts)).filter(n).map((e=>be(e,d)))))}$e(t.flat())})(e.challenges)))]))},Ve=()=>{const e=c(Re);!l(e)||J("sound_initialized")||J(ue)||J(ce)||J(de)||(e.forEach((e=>e())),p(qe,null),p(Re,null))},De=(e,t,n)=>{const l=(e=>{const t=Oe()[e];if(a(t))return t;const n=e.match(ke);return n?be(e,n.language):null})(r(t));return{url:t,type:(null==l?void 0:l.type)||R,speed:(null==l?void 0:l.speed)||E,language:null==l?void 0:l.language,playbackStrategy:n,sound:e}},Ne=(e,t)=>{_("Howl","play",(e=>function(t){var n;p("is_howler_used",!0);const l=String(this._src||(null===(n=this._parent)||void 0===n?void 0:n._src)||"").trim();return""!==l?((e,t,n,l)=>{const a=De(e,t,n);let o=!1;try{var s;o=null===(s=ee(ue,a))||void 0===s?void 0:s.some((e=>!1===e)),ee(o?ce:de,a)}catch(e){k(e,`Could not handle playback for sound "${t}" (using "${n}"): `)}return o?null:l()})(this,l,C,(()=>e.call(this,t))):e.call(this,t)})),je();const n=G(e,t);return()=>{n(),Ve()}};_e((e=>w("session_loaded",e))),Ne(ue,(e=>w("sound_played",null==e?void 0:e.url)))}();
