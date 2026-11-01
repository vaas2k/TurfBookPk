const { withAppBuildGradle } = require('expo/config-plugins');

const objectPathConfig = `
        // Keep React Native's generated C++ object paths below Windows MAX_PATH.
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=250"
            }
        }`;

const stagingConfig = `
    externalNativeBuild {
        cmake {
            // Keep New Architecture build files out of the deeper app directory.
            buildStagingDirectory file("\${rootDir}/.cxx/app")
        }
    }`;

module.exports = function withWindowsAndroidCmakePaths(config) {
  return withAppBuildGradle(config, (buildGradleConfig) => {
    if (buildGradleConfig.modResults.language !== 'groovy') {
      throw new Error('with-windows-android-cmake-paths requires a Groovy app/build.gradle');
    }

    let contents = buildGradleConfig.modResults.contents;

    if (!contents.includes('CMAKE_OBJECT_PATH_MAX=250')) {
      contents = contents.replace(
        /(buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL",[^\n]+\n)/,
        `$1${objectPathConfig}\n`,
      );
    }

    if (!contents.includes('buildStagingDirectory file("${rootDir}/.cxx/app")')) {
      contents = contents.replace(
        /(    androidResources \{[\s\S]*?\n    \})\n\}/,
        `$1${stagingConfig}\n}`,
      );
    }

    buildGradleConfig.modResults.contents = contents;
    return buildGradleConfig;
  });
};
