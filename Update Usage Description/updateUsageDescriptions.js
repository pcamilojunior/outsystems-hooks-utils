const ExtendedConfigParser = require('./utils/extendedConfigParser');
const PlistHelper = require('./utils/plistHelper');

const PREFERENCE_NAME_SUFFIX = 'UsageDescription';

module.exports = async (context) => {
    const platform = context.opts.cordova.platforms[0];

    // Get preferences that describe usage descriptions
    const parser = ExtendedConfigParser.createInstance(context);
    const preferences = parser
        .getPreferenceNames(platform)
        .filter(name => name.endsWith(PREFERENCE_NAME_SUFFIX));

    // In case preferences were found
    // Update Info.plist properties with the values
    if (preferences.length > 0) {
        const plist = new PlistHelper(context);
        plist.load();

        preferences.forEach(key => {
            const value = parser.getPreference(key, platform);

            console.log(`Updating ${key} in Info.plist, with the value defined in the preferences.`);
            plist.editTopLevelProperty(key, value);
        });

        plist.store();
    }
};
