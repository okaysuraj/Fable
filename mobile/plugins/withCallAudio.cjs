const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

module.exports = function withCallAudio(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    application.service = application.service || [];
    let service = application.service.find(
      (item) =>
        item.$["android:name"] === "io.wazo.callkeep.VoiceConnectionService",
    );
    if (!service) {
      service = {
        $: {
          "android:name": "io.wazo.callkeep.VoiceConnectionService",
          "android:label": "Fable",
          "android:permission":
            "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.telecom.ConnectionService" } },
            ],
          },
        ],
      };
      application.service.push(service);
    }
    service.$["android:foregroundServiceType"] = "phoneCall|microphone";
    service.$["android:label"] = "Fable";
    let headless = application.service.find(
      (item) =>
        item.$["android:name"] ===
        "io.wazo.callkeep.RNCallKeepBackgroundMessagingService",
    );
    if (!headless) {
      headless = {
        $: {
          "android:name":
            "io.wazo.callkeep.RNCallKeepBackgroundMessagingService",
          "android:exported": "false",
        },
      };
      application.service.push(headless);
    }
    headless.$["android:exported"] = "false";
    return config;
  });
};
