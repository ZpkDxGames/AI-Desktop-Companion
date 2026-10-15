//! Explicit, Windows-WebView-independent local Ollama transport.
//! Fixed 127.0.0.1 destination; no URL, host, path, credential or tool forwarding.
//! No request occurs until a user invokes Connect or Send in the Workspace.
use std::{collections::{HashMap, VecDeque}, sync::Mutex, time::Duration};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{State, WebviewWindow};
use tokio::sync::oneshot;

const BASE: &str = "http://127.0.0.1:11434";
const MAX_BYTES: usize = 128 * 1024;
const MAX_MESSAGES: usize = 14;
const MAX_USER_INPUT: usize = 2400;

#[derive(Default)]
pub(crate) struct PendingRequests(pub Mutex<RequestState>);
#[derive(Default)]
pub(crate) struct RequestState {
    active: HashMap<String, oneshot::Sender<()>>,
    cancelled: VecDeque<String>,
    resident_model: Option<String>,
    pub(crate) prepared: Option<crate::vision::PreparedImage>,
    pub(crate) preparing: Option<String>,
    pub(crate) image_epoch: u64,
    pub(crate) decoding: bool,
    pub(crate) active_image: Option<(String,String)>,
}
impl RequestState {
    pub(crate) fn active_is_empty(&self) -> bool { self.active.is_empty() }
    pub(crate) fn register(&mut self, id: &str, sender: oneshot::Sender<()>) -> Result<(), String> {
        if self.cancelled.iter().any(|s| s == id) { return Err("Local request cancelled".into()); }
        if !self.active.is_empty() { return Err("Another local request is already running".into()); }
        self.active.insert(id.to_owned(), sender); Ok(())
    }
    pub(crate) fn cancel(&mut self, id: String) -> bool {
        if !self.cancelled.contains(&id) {
            if self.cancelled.len() == 16 { self.cancelled.pop_front(); }
            self.cancelled.push_back(id.clone());
        }
        // Keep the slot until the cancelled request's async task actually exits.
        if let Some(sender) = self.active.get_mut(&id) {
            let (dummy, _) = oneshot::channel();
            let _ = std::mem::replace(sender, dummy).send(()); true
        } else { false }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ChatMessage {
    role: String,
    content: String,
}

pub(crate) fn workshop_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "workshop" {
        return Err("Ollama commands are restricted to the Workspace".into());
    }
    Ok(())
}

pub(crate) fn valid_model(model: &str) -> bool {
    let mut chars = model.chars();
    let first = chars.next();
    !model.is_empty() && model.len() <= 80
        && first.is_some_and(|c| c.is_ascii_alphanumeric())
        && model.chars().all(|c| c.is_ascii_alphanumeric() || "._:/-".contains(c))
        && !model.contains("..") && !model.contains("://") && !model.ends_with(":cloud")
}

pub(crate) fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn valid_messages(messages: &[ChatMessage]) -> bool {
    if messages.len() < 2 || messages.len() > MAX_MESSAGES
        || messages.first().is_none_or(|m| m.role != "system")
        || messages.last().is_none_or(|m| m.role != "user") {
        return false;
    }
    let mut total = 0usize;
    for (index, message) in messages.iter().enumerate() {
        if (index == 0 && message.role != "system")
            || (index > 0 && message.role != "user" && message.role != "assistant")
            || message.content.is_empty()
            || message.content.chars().count() > if index == 0 { 1400 } else { MAX_USER_INPUT }
        {
            return false;
        }
        total += message.content.len();
        if total > 28_000 { return false; }
    }
    true
}

fn client(timeout: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(timeout))
        .build()
        .map_err(|_| "Unable to initialize local Ollama transport".into())
}

fn transport_error(error: reqwest::Error) -> String {
    if error.is_timeout() { "Local Ollama request timed out".into() }
    else if error.is_connect() { "Ollama is not listening on 127.0.0.1:11434".into() }
    else { "Local Ollama request failed; check the server status".into() }
}

