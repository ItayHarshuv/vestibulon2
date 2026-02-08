# Rebuild vestibulon with T3 stack

##TODO

- [x] Deploy
- [x] Setup database
- [x] Add login authentication (w/ clerk)
- [X] Make UI homepage
- [ ] Build on ios and android (w/ capacitor)
- [ ] Configure styling
- [ ] Routing/clock page (parralel route?)
- [ ] Learn about Server actions

##Optinal Future TODOs

- [ ] Error management (w/ Sentry)
- [ ] Analytics (posthog)

## Capacitor (iOS/Android)

1. Install deps:
   - `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. Build the static export:
   - `npm run build`
3. Add native platforms (first time only):
   - `npx cap add android`
   - `npx cap add ios`
4. Sync web build into native projects:
   - `npm run cap:sync`
5. Open native projects:
   - `npm run cap:android`
   - `npm run cap:ios`

