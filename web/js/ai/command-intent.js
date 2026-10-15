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
/** Ground presentation in explicit speaker stance, never arbitrary word occurrences.
 * Full bounded replies permit a sincere conclusion after explanatory paragraphs.
 * Structured labels are candidates: matching stance wins, contradictions correct it.
 */
export function chooseAnswerReaction(reply,modelReaction='neutral'){
 if(!REACTIONS.includes(modelReaction))modelReaction='neutral';
 if(typeof reply!=='string'||reply.length>2000)return 'neutral';
 const text=reply.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/\*\*|__/g,'').trim();
 if(!text||/^[<>{}\x60"'“>]/.test(text))return 'neutral';
 // Quoted material is not the speaker's own stance (apostrophes inside words survive).
 const unquoted=text.replace(/"[^"\n]*"|“[^”\n]*”|(?:^|\s)'[^'\n]*'|\x60[^\x60]*\x60/g,' ');
 const clauses=unquoted.split(/(?:[.!?]\s+|\n+)/).map(s=>s.trim().replace(/^(?:in conclusion|overall|to conclude|my conclusion is)[,:]\s*/i,''));
 let chosen='neutral';
 for(let s of clauses){
  if(!s||/^[>]/.test(s)||/\b(?:if|unless|assuming|provided|suppose|hypothetically|would agree|might agree|could agree)\b/i.test(s))continue;
  if(/^(?:the (?:word|phrase|example)|say|you (?:could|can|should) say|yes is|no is)\b/i.test(s))continue;
  if(/^(?:i agree|i concur|yes|no)\b.{0,40}\b(?:means|is a (?:word|phrase|statement|particle))\b/i.test(s))continue;
  if(/^(?:yes[,.! ]+)?i (?:can|could|will|would|am|have) (?:walk|run|wave|nod|shake|move|see|inspect|capture|access)\b/i.test(s))continue;
  if(/^(?:yes[,.! ]+)?i(?:'m| am) not sure\b/i.test(s)){chosen='uncertain';continue;}
  if(/^(?:i (?:don't|do not) know\b|i(?:'m| am) (?:not sure|uncertain|unsure)\b|not sure\b|it(?:'s| is) unclear\b|i can't (?:tell|determine|be sure)\b|i have no idea\b)/i.test(s))chosen='uncertain';
  else if(/^i (?:don't|do not) think (?:that(?:'s| is)|you(?:'re| are)) (?:right|correct)\b/i.test(s))chosen='disagree';
  else if(/^(?:no(?:[!.,]|$)|not quite\b|that(?:'s| is) (?:incorrect|not correct|not right)\b|i (?:disagree|do not agree|don't agree|agree with nothing)\b|actually,\s*no\b)/i.test(s)&&!/^no (?:problem|worries|need)\b/i.test(s))chosen='disagree';
  else if(/^(?:(?:yes|absolutely|exactly|correct)(?:[!.,]|$)|you(?:'re| are) (?:right|(?:absolutely |completely )?correct)\b|that(?:'s| is) (?:right|(?:absolutely )?correct)\b|that sounds (?:right|sensible|correct)\b|(?:your|that) assessment is (?:accurate|correct)\b|that makes sense(?:[,.]\s*yes)?(?:[.!]|$)|i (?:agree|concur)\b)/i.test(s)){
   // A nominal yes followed by an explicit negative correction is disagreement.
   chosen=/\bbut\b.{0,80}\b(?:incorrect|wrong|not correct|disagree)\b/i.test(s)?'disagree':'agree';
  }
  else if(/^(?:i(?:'ve| have) (?:got an?|an?) idea\b|here(?:'s| is) (?:an? idea|a possible solution)\b)/i.test(s))chosen='insight';
  else if(/^(?:great news|we did it|hooray|congratulations)\b/i.test(s))chosen='celebrate';
  else if(/^(?:don't worry|do not worry|it will be okay|i(?:'m| am) here for you)\b/i.test(s))chosen='reassure';
  else if(/^(?:wow[!,]|that(?:'s| is) surprising\b|i(?:'m| am) surprised\b)/i.test(s))chosen='surprised';
  else if(/^(?:let me think|i(?:'m| am) thinking)\b/i.test(s)&&modelReaction==='thinking')chosen='thinking';
  else if(/^one possible solution (?:is|would be)\b/i.test(s)&&modelReaction==='insight')chosen='insight';
  else if(/^(?:hello|hi|you're welcome)[!.]*$/i.test(s)&&modelReaction==='reassure')chosen='reassure';
 }
 return chosen;
}