async fn read_json(mut response: reqwest::Response) -> Result<Value, String> {
    if !response.status().is_success() {
        return Err(format!("Ollama responded with HTTP {}", response.status().as_u16()));
    }
    if response.content_length().is_some_and(|len| len > MAX_BYTES as u64) {
        return Err("Local Ollama reply exceeds the size limit".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(transport_error)? {
        if bytes.len().saturating_add(chunk.len()) > MAX_BYTES {
            return Err("Local Ollama reply exceeds the size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid JSON from local Ollama".into())
}

#[tauri::command]
pub(crate) async fn ollama_list_models(window: WebviewWindow) -> Result<Vec<String>, String> {
    workshop_only(&window)?;
    let response = client(9)?
        .get(format!("{BASE}/api/tags"))
        .send().await.map_err(transport_error)?;
    let result = read_json(response).await?;
    let entries = result.get("models").and_then(Value::as_array)
        .ok_or("Invalid Ollama model listing")?;
    let mut models = Vec::new();
    for entry in entries {
        if let Some(name) = entry.get("name").and_then(Value::as_str) {
            if valid_model(name) && !models.iter().any(|s: &String| s == name) {
                models.push(name.to_owned());
                if models.len() >= 64 { break; }
            }
        }
    }
    Ok(models)
}

// Metadata is read only after explicit Connect/Send. Never returns templates or prompts.
fn local_metadata(data: &Value) -> bool {
    data.get("remote_model").is_none_or(|v| v.is_null() || v.as_str() == Some(""))
        && data.get("remote_host").is_none_or(|v| v.is_null() || v.as_str() == Some(""))
}
async fn show_model(http: &reqwest::Client, model: &str) -> Result<Value, String> {
    read_json(http.post(format!("{BASE}/api/show")).json(&json!({"model":model}))
        .send().await.map_err(transport_error)?).await
}
async fn require_local_model(http: &reqwest::Client, model: &str) -> Result<(), String> {
    let data = show_model(http, model).await?;
    if !local_metadata(&data) { return Err("Remote/cloud models are unsupported".into()); }
    if !data.get("capabilities").and_then(Value::as_array)
        .is_some_and(|values| values.iter().any(|v| v.as_str() == Some("completion"))) {
        return Err("Installed model does not advertise completion capability".into());
    }
    Ok(())
}
#[tauri::command]
pub(crate) async fn ollama_model_info(window: WebviewWindow, model: String) -> Result<Value, String> {
    workshop_only(&window)?;
    if !valid_model(&model) { return Err("Invalid local model".into()); }
    let data = show_model(&client(9)?, &model).await?;
    let capabilities: Vec<&str> = data.get("capabilities").and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_str)
            .filter(|s| ["completion","vision","thinking"].contains(s)).collect()).unwrap_or_default();
    Ok(json!({"capabilities":capabilities,"local":local_metadata(&data)}))
}

pub(crate) fn retention_seconds(value: u32) -> Result<u32, String> {
    if [0, 30, 60].contains(&value) { Ok(value) }
    else { Err("Invalid model retention policy".into()) }
}
fn duration_ms(value: Option<&Value>) -> Option<f64> {
    value.and_then(Value::as_u64).map(|n| (n as f64 / 1_000_000.0).min(120_000.0))
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatResult {
    pub(crate) content: String,
    load_ms: Option<f64>,
    generation_ms: Option<f64>,
}
async fn release_model(http: &reqwest::Client, model: &str) -> Result<(), String> {
    // Only a model previously validated by this native transport is released.
    require_local_model(http, model).await?;
    read_json(http.post(format!("{BASE}/api/generate"))
        .json(&json!({"model":model,"stream":false,"keep_alive":0}))
        .send().await.map_err(transport_error)?).await?;
    Ok(())
}
#[tauri::command]
pub(crate) async fn ollama_chat(
    window: WebviewWindow,
    pending: State<'_, PendingRequests>,
    model: String,
    messages: Vec<ChatMessage>,
    request_id: String,
    retention_seconds: u32,
) -> Result<ChatResult, String> {
    workshop_only(&window)?;
    if !valid_model(&model) || !valid_id(&request_id) || !valid_messages(&messages) {
        return Err("Invalid local model, conversation payload, or request identifier".into());
    }
    run_chat(&pending, model, serde_json::to_value(messages).map_err(|_| "Invalid conversation")?, request_id, retention_seconds, false).await
}

// Internal validated messages only: never exposed as a flexible native command payload.
pub(crate) async fn run_chat(
    pending: &PendingRequests, model: String, messages: Value,
    request_id: String, retention_seconds: u32, vision: bool,
) -> Result<ChatResult, String> {
    let keep_alive = self::retention_seconds(retention_seconds)?;
    let (tx, rx) = oneshot::channel();
    {
        let mut pending_requests = pending.0.lock().map_err(|_| "Request state unavailable")?;
        pending_requests.register(&request_id, tx)?;
    }
    let result = tokio::select! {
        _ = rx => Err("Local request cancelled".into()),
        _ = tokio::time::sleep(Duration::from_secs(120)) => Err("Local Ollama request timed out".into()),
        result = async {
            let http = client(120)?;
            require_local_model(&http, &model).await?;
            if vision {
                let data = show_model(&http, &model).await?;
                if !local_metadata(&data) || !data.get("capabilities").and_then(Value::as_array)
                    .is_some_and(|a| a.iter().any(|v| v.as_str() == Some("vision"))) {
                    return Err("Selected local model has no verified vision capability. No image was analyzed.".into());
                }
            }
            let previous = pending.0.lock().map_err(|_| "Request state unavailable")?.resident_model.clone();
            if let Some(previous) = previous.filter(|previous| previous != &model) {
                release_model(&http, &previous).await?;
                pending.0.lock().map_err(|_| "Request state unavailable")?.resident_model = None;
            }
            // Record before sending: even interrupted inference can leave a bounded resident model.
            if keep_alive > 0 || vision {
                pending.0.lock().map_err(|_| "Request state unavailable")?.resident_model = Some(model.clone());
            }
            let response = http
                .post(format!("{BASE}/api/chat"))
                .json(&json!({
                    "model": model,
                    "stream": false,
                    "think": false,
                    "format": {
                        "type": "object",
                        "properties": {
                            "reply": {"type": "string", "maxLength": 1600},
                            "reaction": {"type": "string", "enum": ["neutral","agree","disagree","uncertain","thinking","insight","celebrate","reassure","surprised"]}
                        },
                        "required": ["reply","reaction"],
                        "additionalProperties": false
                    },
                    "options": {"num_predict": 450, "num_ctx": 4096, "temperature": 0.7},
                    "keep_alive": keep_alive,
                    "messages": messages
                }))
                .send().await.map_err(transport_error)?;
            let content = read_json(response).await?;
            if keep_alive == 0 {
                pending.0.lock().map_err(|_| "Request state unavailable")?.resident_model = None;
            }
            let text = content.pointer("/message/content").and_then(Value::as_str)
                .ok_or_else(|| "Ollama response missing assistant text".to_owned())?;
            let text = if vision { crate::vision::validated_reply(text)? } else { text.to_owned() };
            Ok(ChatResult { content: text, load_ms: duration_ms(content.get("load_duration")),
                generation_ms: duration_ms(content.get("eval_duration")) })
        } => result,
    };
    pending.0.lock().map_err(|_| "Request state unavailable")?.active.remove(&request_id);
    result
}

#[tauri::command]
pub(crate) fn ollama_cancel(
    window: WebviewWindow,
    pending: State<'_, PendingRequests>,
    request_id: String,
) -> Result<bool, String> {
    workshop_only(&window)?;
    if !valid_id(&request_id) { return Err("Invalid cancellation identifier".into()); }
    let mut requests = pending.0.lock().map_err(|_| "Request state unavailable")?;
    Ok(requests.cancel(request_id))
}

// Called by native window lifecycle even when JS is suspended. Request slots stay reserved
// until their tasks exit, so cleanup can never cancel an unrelated replacement request.
pub(crate) fn discard_workspace(pending: &PendingRequests) {
    if let Ok(mut state) = pending.0.lock() {
        state.image_epoch = state.image_epoch.wrapping_add(1);
        state.prepared = None;
        state.preparing = None;
        let ids: Vec<String> = state.active.keys().cloned().collect();
        for id in ids { state.cancel(id); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn model_retention_is_finite_and_telemetry_is_content_free() {
        for value in [0, 30, 60] { assert_eq!(retention_seconds(value).unwrap(), value); }
        for value in [1, 31, 600, u32::MAX] { assert!(retention_seconds(value).is_err()); }
        assert_eq!(duration_ms(Some(&json!(1_000_000))), Some(1.0));
        assert_eq!(duration_ms(Some(&json!(-1))), None);
        assert_eq!(duration_ms(None), None);
    }
    #[test]
    fn model_names_cannot_carry_urls_paths_or_credentials() {
        assert!(valid_model("llama3.2:3b"));
        for invalid in ["", "../private", "http://127.0.0.1:9999", "bad name", "x@host", "/api/tags"] {
            assert!(!valid_model(invalid), "{invalid}");
        }
    }
    #[test]
    fn incoming_chat_messages_are_bounded_and_role_limited() {
        let system = ChatMessage { role: "system".into(), content: "Local assistant".into() };
        let user = ChatMessage { role: "user".into(), content: "Hello".into() };
        assert!(valid_messages(&[system, user]));
        assert!(!valid_messages(&[ChatMessage{role:"user".into(),content:"Hello".into()}]));
        assert!(!valid_id("../../../"));
        assert!(valid_id("v6-2a38e"));
    }
    #[test]
    fn cloud_aliases_are_rejected_by_actual_metadata() {
        assert!(local_metadata(&json!({"capabilities":["completion","vision"]})));
        assert!(!local_metadata(&json!({"remote_model":"qwen", "remote_host":"https://ollama.com"})));
        assert!(!valid_model("qwen:cloud"));
        assert!(serde_json::from_value::<ChatMessage>(json!({"role":"user","content":"hi","images":["x"]})).is_err());
    }
    #[test]
    fn cancellation_before_registration_and_active_overlap_are_bounded() {
        let mut state = RequestState::default();
        state.cancel("v6-before".into());
        assert!(state.register("v6-before", oneshot::channel().0).is_err());
        assert!(state.register("v6-first", oneshot::channel().0).is_ok());
        assert!(state.register("v6-second", oneshot::channel().0).is_err());
        assert!(state.cancel("v6-first".into()));
        assert!(state.register("v6-second", oneshot::channel().0).is_err());
        state.active.remove("v6-first");
        assert!(state.register("v6-second", oneshot::channel().0).is_ok());
        for i in 0..100 { state.cancel(format!("cancel-{i}")); }
        assert_eq!(state.cancelled.len(), 16);
    }

}
