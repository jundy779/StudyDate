# StudyDate Mobile

Satu codebase Expo/React Native untuk dua target native:

- `android/` menghasilkan AAB/APK untuk Google Play Console.
- `ios/` menghasilkan IPA untuk TestFlight dan App Store Connect.

UI dan runtime mobile dibagi di `src/`; jangan membuat dua frontend terpisah
untuk Android dan iOS.

## Setup

```bash
npm install
copy .env.example .env.local
npm run prebuild
```

Isi hanya variabel public Supabase di `.env.local`. Service-role key, SMTP,
payment secret, ticket secret, dan credential server lain tidak boleh masuk
aplikasi mobile.

## Development

```bash
npm start
npm run android
npm run ios
```

Android dapat dijalankan dari Windows dengan Android Studio. iOS lokal
memerlukan macOS/Xcode; dari Windows gunakan EAS Build setelah akun Apple dan
signing tersedia.

## Store build

```bash
npx eas login
npx eas build:configure
npm run build:android
npm run build:ios
```

Artefak production:

- Android: signed `.aab`.
- iOS: signed `.ipa`.

Submission tetap membutuhkan listing, privacy declarations, screenshot, review
account, signing, serta Play/App Store billing untuk akses Plus digital.

## Batas foundation

Kerangka ini belum mengaktifkan auth, production data, push, kamera, billing,
atau deep-link callback server. Tambahkan hanya saat flow terkait dibuat dan
diuji lintas platform.
