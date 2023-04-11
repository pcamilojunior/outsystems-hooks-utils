var fs = require('fs');
var path = require('path');
var glob = require('glob');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var xcode = require('xcode');
var AdmZip = require("adm-zip");

var iosProjFolder;
var iosPbxProjPath;

function jsonToDotStrings(jsonObj) {
    var returnString = '';
    _.forEach(jsonObj, function (val, key) {
        returnString += '"' + key + '" = "' + val + '";\n';
    });
    return returnString;
}
function getZipFile(resourcesFolder, prefZipFilename) {
    try {
        var dirFiles = fs.readdirSync(resourcesFolder);
        var zipFile;
        dirFiles.forEach(function(file) {
            if (file.match(/\.zip$/)) {
                var filename = path.basename(file, ".zip");
                if (filename === prefZipFilename) {
                    zipFile = path.join(resourcesFolder, file);
                }
            }
        });
        return zipFile;
    } catch (error) {
        return undefined;
    }
}

function unzip(zipFile, unzippedTargetDir) {
    var zip = new AdmZip(zipFile);
    zip.extractAllTo(unzippedTargetDir, true);
    return unzippedTargetDir;
}

function getProjectName() {
    var config = fs.readFileSync('config.xml').toString();
    var matches = config.match(/<name>\s*(.*?)\s*<\/name>/i);

    return matches[1];
}

function initIosDir() {
    if (!iosProjFolder || !iosPbxProjPath) {
        var projectName = getProjectName();
        iosProjFolder = 'platforms/ios/' + projectName;
        iosPbxProjPath = 'platforms/ios/' + projectName + '.xcodeproj/project.pbxproj';
        console.log(iosProjFolder)
    }
}

function getTargetIosDir() {
    initIosDir();
    return iosProjFolder;
}

function getXcodePbxProjPath() {
    initIosDir();
    return iosPbxProjPath;
}

function writeStringFile(plistStringJsonObj, lang, fileName, bundle) {
    var lProjPath = getTargetIosDir() + "/Resources/" + (bundle ? bundle + "/" : "") + lang + ".lproj";
    mkdirp(lProjPath).then(function () {
        var stringToWrite = jsonToDotStrings(plistStringJsonObj);
        fs.writeFileSync(path.join(lProjPath, fileName), stringToWrite);
    });
}

