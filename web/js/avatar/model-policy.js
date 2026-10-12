export const MODEL_MODES=Object.freeze(['auto','classic','slim']);

export function normalizeModelMode(value){
 return MODEL_MODES.includes(value)?value:'auto';
}

export function toSkinViewModel(mode){
 const normalized=normalizeModelMode(mode);
 if(normalized==='classic')return 'default';
 if(normalized==='slim')return 'slim';
 return 'auto-detect';
}

export function fromSkinViewModel(value){
 return value==='slim'?'slim':'classic';
}

export function describeModel(mode,detected){
 const selected=normalizeModelMode(mode);
 const actual=fromSkinViewModel(detected);
 if(selected==='auto')return 'Detected '+(actual==='slim'?'Slim (3px)':'Classic (4px)');
 return (selected==='slim'?'Slim (3px)':'Classic (4px)')+' · manual';
}
