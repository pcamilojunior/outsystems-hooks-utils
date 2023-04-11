var fs = require('fs');
var path = require('path');
var glob = require('glob');
var mkdirp = require('mkdirp');
var _ = require('underscore');
var xml2js = require('xml2js');
var AdmZip = require("adm-zip");

function fileExists(path) {
    try {
        return fs.statSync(path).isFile();
    } catch (e) {
        return false;
    }
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

module.exports = function (context) {
    console.log("Started Localization process!")
    return getTargetLang(context).then(function (languages) {
        console.log("Found "+languages.length+" Languages!")
        var promisesToRun = [];

        languages.forEach(function (lang) {
            console.log("Started Localization process for "+lang+"!")
            // read the json file
            var langJson = require(lang.path);

            // check the locales to write to
            var localeLangs = [];
            if (_.has(langJson, 'locale') && _.has(langJson.locale, 'android')) {
                // iterate the locales
                _.forEach(langJson.locale.android, function (aLocale) {
                    localeLangs.push(aLocale);
                });
            } else {
                // use the default lang from the filename, for example "en" in en.json
                localeLangs.push(lang.lang);
            }

            _.forEach(localeLangs, function (localeLang) {
                var stringXmlFilePath = getLocalStringXmlPath(context, localeLang);
                var parser = new xml2js.Parser();

                var stringXmlJson;
                if (!fileExists(stringXmlFilePath)) {
                    stringXmlJson = {
                        resources: {
                            string: []
                        }
                    };
                    promisesToRun.push(processResult(context, localeLang, langJson, stringXmlJson));
                } else {
                    promisesToRun.push(
                        new Promise(function (resolve, reject) {
                            // lets read from strings.xml into json
                            fs.readFile(stringXmlFilePath, function (err, data) {
                                if (err) {
                                    return reject(err);
                                }

                                parser.parseString(data, function (err, result) {
                                    if (err) {
                                        return reject(err);
                                    }

                                    stringXmlJson = result;

                                    // initialize xmlJson to have strings
                                    if (!_.has(stringXmlJson, 'resources') || !_.has(stringXmlJson.resources, 'string')) {
                                        stringXmlJson.resources = {
                                            string: []
                                        };
                                    }

                                    processResult(context, localeLang, langJson, stringXmlJson).then(resolve, reject);
                                });
                            });
                        })
                    );
                }
            });
        });

        return Promise.all(promisesToRun);
    });
};

function getTargetLang(context) {
    var targetLangArr = [];

    var providedTranslationPathPattern;
    var providedTranslationPathRegex;
    var PATH = path.join("platforms","android","app","src","main","assets","www","localizationStrings");

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

function getLocalStringXmlPath(context, lang) {
    var resPath = getResPath(context);
    var defaultLocale = getDefaultLocale();
    return path.normalize(path.join(resPath, 'values' + (lang !== defaultLocale ? '-' + lang : ''), 'strings.xml'));
}

function getResPath(context) {
    return path.join(context.opts.projectRoot, 'platforms/android//app/src/main/res');
}

function getDefaultLocale() {
    var config = fs.readFileSync('config.xml').toString();
    var matches = config.match(new RegExp('<widget[^>]*?defaultlocale="(.*?)"[\\s\\S]*?>', 'i'));
    return (matches && matches[1]) || 'en';
}

// process the modified xml and write to file
function processResult(context, lang, langJson, stringXmlJson) {

    var mapObj = {};
    // create a map to the actual string
    _.forEach(stringXmlJson.resources.string, function (val) {
        if (_.has(val, '$') && _.has(val['$'], 'name')) {
            mapObj[val['$'].name] = val;
        }
    });

    var langJsonToProcess = _.extend({}, langJson.config_android, langJson.app, langJson.app_android);

    // now iterate through langJsonToProcess
    _.forEach(langJsonToProcess, function (val, key) {
        // positional string format is in Mac OS X format. change to android format
        val = val.replace(/\$@/gi, '$s');
        val = val.replace(/'/gi, "\\'");

        if (_.has(mapObj, key)) {
            // mapObj contains key. replace key
            mapObj[key]['_'] = val;
        } else {
            // add by inserting
            stringXmlJson.resources.string.push({
                _: val,
                $: { name: key }
            });
        }
    });


    // save to disk
    var filePath = getLocalStringXmlPath(context, lang);
    var langDir = path.dirname(filePath);

    return mkdirp(langDir).then(function () {
        fs.writeFileSync(filePath, buildXML(stringXmlJson));
        console.log('Localization saved:', filePath);
    });

    function buildXML(obj) {
        var builder = new xml2js.Builder();
        builder.options.renderOpts.indent = '\t';

        var x = builder.buildObject(obj);
        return x.toString();
    }
}