function writeLocalisationFieldsToXcodeProj(filePaths, groupName, proj) {
    var fileRefSection = proj.pbxFileReferenceSection();
    var fileRefValues = _.values(fileRefSection);

    if (filePaths.length > 0) {
        var groupKey = proj.findPBXVariantGroupKey({ name: groupName });
        if (!groupKey) {
            // findPBXVariantGroupKey with name InfoPlist.strings not found. creating new group
            var localizableStringVarGroup = proj.addLocalizationVariantGroup(groupName);
            groupKey = localizableStringVarGroup.fileRef;
        }

        filePaths.forEach(function (path) {
            var results = _.find(fileRefValues, function (o) {
                return _.isObject(o) && _.has(o, 'path') && o.path.replace(/['"]+/g, '') === path;
            });
            if (_.isUndefined(results)) {
                // not found in pbxFileReference yet
                proj.addResourceFile('Resources/' + path, { variantGroup: true }, groupKey);
            }
        });
    }
}

module.exports = function (context) {
    var infoPlistPaths = [];
    var localizableStringsPaths = [];
    var settingsBundlePaths = [];

    return getTargetLang(context).then(function (languages) {
        console.log("Found "+languages.length+" Languages!")
        languages.forEach(function (lang) {
            console.log("Started Localization process for "+lang+"!")
            // read the json file
            var langJson = require(lang.path);

            // check the locales to write to
            var localeLangs = [];
            if (_.has(langJson, 'locale') && _.has(langJson.locale, 'ios')) {
                // iterate the locales
                _.forEach(langJson.locale.ios, function (aLocale) {
                    localeLangs.push(aLocale);
                });
            } else {
                // use the default lang from the filename, for example "en" in en.json
                localeLangs.push(lang.lang);
            }

            _.forEach(localeLangs, function (localeLang) {
                if (_.has(langJson, 'config_ios')) {
                    // do processing for appname into plist
                    var plistString = langJson.config_ios;
                    if (!_.isEmpty(plistString)) {
                        writeStringFile(plistString, localeLang, 'InfoPlist.strings');
                        infoPlistPaths.push(localeLang + '.lproj/' + 'InfoPlist.strings');
                    }
                }

                // remove APP_NAME and write to Localizable.strings
                if (_.has(langJson, 'app')) {
                    // do processing for appname into plist
                    var localizableStringsJson = langJson.app;

                    // ios specific strings
                    if (_.has(langJson, 'app_ios')) {
                        Object.assign(localizableStringsJson, langJson.app_ios);
                    }

                    if (!_.isEmpty(localizableStringsJson)) {
                        writeStringFile(localizableStringsJson, localeLang, 'Localizable.strings');
                        localizableStringsPaths.push(localeLang + '.lproj/' + 'Localizable.strings');
                    }
                }
                    
                // to create Settings.bundle localizations
                if (_.has(langJson, "settings_ios")) {
                    var localizableSettingsJson = langJson.settings_ios;
                    if (!_.isEmpty(localizableSettingsJson)) {
                        _.each(localizableSettingsJson, function (value, key) {
                            var settingsFileName = key + ".strings";
                            var localizableSettingsStringsRoot = value;
                            
                            if (!_.isEmpty(localizableSettingsStringsRoot)) {
                                writeStringFile(localizableSettingsStringsRoot, localeLang, settingsFileName, "Settings.bundle");
                                settingsBundlePaths.push("Settings.bundle" + localeLang + ".lproj/" + settingsFileName);
                            }
                        });
                    }
                }
            });
        });

        var pbxProjPath = getXcodePbxProjPath();
        var proj = xcode.project(pbxProjPath);

        return new Promise(function (resolve, reject) {
            proj.parse(function (error) {
                if (error) {
                    reject(error);
                }

                writeLocalisationFieldsToXcodeProj(infoPlistPaths, 'InfoPlist.strings', proj);
                writeLocalisationFieldsToXcodeProj(localizableStringsPaths, 'Localizable.strings', proj);

                fs.writeFileSync(pbxProjPath, proj.writeSync());
                console.log('Pbx project written with localization groups', _.map(languages, 'lang'));

                var platformPath = path.join(context.opts.projectRoot, 'platforms', 'ios');
                var projectFileApi = require(path.join(platformPath, '/cordova/lib/projectFile.js'));
                projectFileApi.purgeProjectFileCache(platformPath);

                resolve();
            });
        });
    });
};

function getTargetLang(context) {
    var targetLangArr = [];

    var providedTranslationPathPattern;
    var providedTranslationPathRegex;
    var PATH = path.join("platforms","ios","www","localizationStrings");

    if(!fs.existsSync(PATH)){
        console.log("Localization Path not found!")
        return new Promise(function (resolve, reject){
            resolve(targetLangArr);
        })
    }


    console.log("Unziping Localizations Started!")

    var zipFile = getZipFile(PATH, "localizations");

    if (!zipFile) {
        console.log("localizations.zip not found. Skipping Localization initialization.");
        return resolve();
    }
    unzip(zipFile, PATH);
    console.log("Unziping Localizations Successfull!")

    providedTranslationPathPattern = PATH + '/*.json';
    providedTranslationPathRegex = new RegExp(PATH + '/(.*).json');
    return new Promise(function (resolve, reject) {
        glob(providedTranslationPathPattern, function (error, langFiles) {
            if (error) {
                console.log("Localization Path error!")
                reject(error);
            }
            langFiles.forEach(function (langFile) {
                var matches = langFile.match(providedTranslationPathRegex);
                if (matches) {
                    targetLangArr.push({
                        lang: matches[1],
                        path: path.join(context.opts.projectRoot, langFile)
                    });
                }
            });
            resolve(targetLangArr);
        });
    });
}