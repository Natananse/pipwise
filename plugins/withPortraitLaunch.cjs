const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/** Start the protected welcome before JS in portrait; the runtime owner later
 * requests DEFAULT (UNSPECIFIED on Android), allowing normal app rotation.
 * Keep app.json orientation=default so supported orientations remain broad on iOS.
 */
module.exports = function withPortraitLaunch(config) {
  return withAndroidManifest(config, mod => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    activity.$['android:screenOrientation'] = 'portrait';
    return mod;
  });
};
