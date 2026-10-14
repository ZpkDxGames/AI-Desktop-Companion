/** Conservative offline avatar commands. No arbitrary phrase execution or model inference. */
import {REACTIONS} from './local-conversation.js';
const COMMANDS=Object.freeze([
 ['walk',/^(?:walk(?: in place)?|start walking|(?:do|show me|show) (?:a|the|your) walking animation)$/,'Starting a walking animation in place. Say “Stop walking” to return to idle.'],
 ['run',/^(?:run(?: in place)?|start running|(?:do|show me|show) (?:a|the|your) running animation)$/,'Starting a running animation in place. Say “Stop running” to return to idle.'],
 ['shake',/^(?:shake (?:your|its|the) head(?: no)?|(?:give|show) me a head shake|(?:make|have) (?:your|the) avatar shake (?:its|their) head)$/,'Okay — shaking my head.'],
 ['nod',/^(?:nod(?: (?:your|the) head)?(?: in agreement)?|(?:give|show) me a nod|(?:make|have) (?:your|the) avatar nod(?: (?:its|their) head)?)$/,'Okay — nodding.'],
 ['shrug',/^(?:shrug(?: (?:your|the) shoulders)?|(?:give|show) me a shrug)$/,'Okay — shrugging.'],
 ['wave',/^(?:wave(?: (?:hello|hi|goodbye|at me|your hand))?|(?:give|show) me a wave)$/,'Okay — waving.'],
 ['think',/^(?:think(?: for a (?:moment|second|while))?|(?:show|do) (?:a|your) thinking (?:pose|animation))$/,'Okay — thinking.'],
 ['look',/^(?:look around|(?:do|show me) (?:a|the) look around animation)$/,'Okay — looking around.'],
 ['celebrate',/^(?:celebrate|(?:do|show me) (?:a|the) celebration(?: animation)?)$/,'Okay — celebrating.'],
 ['sit',/^(?:sit|sit down|take a seat)$/,'Okay — sitting down.'],
 ['idle',/^(?:stand up|stand still|go back to idle|stop(?: animating| walking| running| moving| the animation)?|return to idle)$/,'Okay — returning to idle.'],
 ['jump',/^(?:jump|jump up|(?:do|show me) a jump)$/,'Okay — jumping.'],
 ['stretch',/^(?:stretch|stretch (?:your|the) arms|(?:do|show me) a stretch)$/,'Okay — stretching.'],
 ['bow',/^(?:bow|take a bow|(?:do|show me) a bow)$/,'Okay — taking a bow.'],
 ['read',/^(?:read(?: a book)?|(?:show|do) (?:a|your) reading animation)$/,'Okay — reading a book.'],
 ['eat',/^(?:eat|eat something|have a snack)$/,'Okay — eating.'],
 ['drink',/^(?:drink|drink some water|take a sip)$/,'Okay — taking a drink.']
]);
export const DIRECT_ACTIONS=Object.freeze(COMMANDS.map(([action])=>action));
export function parseCommandIntent(input){
 const text={kind:'text'};
 if(typeof input!=='string'||input.length>160||/[<>{}\n\r\x60"]/u.test(input))return text;
 let s=input.normalize('NFKC').toLowerCase().replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ').trim();
 if(!s||s.split(/[?!]/).length>2||/[?!.]\s+\S/.test(s))return text;
 s=s.replace(/[.!?]+$/g,'').trim();
 if(/\b(?:don't|do not|doesn't|cannot|can't|never|avoid|without|instead of|not)\b/.test(s))return text;
 if(/^(?:why|what|how|when|where|which|who|is it|do you know|explain|describe|tell me about|what if)\b/.test(s))return text;
 s=s.replace(/^(?:(?:hey|hi)(?: (?:friend|companion|buddy))?[, ]+)?(?:please[, ]+)?/,'');
 s=s.replace(/^(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?|i(?:'d| would) like you to\s+|i want you to\s+|go ahead and\s+|try to\s+|please\s+)/,'');
 s=s.replace(/^show me how you\s+/,'');
 s=s.replace(/(?:,?\s+please|\s+for me)$/,'').trim();
 const result=COMMANDS.filter(([_,pattern])=>pattern.test(s));
 if(result.length===1)return {kind:'direct',action:result[0][0],reply:result[0][2]};
 // Only complete allowlisted action clauses followed by unsupported choreography
 // are ambiguous. This is not whole-message keyword matching or another parser.
 const clause=s.match(/^(.{1,80}?)\s+(?:and|while|to the (?:left|right)|to my screen)\b/);
 return clause&&COMMANDS.some(([_,pattern])=>pattern.test(clause[1]))?{kind:'ambiguous'}:text;
}
/** Compatibility facade for existing callers; the grammar has one owner. */
export function detectDirectAnimation(input){
 const intent=parseCommandIntent(input);
 return intent.kind==='direct'?{action:intent.action,reply:intent.reply}:null;
}
/** Response wording only influences allowlisted presentation labels, never capabilities. */
export function chooseAnswerReaction(reply,modelReaction='neutral'){
 if(!REACTIONS.includes(modelReaction))modelReaction='neutral';
 if(typeof reply!=='string')return 'neutral';
 const s=reply.trim().replace(/[\u2018\u2019]/g,"'").slice(0,220);
 if(!s||/^[<>{}\x60"'“]/.test(s))return 'neutral';
 // Literal examples, conditions and capability discussion are not performed actions.
 if(/^(?:(?:yes|no|absolutely|correct|exactly)[,.! ]+)?(?:if|unless|assuming|provided|suppose)\b/i.test(s)||
    /^(?:yes[,.! ]+)?i (?:can|could|will|would|am|have) (?:walk|run|wave|nod|shake|move)\b/i.test(s))return 'neutral';
 if(/^(?:i (?:don't|do not) know\b|i(?:'m| am) (?:not sure|uncertain)\b|not sure\b|it(?:'s| is) unclear\b|i can't (?:tell|determine|be sure)\b)/i.test(s))return 'uncertain';
 if(/^(?:(?:yes|absolutely|exactly|correct)(?:[!.,]|$)|you(?:'re| are) right\b|i agree\b)/i.test(s))return 'agree';
 if(/^(?:no(?:[!.,]|$)|not quite\b|that's (?:incorrect|not correct)\b|i disagree\b|actually,\s*no\b)/i.test(s)&&!/^no (?:problem|worries|need)\b/i.test(s))return 'disagree';
 if(/^(?:i(?:'ve| have) (?:got an?|an?) idea\b|here(?:'s| is) (?:an? idea|a possible solution)\b)/i.test(s))return 'insight';
 // Unsupported certainty labels cannot turn an ordinary explanation into agreement.
 return ['thinking','celebrate','reassure','surprised'].includes(modelReaction)?modelReaction:'neutral';
}
