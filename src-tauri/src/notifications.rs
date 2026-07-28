//! Bridge to the Android background notification service.
//!
//! The frontend asks for background delivery through these two commands (see
//! `src/lib/net/background.ts`). On Android they call into
//! `ru.qqqix.app.QixNotificationService`, which holds the `/api/events` SSE
//! stream while the app is closed. Every other platform stays connected for as
//! long as it is running, so there is nothing to start.

#[cfg(target_os = "android")]
mod imp {
    use jni::objects::{JClass, JObject, JValue};
    use jni::JavaVM;

    const SERVICE_CLASS: &str = "ru.qqqix.app.QixNotificationService";

    /// Invokes a static method on the service class.
    ///
    /// The class is resolved through the activity's ClassLoader rather than
    /// `find_class`: commands run on a Tokio worker thread, whose JNI
    /// classloader only knows the framework's own classes and would not find
    /// ours.
    fn call_static(method: &str, signature: &str, strings: &[&str]) -> Result<(), String> {
        let ctx = ndk_context::android_context();
        let vm_ptr = ctx.vm();
        let context_ptr = ctx.context();

        if vm_ptr.is_null() || context_ptr.is_null() {
            return Err("Android JNI context is null".into());
        }

        let vm = unsafe { JavaVM::from_raw(vm_ptr.cast()) }
            .map_err(|e| format!("JavaVM unavailable: {e}"))?;
        let mut env = vm
            .attach_current_thread()
            .map_err(|e| format!("cannot attach thread: {e}"))?;
        let context = unsafe { JObject::from_raw(context_ptr.cast()) };

        let loader = env
            .call_method(&context, "getClassLoader", "()Ljava/lang/ClassLoader;", &[])
            .and_then(|v| v.l())
            .map_err(|e| format!("getClassLoader failed: {e}"))?;

        let class_name: JObject = env
            .new_string(SERVICE_CLASS)
            .map_err(|e| format!("string alloc failed: {e}"))?
            .into();

        let class = env
            .call_method(
                &loader,
                "loadClass",
                "(Ljava/lang/String;)Ljava/lang/Class;",
                &[JValue::Object(&class_name)],
            )
            .and_then(|v| v.l())
            .map_err(|e| format!("loadClass({SERVICE_CLASS}) failed: {e}"))?;

        // Owned first so the JValue borrows stay alive for the call.
        let mut owned: Vec<JObject> = Vec::with_capacity(strings.len());
        for s in strings {
            owned.push(
                env.new_string(s)
                    .map_err(|e| format!("string alloc failed: {e}"))?
                    .into(),
            );
        }

        let mut args: Vec<JValue> = Vec::with_capacity(owned.len() + 1);
        args.push(JValue::Object(&context));
        for obj in &owned {
            args.push(JValue::Object(obj));
        }

        env.call_static_method(JClass::from(class), method, signature, &args)
            .map(|_| ())
            .map_err(|e| format!("{method} failed: {e}"))
    }

    pub fn start(server: &str, token: &str) -> Result<(), String> {
        call_static(
            "start",
            "(Landroid/content/Context;Ljava/lang/String;Ljava/lang/String;)V",
            &[server, token],
        )
    }

    pub fn stop() -> Result<(), String> {
        call_static("stop", "(Landroid/content/Context;)V", &[])
    }
}

#[cfg(not(target_os = "android"))]
mod imp {
    pub fn start(_server: &str, _token: &str) -> Result<(), String> {
        Ok(())
    }

    pub fn stop() -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
pub fn start_notification_service(server: String, token: String) -> Result<(), String> {
    imp::start(&server, &token)
}

#[tauri::command]
pub fn stop_notification_service() -> Result<(), String> {
    imp::stop()
}
