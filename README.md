# Qix — desktop & Android client

A Tauri 2 port of the [qix-www](https://github.com/f14myy/qix-www) messenger. The
screens are copies of the site's, so the app looks and behaves identically — see
[Design parity](#design-parity).

Targets Windows, macOS and Android. It talks to the deployed server over HTTPS;
there is no local database.

## Server requirement

**The app needs a server build that includes the bearer-token support**, added in
`qix-www` alongside this client. The webview runs on its own origin, so the
`qix_session` cookie never reaches the server. Instead:

- login / register / recover return the session id as `token`;
- the app sends it as `Authorization: Bearer <token>`;
- `<img>`, `<video>` and `EventSource` URLs, which cannot carry a header, use
  `?t=<token>` (accepted on GET/HEAD only);
- `hooks.server.ts` answers CORS preflights for the Tauri origins, and
  `vite.config.ts` lists them under `csrf.trustedOrigins` so multipart uploads
  are not rejected.

Deploy that first:

```sh
cd ../qix-www
pnpm build
pm2 reload ecosystem.config.cjs --update-env
```

## Configuration

The server URL is fixed at build time and defaults to `https://qqqix.ru`. There is
no in-app setting for it, deliberately — the site has no such screen, and adding
one would break design parity.

```sh
VITE_QIX_SERVER=https://staging.example.com pnpm build
```

Extra origins can be allowed on the server with `APP_TRUSTED_ORIGINS` (comma
separated) at build time, e.g. a LAN dev URL for testing on a real phone.

## Development

```sh
pnpm install
pnpm tauri dev          # desktop window
pnpm tauri android dev  # on a connected device or emulator
```

`pnpm dev` alone opens the frontend in a browser, which is handy for UI work.
`http://localhost:1420` is in the server's allowed origins, so it talks to the
real API; the token falls back to `localStorage` because the Tauri store is
absent there.

## Building

```sh
pnpm tauri build                                  # Windows: .msi + NSIS .exe
pnpm tauri android build --apk --target aarch64   # Android: release APK
```

Verified outputs: `Qix_1.0.0_x64_en-US.msi`, `Qix_1.0.0_x64-setup.exe`, and an
8.4 MB arm64 release APK.

macOS builds have to run on a Mac (`pnpm tauri build` there produces the `.app`
and `.dmg`); nothing in the code is platform-specific.

### Signing the Android release

`tauri android build` emits `app-universal-release-unsigned.apk`, which no device
will install. Create a keystore once and point Gradle at it:

```sh
keytool -genkey -v -keystore qix-release.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias qix
```

Then `src-tauri/gen/android/keystore.properties` (already gitignored):

```properties
storeFile=/absolute/path/to/qix-release.jks
storePassword=…
keyAlias=qix
keyPassword=…
```

…and a `signingConfigs` block in `src-tauri/gen/android/app/build.gradle.kts`
that reads it. Keep the keystore out of the repo: losing it means never being
able to update the app on a device that has it installed.

### If `android init` is ever re-run

Run it as `pnpm tauri android init`, not through bare `node`. The generated
`buildSrc/.../BuildTask.kt` bakes in whichever runner launched it, and a `node`
value makes Gradle call `node tauri …`, which fails with `MODULE_NOT_FOUND`.
Re-initialising also overwrites `MainActivity.kt`, `AndroidManifest.xml` and
`strings.xml`, all of which carry local changes.

## Architecture

The app reuses `qix-www`'s client source almost unchanged so future site changes
can be re-applied cheaply.

- **`src/lib/net/bootstrap.ts`** wraps global `fetch` and `EventSource`. The ~87
  `fetch('/api/…')` and `new EventSource('/api/…')` call sites carried over from
  the site stay byte-identical; the shim points them at the server and attaches
  the token. A 401 outside `/api/auth/*` raises `qix-unauthorized`, which the root
  layout turns into a sign-out.
- **`src/lib/net/api.ts`** is used by `load` functions instead. SvelteKit captures
  `window.fetch` when its client runtime module loads — before our code runs — so
  the shim never reaches the `fetch` handed to `load`.
- **`src/lib/net/media.ts`** builds `?t=` URLs for anything the webview loads by
  itself. This is the one thing the shims cannot cover, and the only reason a
  handful of components differ from the site's.
- Each `+page.server.ts` became a `+page.ts` calling the API. Two endpoints were
  added server-side for this: `GET /api/chats/[id]` and the extra fields on
  `GET /api/users/[username]`. **Keep them in sync with the page loads they
  mirror.**

### Design parity

The stylesheets in `src/styles/` and `src/app.css` are byte-for-byte copies of the
site's and must stay that way. Verify after any build-config change:

```sh
cmp qix-www/build/client/_app/immutable/assets/*.css \
    qix-app/build/_app/immutable/assets/*.css
```

This is not theoretical: setting `build.cssTarget` in `vite.config.js` made Vite
strip `-webkit-user-select` and `-webkit-backdrop-filter`, which the Android
WebView and WKWebView still need. `target` and `cssTarget` are therefore left at
Vite's defaults, matching the site's pipeline.

Webfonts are vendored into `static/fonts/` rather than loaded from the Google
Fonts CDN, so a failed request cannot change the rendering. Only the four
families that actually render are bundled: Outfit and Syne for Latin, Rubik and
Unbounded for Cyrillic — Outfit and Syne have no Cyrillic glyphs, so Russian text
falls through to the next family in the stack.

## Android specifics

- **Background notifications.** `QixNotificationService` is a foreground service
  holding the same `/api/events` SSE stream the web client uses, turning
  `chat_update`, `message_request` and `call_invite` into native notifications.
  Started from the frontend through a JNI bridge (`src-tauri/src/notifications.rs`),
  restarted after a reboot by `BootReceiver`. Its JNI entry points are protected
  by keep rules in `proguard-rules.pro` — without them R8 renames them and
  notifications break in release builds only.
- **Safe areas.** `MainActivity` feeds real window insets into `--safe-top` /
  `--safe-bottom`. The Android WebView reports `env(safe-area-inset-*)`
  inconsistently, which otherwise puts the top bar under the status bar.
- **Camera and microphone.** wry's chrome client already grants
  `getUserMedia` once the app holds the OS permissions, which the manifest
  declares — so voice messages and calls work without extra code.
- **Attachment caching.** `/api/files/*` is served `immutable` with a one-year
  max-age (attachment ids are minted per upload), so images are not re-downloaded
  over mobile data.
- **Vibration** goes through `navigator.vibrate`, which the WebView supports given
  the `VIBRATE` permission, with the Tauri haptics plugin as a fallback.
