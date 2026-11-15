//! Loopback OAuth callback. No tokens or credentials are persisted by the desktop shell.
use std::{
    io::{BufRead, BufReader, Read, Write},
    net::{TcpListener, TcpStream},
    sync::{atomic::{AtomicBool, Ordering}, mpsc, Arc, Mutex},
    time::{Duration, Instant},
};

#[derive(Default)]
pub struct SpotifyAuth(Mutex<Option<Arc<Pending>>>);
struct Pending {
    cancel: Arc<AtomicBool>,
    receiver: Mutex<Option<mpsc::Receiver<Result<String, String>>>>,
}

fn parse_callback(target: &str, expected: &str) -> Option<Result<String, String>> {
    let (path, query) = target.split_once('?')?;
    if path != "/callback" { return None; }
    let mut state = None; let mut code = None; let mut error = None;
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        match key.as_ref() {
            "state" if state.is_none() => state = Some(value.into_owned()),
            "code" if code.is_none() => code = Some(value.into_owned()),
            "error" if error.is_none() => error = Some(value.into_owned()),
            "state" | "code" | "error" => return None,
            _ => {}
        }
    }
    if state.as_deref() != Some(expected) { return None; }
    match (code, error) {
        (Some(code), None) if !code.is_empty() && code.len() <= 4096 => Some(Ok(code)),
        (None, Some(_)) => Some(Err("Spotify sign-in was cancelled or denied.".into())),
        _ => None,
    }
}

fn handle(mut stream: TcpStream, expected: &str) -> Option<Result<String, String>> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut first = String::new();
    let result = BufReader::new((&mut stream).take(8192)).read_line(&mut first);
    let target = if result.is_ok() { first.split_whitespace().nth(1) } else { None };
    let parsed = if first.starts_with("GET ") { target.and_then(|s| parse_callback(s, expected)) } else { None };
    let (status, text) = if parsed.is_some() { ("200 OK", "Spotify authorization received. You can close this tab and return to Lucent.") } else { ("400 Bad Request", "Invalid authorization response.") };
    let _ = write!(stream, "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\nX-Content-Type-Options: nosniff\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}", text.len());
    parsed
}

#[tauri::command]
pub fn spotify_auth_start(state: tauri::State<'_, SpotifyAuth>, expected: String) -> Result<String, String> {
    if expected.len() < 32 || expected.len() > 128 || !expected.bytes().all(|b| b.is_ascii_hexdigit()) { return Err("Invalid sign-in state.".into()); }
    let mut slot = state.0.lock().map_err(|_| "Sign-in unavailable.")?;
    if slot.is_some() { return Err("Spotify sign-in is already in progress.".into()); }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "Could not start the local sign-in listener.")?;
    let port = listener.local_addr().map_err(|_| "Could not determine the callback port.")?.port();
    listener.set_nonblocking(true).map_err(|_| "Could not start sign-in.")?;
    let (tx, rx) = mpsc::channel();
    let cancel = Arc::new(AtomicBool::new(false));
    let stop = cancel.clone();
    std::thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(180);
        while Instant::now() < deadline && !stop.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, peer)) if peer.ip().is_loopback() => if let Some(result) = handle(stream, &expected) { let _ = tx.send(result); return; },
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(100)),
                Err(_) => { let _ = tx.send(Err("Spotify sign-in listener failed.".into())); return; },
                _ => {}
            }
        }
        let _ = tx.send(Err("Spotify sign-in timed out or was cancelled.".into()));
    });
    *slot = Some(Arc::new(Pending { cancel, receiver: Mutex::new(Some(rx)) }));
    Ok(format!("http://127.0.0.1:{port}/callback"))
}

#[tauri::command]
pub async fn spotify_auth_wait(state: tauri::State<'_, SpotifyAuth>) -> Result<String, String> {
    let pending = state.0.lock().map_err(|_| "Sign-in unavailable.")?.clone().ok_or("No Spotify sign-in in progress.")?;
    let receiver = pending.receiver.lock().map_err(|_| "Sign-in unavailable.")?.take().ok_or("Already waiting for Spotify.")?;
    let result = tauri::async_runtime::spawn_blocking(move || receiver.recv().unwrap_or_else(|_| Err("Spotify sign-in failed.".into())))
        .await.map_err(|_| "Spotify sign-in failed.")?;
    if let Ok(mut slot) = state.0.lock() {
        if slot.as_ref().is_some_and(|current| Arc::ptr_eq(current, &pending)) { *slot = None; }
    }
    result
}

#[tauri::command]
pub fn spotify_auth_cancel(state: tauri::State<'_, SpotifyAuth>) {
    if let Ok(mut slot) = state.0.lock() { if let Some(pending) = slot.take() { pending.cancel.store(true, Ordering::Relaxed); } }
}

#[cfg(test)]
mod tests {
    use super::parse_callback;
    #[test] fn callback_checks_state_path_and_duplicates() {
        assert_eq!(parse_callback("/callback?state=abc&code=ok", "abc"), Some(Ok("ok".into())));
        assert!(parse_callback("/callback?state=wrong&code=ok", "abc").is_none());
        assert!(parse_callback("/other?state=abc&code=ok", "abc").is_none());
        assert!(parse_callback("/callback?state=abc&state=abc&code=ok", "abc").is_none());
        assert!(parse_callback("/callback?state=abc&error=access_denied", "abc").unwrap().is_err());
    }
}
