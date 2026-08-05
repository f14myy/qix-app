//! Bridge to the Android background notification service.
//!
//! The frontend asks for background delivery through these two commands (see
//! `src/lib/net/background.ts`). On Android they call into
//! `ru.qqqix.app.QixNotificationService`, which holds the `/api/events` SSE
//! stream while the app is closed. Every other platform stays connected for as
//! long as it is running, so there is nothing to start.
//!
//! ## JNI context
//!
//! Modern Tauri/tao no longer initialises `ndk_context`, so we obtain the
//! JavaVM and an Application context directly from `MainActivity.kt` via
//! [`init_bridge`]. The Application context (not the Activity) is stored
//! because it outlives any configuration change or activity restart.

#[cfg(target_os = "android")]
mod imp {
    use jni::objects::{GlobalRef, JClass, JObject, JValue};
    use jni::JNIEnv;
    use jni::JavaVM;
    use std::sync::OnceLock;

    const SERVICE_CLASS: &str = "ru.qqqix.app.QixNotificationService";

    /// JavaVM + Application context, set once from `MainActivity.onCreate`.
    struct AndroidCtx {
        vm: JavaVM,
        /// `getApplicationContext()` — outlives any Activity.
        app: GlobalRef,
    }
    // SAFETY: JavaVM and GlobalRef are safe to send between threads;
    // we only read them after the OnceLock is initialised.
    unsafe impl Send for AndroidCtx {}
    unsafe impl Sync for AndroidCtx {}

    static CTX: OnceLock<AndroidCtx> = OnceLock::new();

    /// Called from `MainActivity.onCreate` via JNI to give us the VM and
    /// Application context. Must be called before any Tauri command that
    /// touches the notification service.
    #[no_mangle]
    pub extern "C" fn Java_ru_qqqix_app_MainActivity_initNotificationBridge(
        mut env: JNIEnv,
        activity: JObject, // `this` — the Activity instance
    ) {
        let Ok(vm) = env.get_java_vm() else { return };

        // Application context lives as long as the process.
        let Ok(app_local) = env
            .call_method(
                &activity,
                "getApplicationContext",
                "()Landroid/content/Context;",
                &[],
            )
            .and_then(|v| v.l())
        else {
            return;
        };

        let Ok(app) = env.new_global_ref(app_local) else {
            return;
        };

        let _ = CTX.set(AndroidCtx { vm, app });
    }

    /// Invokes a static method on the service class.
    ///
    /// The class is resolved through the activity's ClassLoader rather than
    /// `find_class`: commands run on a Tokio worker thread, whose JNI
    /// classloader only knows the framework's own classes and would not find
    /// ours.
    fn call_static(method: &str, signature: &str, strings: &[&str]) -> Result<(), String> {
        let ctx = CTX
            .get()
            .ok_or("notification bridge not initialised (initNotificationBridge not called)")?;

        // Безопасно получаем JNIEnv: если поток уже привязан к JVM
        // (например, JavaBridge webview), используем имеющийся контекст.
        // Иначе привязываем на постоянной основе — AttachGuard отсоединял
        // бы системные потоки Android, что роняло ART с SIGABRT.
        let mut env = match ctx.vm.get_env() {
            Ok(env) => env,
            Err(_) => ctx
                .vm
                .attach_current_thread_permanently()
                .map_err(|e| format!("cannot attach thread: {e}"))?,
        };

        // Application context, хранящийся как GlobalRef.
        let context: JObject = unsafe { JObject::from_raw(ctx.app.as_obj().as_raw()) };

        let res = (|| -> Result<(), String> {
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
        })();

        // Очищаем JNI-исключение если оно возникло — иначе ART крашнется.
        if res.is_err() && env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
        }

        res
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
