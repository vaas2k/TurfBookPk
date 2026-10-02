# Welcome to your Expo app 👋

Expo Router app for TurfBookPK players and ground vendors.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Set `EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:5000/api` in `.env` for a physical device, then start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go) for UI-only testing. Android remote notifications require an EAS development or release build.

Routes are under `src/app/`. The MVP uses Pakistani phone-number OTP only; Google Sign-In and Sign in with Apple are deferred.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

TurfBookPK contributors should not run this starter-template command.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Project validation and security

```bash
npm run lint
npx tsc --noEmit
```

Never commit `.env`, `google-services.json`, service-account files, or credentials. Media upload goes through the backend’s provider-neutral upload API, currently backed by Cloudinary.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
