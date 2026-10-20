/** Forward Google's iOS callback while preserving Expo Router's normal linking. */
const { withAppDelegate, withPlugins } = require("expo/config-plugins");

module.exports = function withGoogleSignIn(config, { iosUrlScheme }) {
  config = withPlugins(config, [
    ["react-native-nitro-google-signin", { iosUrlScheme }],
  ]);
  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== "swift") {
      throw new Error(
        "Fable's Google sign-in plugin requires the Expo Swift AppDelegate.",
      );
    }
    let source = result.modResults.contents;
    if (source.includes("GIDSignIn.sharedInstance.handle(url)")) return result;
    const handler =
      /return (super\.application\(app,\s*open:\s*url,\s*options:\s*options\))/;
    if (!handler.test(source)) {
      throw new Error(
        "Google sign-in could not locate Expo's URL handler. Review AppDelegate before building iOS.",
      );
    }
    if (!source.includes("import GoogleSignIn"))
      source = `import GoogleSignIn\n${source}`;
    result.modResults.contents = source.replace(
      handler,
      "return GIDSignIn.sharedInstance.handle(url) || $1",
    );
    return result;
  });
};
